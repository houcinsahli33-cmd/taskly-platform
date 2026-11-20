'use strict';
// Presentation only. The existing submit handler and second confirmation are retained.
(() => {
 const paths={trash:'M3 6h18|M8 6V3h8v3|M5 6l1 15h12l1-15|M10 10v7M14 10v7',warning:'M12 3 2 21h20z|M12 9v5M12 17h.01',lock:'M6 10h12v11H6z|M8 10V7a4 4 0 0 1 8 0v3|M12 14v3',user:'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8|M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2z',file:'M5 3h9l5 5v13H5z|M14 3v6h5M8 13h8M8 17h6',list:'M7 5H4v16h16V5h-3|M8 3h8v4H8z|M8 11h8M8 15h8M8 18h5',star:'m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',flag:'M4 22V3|M4 4h15l-3 5 3 5H4',layers:'m12 3 10 5-10 5L2 8z|m2 12 10 5 10-5M2 16l10 5 10-5',back:'M3 13a9 9 0 1 1 3 6M3 5v8h8'};
 function el(tag,cls,text){const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;}
 function icon(name){const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');s.setAttribute('focusable','false');s.classList.add('tp-del-svg');for(const d of paths[name].split('|')){const p=document.createElementNS(ns,'path');p.setAttribute('d',d);s.append(p);}return s;}
 function artwork(){const e=el('div','');e.innerHTML=`<svg class="tp-del-art" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="tp-trash-body" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#ff91a0"/><stop offset="1" stop-color="#f4506b"/></linearGradient><linearGradient id="tp-trash-lid" x2="0" y2="1"><stop stop-color="#ff536b"/><stop offset="1" stop-color="#cb1235"/></linearGradient></defs><circle cx="58" cy="58" r="54" fill="#ffe2e8"/><path d="M43 27v-7q0-5 6-5h19q6 0 6 5v7" fill="none" stroke="#bc1737" stroke-width="5"/><path d="M25 36h68l-5 60q-1 8-10 8H40q-9 0-10-8z" fill="url(#tp-trash-body)"/><rect x="20" y="27" width="78" height="12" rx="5" fill="url(#tp-trash-lid)"/><path d="M43 48v43M58 48v43M73 48v43" stroke="#ce3653" stroke-width="6" stroke-linecap="round"/><path d="m91 10 7-8m0 18 10-6" stroke="#fa707f" stroke-width="3" stroke-linecap="round"/><circle cx="91" cy="94" r="22" fill="white"/><circle cx="91" cy="94" r="18" fill="#e90e37"/><path d="m84 87 14 14m0-14-14 14" stroke="white" stroke-width="4" stroke-linecap="round"/></svg>`;return e.firstElementChild;}
 document.addEventListener('DOMContentLoaded',()=>{
  const body=document.body;if(body.dataset.workspacePage!=='profil'||!['client','artisan'].includes(body.dataset.requireRole))return;
  function enhance(){
   const form=document.getElementById('account-delete-form'),dialog=form?.closest('dialog.workspace-dialog');
   if(!dialog||dialog.classList.contains('tp-del-dialog'))return;
   const details=form.closest('.account-danger'),header=dialog.querySelector('.workspace-dialog-header'),title=header?.querySelector('h2'),close=header?.querySelector('.workspace-close'),notice=details?.querySelector(':scope > p:not([id])'),save=form.querySelector('button[type=submit]'),password=document.getElementById('account-delete-password'),label=password?.closest('label'),caption=label?.querySelector('.field-label');
   if(!details||!title||!close||!notice||!save||!password||!caption||!form.contains(password))return;
   dialog.classList.add('tp-del-dialog');
   const mark=el('span','tp-del-mark');mark.append(icon('trash'));const titles=el('div','tp-del-titles');titles.append(title,el('p','tp-del-subtitle','Cette action est irréversible'));header.insertBefore(mark,close);header.insertBefore(titles,close);
   const banner=el('div','tp-del-warning'),copy=el('div','');notice.before(banner);copy.append(el('strong','','Attention !'),notice);banner.append(icon('warning'),copy);
   label.classList.add('tp-del-password');caption.prepend(icon('lock'));if(password.required){const star=el('span','tp-del-required','*');star.setAttribute('aria-hidden','true');caption.append(star);}if(!password.placeholder)password.placeholder='Saisissez votre mot de passe actuel';const inputIcon=el('span','tp-del-input-icon');inputIcon.append(icon('lock'));label.append(inputIcon);
   const data=el('section','tp-del-data'),dataCopy=el('div','tp-del-data-copy'),list=el('ul','tp-del-list');dataCopy.append(el('h3','','Les données suivantes seront supprimées :'),list);data.append(artwork(),dataCopy);
   const items=[['user','Votre profil et vos informations'],['star','Vos avis et évaluations'],['file','Vos justificatifs et documents'],['flag','Vos signalements'],['list','Vos demandes et historiques'],['layers','Les données de cet espace']];
   items.forEach(([name,text])=>{const li=el('li',''),badge=el('span','');badge.append(icon(name));li.append(badge,el('span','',text));list.append(li);});
   const consent=el('label','tp-del-consent'),check=el('input','');check.type='checkbox';check.id='tp-delete-consent';check.required=true;const consentText=el('span','','Je confirme vouloir supprimer définitivement mon compte et je comprends que cette action est ');consentText.append(el('strong','','irréversible.'));consent.append(check,consentText);
   const actions=el('div','tp-del-actions'),cancel=el('button','tp-del-cancel');cancel.type='button';cancel.append(icon('back'),document.createTextNode('Annuler'));cancel.addEventListener('click',()=>dialog.close());
   save.classList.add('tp-del-save');save.prepend(icon('trash'));save.before(data,consent,actions);actions.append(cancel,save);
   form.addEventListener('submit',e=>{if(!check.checked){e.preventDefault();e.stopImmediatePropagation();check.reportValidity();check.focus();}},true);
   dialog.addEventListener('close',()=>{check.checked=false;});
  }
  new MutationObserver(enhance).observe(body,{childList:true,subtree:true});enhance();
 });
})();