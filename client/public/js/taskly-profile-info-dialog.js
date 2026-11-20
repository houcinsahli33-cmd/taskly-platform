'use strict';
// Decoration du formulaire existant uniquement, sans requete ni changement de donnees.
(() => {
 const paths={user:'M20 21v-2a8 8 0 0 0-16 0v2|M16 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0',phone:'M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.7 3a2 2 0 0 1-.6 2l-1.4 1.4a16 16 0 0 0 6.1 6.1l1.4-1.4a2 2 0 0 1 2-.6l3 .7a2 2 0 0 1 1.7 2z',pin:'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z|M15 10a3 3 0 1 0-6 0 3 3 0 0 0 6 0',home:'m3 10 9-8 9 8v11h-6v-7H9v7H3z',work:'M3 7h18v14H3z|M8 7V3h8v4M3 12h18M10 12v2h4v-2',clock:'M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0|M12 7v5l3 2',text:'M4 4h16v13H9l-5 4z|M8 8h8M8 12h6',check:'m5 12 4 4L19 6',reset:'M3 12a9 9 0 1 1 2.6 6.4M3 4v8h8',save:'M4 3h13l4 4v14H3V3z|M7 3v6h10V3M7 21v-8h10v8'};
 const kinds={'account-nom':'user','account-prenom':'user','account-phone':'phone','account-ville':'pin','account-address':'home','account-service':'work','account-experience':'clock','account-description':'text'};
 function el(tag,cls,value){const e=document.createElement(tag);e.className=cls;if(value!==undefined)e.textContent=value;return e;}
 function icon(name){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');for(const d of paths[name].split('|')){const p=document.createElementNS(ns,'path');p.setAttribute('d',d);svg.append(p);}return svg;}
 document.addEventListener('DOMContentLoaded',()=>{
  const body=document.body;if(body.dataset.workspacePage!=='profil'||!['client','artisan'].includes(body.dataset.requireRole))return;
  function enhance(){
   const form=document.getElementById('account-edit-form');
   const dialog=form?.closest('dialog.workspace-dialog');
   if(!dialog||dialog.classList.contains('tp-info-dialog'))return;
   const header=dialog.querySelector('.workspace-dialog-header'),title=header?.querySelector('h2'),close=header?.querySelector('.workspace-close'),submit=form.querySelector('button[type=submit]');
   if(!header||!title||!close||!submit)return;
   const fields=Array.from(form.querySelectorAll(':scope > label')).map(label=>({label,caption:label.querySelector('.field-label'),control:label.querySelector('input,select,textarea')}));
   if(!fields.length||fields.some(f=>!f.caption||!f.control||!kinds[f.control.id]))return;
   dialog.classList.add('tp-info-dialog');
   const mark=el('span','tp-info-mark');mark.append(icon('user'));
   const titles=el('div','tp-info-titles');titles.append(title,el('p','tp-info-subtitle','Consultez et mettez à jour vos informations personnelles'));
   header.insertBefore(mark,close);header.insertBefore(titles,close);
   for(const {label,caption,control} of fields){
    const kind=kinds[control.id];label.classList.add('tp-info-field');
    const symbol=el('span','tp-info-label-icon');symbol.append(icon(kind));caption.prepend(symbol);
    if(control.required){const star=el('span','tp-info-required','*');star.setAttribute('aria-hidden','true');caption.append(star);}
    const wrap=el('span','tp-info-control'),lead=el('span','tp-info-control-icon'),check=el('span','tp-info-check');
    lead.append(icon(kind));check.append(icon('check'));check.setAttribute('aria-hidden','true');check.title='Champ renseigné selon les règles du formulaire';
    control.before(wrap);wrap.append(lead,control,check);
   }
   const reset=el('button','tp-info-reset');reset.type='reset';reset.append(icon('reset'),document.createTextNode('Réinitialiser'));
   form.addEventListener('reset',event=>{if(submit.disabled)event.preventDefault();});
   const footer=el('div','tp-info-actions account-full');submit.before(footer);submit.classList.add('tp-info-save');submit.prepend(icon('save'));footer.append(reset,submit);
  }
  // Le formulaire est charge de maniere asynchrone puis deplace dans son dialogue natif.
  new MutationObserver(enhance).observe(body,{childList:true,subtree:true});enhance();
 });
})();