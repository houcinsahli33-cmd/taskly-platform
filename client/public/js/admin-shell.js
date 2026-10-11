/* Menu admin persistant. Chaque rubrique conserve sa propre page et son cycle JS. */
(() => {
  'use strict';
  const pages = new Set(['overview','users','reports','contacts','services','verification','account','admins','site']);
  const frame = document.getElementById('taskly-admin-frame');
  if (!frame) return;
  const base = window.location.pathname.split('/dashboard')[0] + '/dashboard/';
  const links = [...document.querySelectorAll('.admin-sidebar a[data-admin-tab]')];
  let currentUrl = '';
  let requestedUrl = '';
  const loading = document.getElementById('taskly-admin-loading');
  const scrollPositions = new Map();
  const rail = document.getElementById('taskly-admin-scroll');
  const railSpacer = document.getElementById('taskly-admin-scroll-spacer');
  let detachChildScroll = () => {};
  let railIsSyncing = false;

  // On conserve le viewport original, y compris ses breakpoints CSS :
  // le cadre a la largeur de la fenêtre et sa copie du menu reste hors champ.
  function alignFrame() {
    const sidebar = document.querySelector?.('.admin-sidebar');
    const width = (window.matchMedia && window.matchMedia('(max-width:800px)').matches)
      ? 0 : (sidebar?.getBoundingClientRect().width || 242);
    frame.style?.setProperty?.('--taskly-frame-offset', -width + 'px');
  }
  alignFrame();
  window.addEventListener('resize', alignFrame);

  function syncScrollRail() {
    if (!rail || !railSpacer) return;
    try {
      const child = frame.contentWindow;
      const doc = child.document;
      const scrollHeight = Math.max(doc.documentElement.scrollHeight,doc.body?.scrollHeight || 0);
      const viewport = doc.documentElement.clientHeight || child.innerHeight;
      // Dimensions identiques au document réel : même plage de défilement.
      railSpacer.style.height = Math.max(scrollHeight,rail.clientHeight) + 'px';
      const bottom = Math.max(0,scrollHeight-viewport);
      const railBottom = Math.max(0,rail.scrollHeight-rail.clientHeight);
      railIsSyncing = true;
      rail.scrollTop = bottom > 0 ? child.scrollY * railBottom / bottom : 0;
      railIsSyncing = false;
    } catch { railIsSyncing = false; }
  }
  if (rail) rail.addEventListener('scroll',()=>{
    if(railIsSyncing) return;
    try {
      const child=frame.contentWindow;
      const doc=child.document;
      const bottom=Math.max(0,Math.max(doc.documentElement.scrollHeight,doc.body?.scrollHeight || 0)-(doc.documentElement.clientHeight || child.innerHeight));
      const railBottom=Math.max(0,rail.scrollHeight-rail.clientHeight);
      if(railBottom) child.scrollTo(0,rail.scrollTop*bottom/railBottom);
    } catch { /* cadre déconnecté : aucun changement d'état */ }
  });
  function watchChildScroll() {
    detachChildScroll();
    const child=frame.contentWindow;
    try {
      child.addEventListener('scroll',syncScrollRail,{passive:true});
      const obs=typeof ResizeObserver==='undefined' ? null : new ResizeObserver(syncScrollRail);
      if(obs) {
        obs.observe(child.document.documentElement);
        if(child.document.body) obs.observe(child.document.body);
      }
      detachChildScroll=()=>{child.removeEventListener('scroll',syncScrollRail);obs?.disconnect();};
      syncScrollRail();
    } catch {detachChildScroll=()=>{};}
  }

  function urlForPage(value) {
    try {
      const url = new URL(value, window.location.href);
      if (url.origin !== window.location.origin || !url.pathname.startsWith(base)) return null;
      const page = url.pathname.slice(base.length);
      if (!pages.has(page)) return null;
      url.searchParams.delete('taskly_embed');
      url.hash = '';
      return url;
    } catch { return null; }
  }
  function showTab(page) {
    for (const link of links) {
      const active=link.dataset.adminTab===page;
      link.classList.toggle('active',active);
      if(active) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    }
    document.title = (links.find(l=>l.dataset.adminTab===page)?.textContent.trim() || 'Administration')+' — Taskly';
  }
  function rememberScroll() {
    try {
      const child=frame.contentWindow;
      if(currentUrl && child && child.location.href.includes('taskly_embed=1')) {
        scrollPositions.set(currentUrl,child.scrollY);
      }
    } catch { /* Session terminée ou changement d'origine. */ }
  }
  function navigate(value, push=true) {
    const url=urlForPage(value);
    if(!url) return false;
    const relative=url.pathname+url.search;
    if(relative===currentUrl) return true;
    rememberScroll();
    currentUrl=relative;
    showTab(url.pathname.slice(base.length));
    if(push) window.history.pushState({tasklyAdmin:true},'',relative);
    const embedded=new URL(url);
    embedded.searchParams.set('taskly_embed','1');
    requestedUrl=embedded.pathname+embedded.search;
    detachChildScroll();
    loading.textContent='Chargement de la rubrique…';
    frame.src=requestedUrl;
    return true;
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('.admin-sidebar a[data-admin-tab]');
    if(!link || event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
    const url=urlForPage(link.href);
    if(url) {event.preventDefault();navigate(url.href);}
  });
  window.addEventListener('message',event=>{
    if(event.origin!==window.location.origin || event.source!==frame.contentWindow)return;
    const data=event.data;
    if(!data || data.type!=='taskly:admin-navigate' || typeof data.url!=='string')return;
    navigate(data.url);
  });
  window.addEventListener('popstate',()=>navigate(window.location.href,false));
  frame.addEventListener('load',()=>{
    loading.textContent='';
    try {
      const href=frame.contentWindow.location.href;
      // Les liens redirigés par scripts historiques sont rapatriés dans le cadre.
      if(!href.includes('taskly_embed=1')) {
        const url=urlForPage(href);
        if(url) { currentUrl='';navigate(url.href);return; }
        // Une session expirée doit sortir de la structure persistante.
        if(href!=='about:blank') window.location.assign(href);
        return;
      }
      const url=urlForPage(href);
      if(!url) return;
      if(url.pathname+url.search!==currentUrl) {
        // Un chargement ancien ne doit jamais remplacer le dernier onglet choisi.
        frame.src=requestedUrl;
        return;
      }
      const target=scrollPositions.get(currentUrl) || 0;
      if(target) frame.contentWindow.scrollTo(0,target);
      watchChildScroll();
    } catch { window.location.reload(); }
  });
  // Le serveur protège aussi les pages directes et les documents embarqués.
  (async()=>{
    try {
      await attendreSession();
      if(window.utilisateurCourant?.role!=='admin')return;
      const {compte}=await requeteAPI('/api/admin-settings/me');
      const principal=compte?.niveau==='principal';
      for(const id of ['tab-site','tab-admins']){
        const link=document.getElementById(id);
        if(link)link.hidden=!principal;
      }
    } catch {
      for(const id of ['tab-site','tab-admins']){
        const link=document.getElementById(id);
        if(link)link.hidden=true;
      }
    }
  })();
  navigate(window.location.href,false);
})();
