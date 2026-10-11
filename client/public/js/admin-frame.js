/* Intercepte les liens internes du contenu, sans perturber ses scripts existants. */
(() => {
  'use strict';
  const parts=window.location.pathname.split('/dashboard/');
  if(window.parent===window) {
    const url=new URL(window.location.href);
    url.searchParams.delete('taskly_embed');
    window.location.replace(url.pathname+url.search+url.hash);
    return;
  }
  if(parts.length!==2)return;
  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest('a[href]');
    if(!link || link.hasAttribute('download') || (link.target && link.target!=='_self'))return;
    const url=new URL(link.href,window.location.href);
    const prefix=parts[0]+'/dashboard/';
    if(url.origin!==window.location.origin||!url.pathname.startsWith(prefix))return;
    const page=url.pathname.slice(prefix.length);
    if(!['overview','users','reports','contacts','services','verification','account','admins','site'].includes(page))return;
    event.preventDefault();
    url.searchParams.delete('taskly_embed');
    window.parent.postMessage({type:'taskly:admin-navigate',url:url.pathname+url.search},window.location.origin);
  },true);
})();
