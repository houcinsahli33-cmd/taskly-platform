/* Le menu original reste dans le document parent. La rubrique intégrale reste
   dans son propre document, sans déplacer ni recompiler ses scripts métier. */
(() => {
  'use strict';
  const iframe = document.getElementById('taskly-admin-content-frame');
  if (!iframe) return;
  const pages = new Set(['overview','users','reports','contacts','services','verification','account','admins','site']);
  const pathMatch = location.pathname.match(/^(.*\/dashboard\/)([^/]+)$/);
  if (!pathMatch || !pages.has(pathMatch[2])) return;
  const base = pathMatch[1];
  let selected = location.pathname + location.search;
  let observer = null;
  let navigatedByParent = false;
  let lastDoc = null;

  const validated = input => {
    try {
      const target = new URL(input, location.href);
      const match = target.pathname.startsWith(base) ? target.pathname.slice(base.length) : '';
      return target.origin === location.origin && pages.has(match) ? target : null;
    } catch { return null; }
  };
  const canonical = url => {
    const clean = new URL(url.href);
    clean.searchParams.delete('taskly_embed');
    return clean.pathname + clean.search + clean.hash;
  };
  const embedded = url => {
    const copy = new URL(url.href);
    copy.searchParams.set('taskly_embed','1');
    return copy.href;
  };
  const currentPage = url => url.pathname.slice(base.length);
  const selectedNav = url => {
    const page = currentPage(url);
    document.querySelectorAll('.admin-sidebar [data-admin-tab]').forEach(link => {
      const active = link.dataset.adminTab === page;
      link.classList.toggle('active',active);
      if (active) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
  };
  const navigate = (input, historyAction='push') => {
    const url = validated(input);
    if(!url) return false;
    const clean = canonical(url);
    if(historyAction === 'push' && clean !== selected) history.pushState(null,'',clean);
    if(historyAction === 'replace' && clean !== selected) history.replaceState(null,'',clean);
    selected = clean;
    selectedNav(url);
    navigatedByParent = true;
    iframe.classList.remove('taskly-modal-visible');
    iframe.src = embedded(url);
    return true;
  };
  const allowedClick = (event, link) => {
    if(event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
    if(link.hasAttribute('download') || (link.target && link.target !== '_self')) return false;
    return true;
  };
  document.querySelector('.admin-sidebar')?.addEventListener('click', event => {
    const link = event.target.closest('a[data-admin-tab]');
    if(!link || !allowedClick(event,link)) return;
    const url = validated(link.href);
    if(!url) return;
    event.preventDefault();
    navigate(url);
  });
  const updateModal = doc => {
    // Les dialogues natifs doivent couvrir l'intégralité de la fenêtre.
    const open = !!doc.querySelector('dialog[open],.admin-review-modal:not([hidden]),.modal-backdrop.show,#reports-dialog-root:not([hidden]),#support-dialog-root:not([hidden])');
    if(doc.body) doc.body.dataset.tasklyModal=open?'1':'0';
    iframe.classList.toggle('taskly-modal-visible',open);
  };
  iframe.addEventListener('load', () => {
    if(observer){observer.disconnect();observer=null;}
    let doc, innerURL;
    try {doc = iframe.contentDocument; innerURL = new URL(iframe.contentWindow.location.href);}
    catch { location.assign(selected); return; }
    if(innerURL.protocol === 'about:') return;
    if(!doc || innerURL.origin !== location.origin) {location.assign(selected);return;}
    const target = validated(innerURL);
    // Repli si un navigateur ne transmet pas Sec-Fetch-Dest lors d'une
    // redirection JavaScript déclenchée depuis la rubrique.
    if(doc.body?.dataset?.tasklyShell === '1' && target) {iframe.src=embedded(target);return;}
    if(!target) {
      // Si la session expire, une connexion ne doit pas se retrouver dans l'iframe.
      location.assign(innerURL.href);
      return;
    }
    if(!doc.querySelector('main.admin-layout > .admin-content')) {
      // Réponse de refus / session expirée : le serveur reste l'autorité.
      iframe.classList.remove('taskly-modal-visible');
      return;
    }
    if(doc !== lastDoc) {
      doc.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if(!link || !allowedClick(event,link))return;
        const url=validated(link.href);
        if(!url)return;
        event.preventDefault();
        navigate(url);
      },true);
      lastDoc=doc;
    }
    const clean=canonical(target);
    if(clean !== selected) {
      // Les redirections JS existantes (ex. Examiner un artisan) fonctionnent
      // dans l'iframe, sans toucher aux scripts métier.
      history.pushState(null,'',clean);
      selected=clean;
    }
    if(navigatedByParent) navigatedByParent=false;
    selectedNav(target);
    document.title=doc.title || document.title;
    updateModal(doc);
    observer=new MutationObserver(() => updateModal(doc));
    observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open','hidden','class','style','aria-modal']});
  });
  addEventListener('popstate', () => navigate(location.href,'none'));
  const initial = validated(location.href);
  if(initial) navigate(initial,'none');
})();
