'use strict';
// Decoration only. Original forms, input IDs, listeners and server responses stay intact.
(() => {
 const paths={mail:'M3 5h18v14H3z|m3 6 9 7 9-7',lock:'M6 10h12v11H6z|M8 10V7a4 4 0 0 1 8 0v3',info:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20|M12 11v6M12 7h.01',back:'M3 12a9 9 0 1 1 2.6 6.4M3 4v8h8',send:'M22 2 2 10l8 4 4 8 8-20z|M10 14 22 2'};
 function el(tag,cls,text){const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;}
 function icon(name){const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');s.setAttribute('focusable','false');s.classList.add('tp-email-svg');for(const d of paths[name].split('|')){const p=document.createElementNS(ns,'path');p.setAttribute('d',d);s.append(p);}return s;}
 document.addEventListener('DOMContentLoaded',()=>{
  const body=document.body;if(body.dataset.workspacePage!=='profil'||!['client','artisan'].includes(body.dataset.requireRole))return;
  function enhance(){
   const request=document.getElementById('account-email-request'),verify=document.getElementById('account-email-verify'),dialog=request?.closest('dialog.workspace-dialog');
   if(!dialog||dialog.classList.contains('tp-email-dialog')||!verify||!dialog.contains(verify))return;
   const details=request.closest('.account-details'),header=dialog.querySelector('.workspace-dialog-header'),title=header?.querySelector('h2'),close=header?.querySelector('.workspace-close'),notice=details?.querySelector(':scope > p.muted'),send=request.querySelector('button[type=submit]');
   const email=document.getElementById('account-email'),password=document.getElementById('account-email-password'),status=document.getElementById('account-email-status');
   if(!details||!title||!close||!notice||!send||!email||!password||!status||!request.contains(email)||!request.contains(password))return;
   dialog.classList.add('tp-email-dialog');
   const mark=el('span','tp-email-mark');mark.append(icon('mail'));const titles=el('div','tp-email-titles');titles.append(title,el('p','tp-email-subtitle','Mettez à jour votre adresse e-mail en toute sécurité'));header.insertBefore(mark,close);header.insertBefore(titles,close);
   // Read the real address from the original rendered notice; never substitute account data.
   const source=notice.textContent,match=source.match(/^Adresse commune\s*:\s*([^\s]+?)\.\s+(Ce changement[\s\S]*)$/);
   const banner=el('div','tp-email-banner'),copy=el('div','tp-email-banner-copy');banner.append(icon('info'),copy);notice.before(banner);copy.append(notice);notice.classList.add('tp-email-notice');
   if(match){const line=el('div','tp-email-current');line.append(el('strong','','Adresse actuelle :'),el('span','tp-email-address',match[1]));notice.before(line);notice.textContent=match[2];}
   const steps=el('ol','tp-email-steps');const items=['Nouvelle adresse','Vérification (code)','Confirmation'].map((label,i)=>{const li=el('li','tp-email-step');li.append(el('span','tp-email-num',String(i+1)),el('span','tp-email-step-label',label));steps.append(li);return li;});request.before(steps);
   function updateSteps(){const n=verify.hidden?0:1;items.forEach((item,i)=>{item.classList.toggle('is-current',i===n);item.classList.toggle('is-done',i<n);if(i===n)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});}
   new MutationObserver(updateSteps).observe(verify,{attributes:true,attributeFilter:['hidden']});updateSteps();
   for(const [field,name] of [[email,'mail'],[password,'lock']]){const label=field.closest('label'),caption=label?.querySelector('.field-label');if(!caption)continue;label.classList.add('tp-email-field');caption.prepend(icon(name));if(field.required)caption.append(el('span','tp-email-required','*'));}
   if(!email.placeholder)email.placeholder='Ex. : nouvelleadresse@gmail.com';if(!password.placeholder)password.placeholder='Saisissez votre mot de passe actuel';
   const actions=el('div','tp-email-actions'),cancel=el('button','tp-email-cancel');cancel.type='button';cancel.append(icon('back'),document.createTextNode('Annuler'));cancel.addEventListener('click',()=>dialog.close());
   send.classList.add('tp-email-send');send.textContent='Recevoir le code de vérification';send.prepend(icon('send'));send.before(actions);actions.append(cancel,send);
  }
  new MutationObserver(enhance).observe(body,{childList:true,subtree:true});enhance();
 });
})();