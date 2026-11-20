'use strict';
// Presentation only. The existing submit handler and second confirmation are retained.
(() => {
 const paths={trash:'M3 6h18|M8 6V3h8v3|M5 6l1 15h12l1-15|M10 10v7M14 10v7',warning:'M12 3 2 21h20z|M12 9v5M12 17h.01',lock:'M6 10h12v11H6z|M8 10V7a4 4 0 0 1 8 0v3|M12 14v3',user:'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8|M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2z',file:'M5 3h9l5 5v13H5z|M14 3v6h5M8 13h8M8 17h6',list:'M7 5H4v16h16V5h-3|M8 3h8v4H8z|M8 11h8M8 15h8M8 18h5',star:'m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',flag:'M4 22V3|M4 4h15l-3 5 3 5H4',layers:'m12 3 10 5-10 5L2 8z|m2 12 10 5 10-5M2 16l10 5 10-5',back:'M3 13a9 9 0 1 1 3 6M3 5v8h8'};
 function el(tag,cls,text){const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;}
 function icon(name){const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');s.setAttribute('focusable','false');s.classList.add('tp-del-svg');for(const d of paths[name].split('|')){const p=document.createElementNS(ns,'path');p.setAttribute('d',d);s.append(p);}return s;}
 function artwork(){const e=el('div','');e.innerHTML=`<svg class="tp-del-art" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="tp-trash-body" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#ff91a0"/><stop offset="1" stop-color="#f4506b"/></linearGradient><linearGradient id="tp-trash-lid" x2="0" y2="1"><stop stop-color="#ff536b"/><stop offset="1" stop-color="#cb1235"/></linearGradient></defs><circle cx="58" cy="58" r="54" fill="#ffe2e8"/><path d="M43 27v-7q0-5 6-5h19q6 0 6 5v7" fill="none" stroke="#bc1737" stroke-width="5"/><path d="M25 36h68l-5 60q-1 8-10 8H40q-9 0-10-8z" fill="url(#tp-trash-body)"/><rect x="20" y="27" width="78" height="12" rx="5" fill="url(#tp-trash-lid)"/><path d="M43 48v43M58 48v43M73 48v43" stroke="#ce3653" stroke-width="6" stroke-linecap="round"/><path d="m91 10 7-8m0 18 10-6" stroke="#fa707f" stroke-width="3" stroke-linecap="round"/><circle cx="91" cy="94" r="22" fill="white"/><circle cx="91" cy="94" r="18" fill="#e90e37"/><path d="m84 87 14 14m0-14-14 14" stroke="white" stroke-width="4" stroke-linecap="round"/></svg>`;return e.firstElementChild;}
 // Le script décoratif conserve le formulaire, le bouton submit et les écouteurs d'origine.
 document.addEventListener('DOMContentLoaded',()=>{
  if(!document.body.classList.contains('pending-page'))return;
  const form=document.getElementById('pending-delete-form');
  const dialog=form?.closest('dialog.workspace-dialog');
  const action=document.querySelector('.pending-account-action .workspace-action');
  if(!dialog||!action)return;
  const details=form.closest('.account-danger'),header=dialog.querySelector('.workspace-dialog-header'),title=header.querySelector('h2'),close=header.querySelector('.workspace-close');
  const notice=details.querySelector(':scope > p'),save=form.querySelector('button[type=submit]'),password=document.getElementById('pending-delete-password'),caption=form.querySelector('label[for=pending-delete-password]');
  if(!notice||!save||!password||!caption)return;
  const actionTitle=action.querySelector('strong'),actionText=action.querySelector('span');
  actionTitle.textContent='Annuler mon inscription artisan';actionText.textContent='Supprimez votre dossier en attente et les données qui y sont liées.';
  const actionIcon=el('span','pp-danger-icon');actionIcon.append(icon('trash'));const actionCopy=el('span','pp-danger-copy');actionCopy.append(actionTitle,actionText);const cta=el('span','pp-danger-cta');cta.append(icon('trash'),document.createTextNode('Demander la suppression →'));action.append(actionIcon,actionCopy,cta);
  dialog.classList.add('tp-del-dialog');title.textContent='Annuler mon inscription artisan';
  const mark=el('span','tp-del-mark');mark.append(icon('trash'));const titles=el('div','tp-del-titles');titles.append(title,el('p','tp-del-subtitle','Cette action est irréversible'));header.insertBefore(mark,close);header.insertBefore(titles,close);
  const banner=el('div','tp-del-warning'),copy=el('div','');notice.before(banner);copy.append(el('strong','','Attention !'),notice);banner.append(icon('warning'),copy);
  // Le champ reste le même objet DOM. Un œil existant n'est jamais doublé.
  const nativeEye=!!form.querySelector('.taskly-password-eye-button');
  caption.prepend(icon('lock'));caption.append(el('span','tp-del-required',' *'));password.placeholder='Saisissez votre mot de passe actuel';
  if(!nativeEye && password.parentElement===form){
   const wrap=el('div','pp-password-input');password.before(wrap);wrap.append(password);const inputIcon=el('span','tp-del-input-icon');inputIcon.append(icon('lock'));wrap.append(inputIcon);
   // Le premier bouton du formulaire reste le submit historique.
   const eye=el('button','pp-eye');eye.type='button';eye.setAttribute('aria-label','Afficher le mot de passe');eye.setAttribute('aria-pressed','false');
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('tp-del-svg');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6');svg.append(path);eye.append(svg);
   // Aucune insertion de bouton avant le submit : ordre DOM préservé, position visuelle par CSS.
   form.append(eye);eye.classList.add('pp-eye-detached');
   eye.addEventListener('click',()=>{const show=password.type==='password';password.type=show?'text':'password';eye.setAttribute('aria-pressed',String(show));eye.setAttribute('aria-label',show?'Masquer le mot de passe':'Afficher le mot de passe');});
   dialog.addEventListener('close',()=>{password.value='';password.type='password';eye.setAttribute('aria-pressed','false');eye.setAttribute('aria-label','Afficher le mot de passe');});
  }
  const data=el('section','tp-del-data'),dataCopy=el('div','tp-del-data-copy'),list=el('ul','tp-del-list');dataCopy.append(el('h3','','Les éléments concernés :'),list);data.append(artwork(),dataCopy);
  [['user','Votre inscription artisan'],['file','Vos justificatifs transmis'],['layers','Les données liées à ce dossier']].forEach(([name,text])=>{const li=el('li',''),badge=el('span','');badge.append(icon(name));li.append(badge,el('span','',text));list.append(li);});
  const consent=el('label','tp-del-consent'),check=el('input','');check.type='checkbox';check.id='pp-delete-consent';check.required=true;const text=el('span','','Je confirme vouloir annuler définitivement mon inscription et je comprends que cette action est ');text.append(el('strong','','irréversible.'));consent.append(check,text);
  const actions=el('div','tp-del-actions'),cancel=el('button','tp-del-cancel');cancel.type='button';cancel.append(icon('back'),document.createTextNode('Annuler'));cancel.addEventListener('click',()=>dialog.close());save.classList.add('tp-del-save');save.prepend(icon('trash'));save.before(data,consent,actions);actions.append(save,cancel);
  dialog.addEventListener('close',()=>{check.checked=false;password.value='';password.type='password';});
  // Adapter seulement le texte de la confirmation existante, sans intercepter sa réponse.
  new MutationObserver(()=>{const confirm=document.querySelector('dialog.taskly-confirm-dialog');if(!confirm||confirm.dataset.pendingCopy)return;confirm.dataset.pendingCopy='true';const label=confirm.querySelector('.taskly-danger-label'),heading=confirm.querySelector('#delete-confirm-title'),paragraph=confirm.querySelector('#delete-confirm-description');if(label)label.textContent='Annulation de l’inscription';if(heading)heading.textContent='Supprimer définitivement votre inscription artisan ?';if(paragraph)paragraph.textContent='Votre dossier artisan en attente, les justificatifs et les données qui y sont liées seront supprimés. Cette action est irréversible.';}).observe(document.body,{childList:true,subtree:true});
 });
})();

// Présentation uniquement : le champ natif conserve ses fichiers, sa validation et FormData.
document.addEventListener('DOMContentLoaded',()=>{
 if(!document.body.classList.contains('pending-page'))return;
 const input=document.getElementById('pending-doc'),name=document.getElementById('pp-upload-name');
 const zone=input?.closest('.pp-upload');
 if(!input||!name||!zone)return;
 const render=()=>{const file=input.files?.[0];name.textContent=file?file.name:'Aucun fichier sélectionné';zone.classList.toggle('has-file',!!file);};
 input.addEventListener('change',render);
 input.form?.addEventListener('reset',()=>queueMicrotask(render));
 render();
});
