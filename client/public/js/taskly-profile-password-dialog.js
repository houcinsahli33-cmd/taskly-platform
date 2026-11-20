'use strict';
// Decorate the existing password form. No requests, no changes to validation or session handling.
(() => {
 const paths={lock:'M6 10h12v11H6z|M8 10V7a4 4 0 0 1 8 0v3|M12 14v3',shield:'M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6z|m8 12 3 3 5-6',back:'M3 12a9 9 0 1 1 2.6 6.4M3 4v8h8',check:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20|m7.5 12 3 3 6-6',circle:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18'};
 function el(tag,cls,text){const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;}
 function icon(name){const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');s.setAttribute('focusable','false');s.classList.add('tp-pw-svg');for(const d of paths[name].split('|')){const p=document.createElementNS(ns,'path');p.setAttribute('d',d);s.append(p);}return s;}
 document.addEventListener('DOMContentLoaded',()=>{
  const body=document.body;if(body.dataset.workspacePage!=='profil'||!['client','artisan'].includes(body.dataset.requireRole))return;
  function enhance(){
   const form=document.getElementById('account-password-form'),dialog=form?.closest('dialog.workspace-dialog');
   if(!dialog||dialog.classList.contains('tp-pw-dialog'))return;
   const details=form.closest('.account-details'),header=dialog.querySelector('.workspace-dialog-header'),title=header?.querySelector('h2'),close=header?.querySelector('.workspace-close'),notice=details?.querySelector(':scope > p.muted'),rules=form.querySelector(':scope > p.muted'),save=form.querySelector('button[type=submit]');
   const fields=['old','new','repeat'].map(name=>document.getElementById('account-password-'+name));
   if(!details||!title||!close||!notice||!rules||!save||!fields.every(f=>f&&form.contains(f)&&f.closest('label')?.querySelector('.field-label')))return;
   dialog.classList.add('tp-pw-dialog');
   const mark=el('span','tp-pw-mark');mark.append(icon('lock'));const titles=el('div','tp-pw-titles');titles.append(title,el('p','tp-pw-subtitle','Pour votre sécurité, choisissez un nouveau mot de passe'));header.insertBefore(mark,close);header.insertBefore(titles,close);
   const banner=el('div','tp-pw-banner');notice.before(banner);banner.append(icon('shield'),notice);
   const placeholders=['Saisissez votre mot de passe actuel','Choisissez un nouveau mot de passe','Confirmez votre nouveau mot de passe'];
   fields.forEach((f,i)=>{const label=f.closest('label'),caption=label.querySelector('.field-label');caption.prepend(icon('lock'));if(f.required){const star=el('span','tp-pw-required','*');star.setAttribute('aria-hidden','true');caption.append(star);}if(!f.placeholder)f.placeholder=placeholders[i];});
   const ruleBox=el('div','tp-pw-rules');rules.before(ruleBox);ruleBox.append(rules);rules.textContent='Exigences de sécurité';const list=el('ul','tp-pw-rule-grid');ruleBox.append(list);
   const tests=[['8 caractères minimum',v=>v.length>=8],['Une majuscule',v=>/[A-Z]/.test(v)],['Une minuscule',v=>/[a-z]/.test(v)],['Un chiffre',v=>/\d/.test(v)],['Un symbole',v=>/[^A-Za-z0-9]/.test(v)],['72 octets maximum',v=>v.length>0&&new TextEncoder().encode(v).length<=72]];
   const entries=tests.map(([label,test])=>{const li=el('li',''),mark=icon('circle');li.append(mark,el('span','',label));list.append(li);return {li,test,valid:false};});
   function refresh(){entries.forEach(e=>{const valid=e.test(fields[1].value);if(valid!==e.valid){e.valid=valid;e.li.classList.toggle('is-valid',valid);e.li.firstChild.replaceWith(icon(valid?'check':'circle'));}});}
   fields[1].addEventListener('input',refresh); dialog.addEventListener('close',()=>{queueMicrotask(refresh);});refresh();
   const actions=el('div','tp-pw-actions'),cancel=el('button','tp-pw-cancel');cancel.type='button';cancel.append(icon('back'),document.createTextNode('Annuler'));cancel.addEventListener('click',()=>dialog.close());
   save.classList.add('tp-pw-save');save.prepend(icon('check'));save.before(actions);actions.append(cancel,save);
  }
  new MutationObserver(enhance).observe(body,{childList:true,subtree:true});enhance();
 });
})();