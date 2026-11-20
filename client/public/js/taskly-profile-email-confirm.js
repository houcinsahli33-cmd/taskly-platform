'use strict';
// Called only from the successful account email verification response handler.
(() => {
 const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 window.tasklyAfficherConfirmationEmail=function(data,form){
  if(data?.deconnexion!==true||typeof data.confirmedEmail!=='string'||!data.confirmedEmail||typeof data.previousEmail!=='string'||form?.id!=='account-email-verify')return false;
  const dialog=form.closest('dialog.workspace-dialog.tp-email-dialog'),body=dialog?.querySelector('.workspace-dialog-body');
  if(!dialog?.open||!body||!['client','artisan'].includes(document.body.dataset.requireRole)||document.body.dataset.workspacePage!=='profil')return false;
  const steps=make('ol','tp-email-steps');
  ['Nouvelle adresse','Vérification (code)','Confirmation'].forEach(label=>{const li=make('li','tp-email-step is-done');li.append(make('span','tp-email-num','✓'),make('span','tp-email-step-label',label));steps.append(li);});
  const section=make('section','tp-confirm-panel'),layout=make('div','tp-confirm-layout'),art=make('div','tp-confirm-art'),copy=make('div','tp-confirm-copy');
  art.innerHTML='<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false"><rect x="3" y="3" width="114" height="114" rx="25" fill="#e1f5ec"/><path d="M16 49 60 18l44 31v50H16z" fill="#087456"/><rect x="29" y="25" width="62" height="54" rx="7" fill="#fff" stroke="#94cabb"/><circle cx="60" cy="49" r="17" fill="#07865f"/><path d="m51 49 6 6 12-13" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="m16 49 44 31 44-31v50H16z" fill="#16a078"/><path d="m16 99 44-32 44 32" fill="#08795c"/><circle cx="94" cy="91" r="18" fill="#075d49" stroke="white" stroke-width="3"/><path d="m86 91 5 5 10-11" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const heading=make('h3','tp-confirm-title','Adresse e-mail modifiée avec succès !');heading.tabIndex=-1;
  const addresses=make('dl','tp-confirm-addresses');
  for(const [label,value,cls] of [['Ancienne adresse',data.previousEmail,'tp-confirm-old'],['Nouvelle adresse',data.confirmedEmail,'tp-confirm-new']]){const row=make('div','tp-confirm-address-row');row.append(make('dt','',label),make('dd',cls,value));addresses.append(row);}
  copy.append(heading,make('p','tp-confirm-intro','Votre nouvelle adresse a été vérifiée et enregistrée pour tous vos espaces client et artisan.'),addresses);layout.append(art,copy);
  const notice=make('p','tp-confirm-notice','Votre session a été fermée pour votre sécurité. Reconnectez-vous avec votre nouvelle adresse.');
  const footer=make('div','tp-confirm-actions'),button=make('button','btn primary tp-confirm-login','Se reconnecter →');button.type='button';footer.append(button);section.append(layout,notice,footer);
  let leaving=false,timeout;
  function reconnect(){if(leaving)return;leaving=true;clearTimeout(timeout);location.replace('/login.html');}
  button.addEventListener('click',reconnect);dialog.addEventListener('cancel',e=>{e.preventDefault();reconnect();});dialog.addEventListener('close',reconnect,{once:true});
  // Stop the previous verification timer, clear secrets, and remove obsolete forms.
  form.hidden=true;delete form.dataset.tpEmailDeadline;
  dialog.querySelectorAll('input').forEach(input=>{input.value='';});
  dialog.classList.add('tp-email-confirmed');body.replaceChildren(steps,section);heading.focus();
  timeout=setTimeout(reconnect,30000);
  return true;
 };
})();