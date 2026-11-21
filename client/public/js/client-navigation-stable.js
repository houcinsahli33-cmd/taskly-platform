/* La navigation ne remplace jamais les scripts des formulaires : chaque rubrique reste son document original. */
(()=>{
 'use strict';
 const iframe=document.getElementById('taskly-client-content-frame');
 if(!iframe)return;
 const pages=new Set(['accueil','demandes','profil','support']);
 pages.add('messagerie');
 if(document.querySelector('[data-dashboard-link="taskly-mail"]')){
  pages.add('taskly-mail');
 }
 const base='/espace/client/';
 let selected=location.pathname+location.search+location.hash;
 let observer;
 function validated(input){
  try{const url=new URL(input,location.href);return url.origin===location.origin&&url.pathname.startsWith(base)&&pages.has(url.pathname.slice(base.length))?url:null;}
  catch{return null;}
 }
 function clean(url){const copy=new URL(url.href);copy.searchParams.delete('taskly_client_embed');return copy.pathname+copy.search+copy.hash;}
 function embedded(url){const copy=new URL(url.href);copy.searchParams.set('taskly_client_embed','1');return copy.href;}
 function navActive(url){const page=url.pathname.slice(base.length);document.body?.classList?.toggle('taskly-chat-shell-active',page==='messagerie');document.querySelectorAll('.sidebar [data-dashboard-link]').forEach(a=>{const active=a.dataset.dashboardLink===page;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
 function navigate(input,mode='push'){
  const url=validated(input);if(!url)return false;
  const target=clean(url);
  // Ne pas recréer une rubrique déjà chargée : conserver son formulaire et ses données.
  if(target===selected && mode==='push') {
   try{if(iframe.contentWindow.location.href===embedded(url) && iframe.contentDocument?.readyState==='complete' && iframe.contentDocument.querySelector('.dashboard-shell > .dashboard-content')){navActive(url);return true;}}catch{/* Recharger si le document n'est pas accessible. */}
  }
  if(target!==selected){if(mode==='push')history.pushState(null,'',target);else if(mode==='replace')history.replaceState(null,'',target);}
  selected=target;navActive(url);observer?.disconnect();observer=null;modal(null);iframe.src=embedded(url);return true;
 }
 function canClick(e,a){return !e.defaultPrevented&&e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey&&!a.hasAttribute('download')&&(!a.target||a.target==='_self');}
 document.querySelector('.sidebar')?.addEventListener('click',e=>{const a=e.target.closest('a[data-dashboard-link]');if(!a||!canClick(e,a)||!validated(a.href))return;e.preventDefault();navigate(a.href);});
// Garder les dimensions originales de l'interface
const elementsVerrouilles = new Set();

function modal(doc) {
    const open = !!doc?.querySelector(
        'dialog[open],.modal-backdrop.show,.modal.show'
    );

    iframe.classList.remove('client-modal-visible');

    if (open) {
        let element = iframe;

        while (element && element !== document.body) {
            const parent = element.parentElement;
            if (!parent) break;

            for (const voisin of parent.children) {
                if (voisin !== element && !voisin.inert) {
                    voisin.inert = true;
                    elementsVerrouilles.add(voisin);
                }
            }

            element = parent;
        }
    } else {
        elementsVerrouilles.forEach(el => {
            el.inert = false;
        });

        elementsVerrouilles.clear();
    }
}

 iframe.addEventListener('load',()=>{
  observer?.disconnect();observer=null;modal(null);
  let doc,url;try{doc=iframe.contentDocument;url=new URL(iframe.contentWindow.location.href);}catch{return location.assign(selected);}
  if(url.protocol==='about:')return;
  if(!doc||url.origin!==location.origin)return location.assign(selected);
  const target=validated(url);
  if(doc.body?.dataset?.tasklyClientShell==='1'&&target){iframe.src=embedded(target);return;}
  if(!target){location.assign(url.href);return;}
  if(!doc.querySelector('.dashboard-shell > .dashboard-content'))return;
  doc.addEventListener('click',e=>{
   const a=e.target.closest('a[href]');
   if(!a||!canClick(e,a)||a.hasAttribute('onclick'))return;
   // Les ancres internes restent dans leur document sans reinitialiser la rubrique.
   if(a.getAttribute('href')?.startsWith('#'))return;
   const rubrique=validated(a.href);
   if(rubrique){e.preventDefault();navigate(rubrique.href);return;}
   // Les pages publiques (annuaire, suivi du support...) refusent les iframes.
   // Les ouvrir au niveau principal, pas dans le cadre de la rubrique client.
   let destination;
   try{destination=new URL(a.href,url.href);}catch{return;}
   if(destination.origin!==location.origin||destination.pathname===url.pathname)return;
   e.preventDefault();
   location.assign(destination.href);
  },true);
  const current=clean(target);if(current!==selected){history.pushState(null,'',current);selected=current;}
  navActive(target);document.title=doc.title||document.title;modal(doc);
  observer=new MutationObserver(()=>modal(doc));observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open','class','hidden']});
 });
 addEventListener('taskly:open-call', e => {
    const id = e.detail?.demandeId;

    if (!Number.isSafeInteger(id) ||
        id < 1 || id > 2147483647) return;

    navigate(base + 'messagerie?conversation=' + id);
 });
 addEventListener('popstate',()=>navigate(location.href,'none'));
 const initial=validated(location.href);if(initial)navigate(initial,'none');
})();
