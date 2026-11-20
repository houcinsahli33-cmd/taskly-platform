/* TASKLY_PRIVACY_MAIL_V1 */
(() => {
 'use strict';
 window.initialiserConfidentialiteArtisan = function(panel, button) {
  if (!panel || !button || panel.dataset.privacyReady) return;
  const phone=panel.querySelector('#privacy-show-phone'), status=panel.querySelector('#privacy-phone-status'), save=panel.querySelector('#privacy-save-button'), message=panel.querySelector('#privacy-message');
  const options=panel.querySelectorAll('.privacy-option');
  if(!phone||!status||!save||!message||options.length!==3)return;
  panel.dataset.privacyReady='1';
  const mailLabel=document.createElement('label');mailLabel.className='privacy-switch';
  const mail=document.createElement('input');mail.type='checkbox';mail.id='privacy-show-email';mail.disabled=true;mail.setAttribute('aria-label','Afficher mon adresse Taskly Mail');
  const slider=document.createElement('span');slider.className='privacy-slider';mailLabel.append(mail,slider);options[1].append(mailLabel);
  const mailInfo=options[1].querySelector('.privacy-info');mailInfo.querySelector('p').textContent='Partager uniquement votre adresse Taskly Mail active.';
  const mailStatus=document.createElement('p');mailStatus.className='privacy-state';mailInfo.append(mailStatus);
  const chatLabel=document.createElement('label');chatLabel.className='privacy-switch';
  const chat=document.createElement('input');chat.type='checkbox';chat.id='privacy-allow-chat';chat.disabled=true;chat.setAttribute('aria-label','Autoriser les messages et appels privés');
  const chatSlider=document.createElement('span');chatSlider.className='privacy-slider';chatLabel.append(chat,chatSlider);options[2].append(chatLabel);
  const chatInfo=options[2].querySelector('.privacy-info');chatInfo.querySelector('p').textContent='Autoriser les échanges et appels liés aux demandes acceptées. Historique conservé.';
  const chatStatus=document.createElement('p');chatStatus.className='privacy-state';chatInfo.append(chatStatus);
  const note=document.createElement('p');note.className='privacy-note';note.textContent='Votre Gmail personnel reste privé. Chaque espace conserve ses propres préférences.';save.closest('.request-actions').before(note);
  let prefs=null,busy=false;
  const bit=v=>[0,1,'0','1'].includes(v);
  function render(){
   phone.disabled=busy||!prefs;mail.disabled=busy||!prefs||!prefs.email;chat.disabled=busy||!prefs;
   save.disabled=busy||!prefs||(Number(phone.checked)===prefs.phone&&Number(mail.checked)===prefs.visible&&Number(chat.checked)===prefs.chat);
   status.textContent=prefs?(phone.checked?'Téléphone visible aux clients vérifiés.':'Téléphone masqué.'):'Téléphone : état indisponible';
   status.classList.toggle('is-visible',!!prefs&&phone.checked);
   mailStatus.textContent=!prefs?'État indisponible':!prefs.email?'Boîte Taskly Mail active requise':(mail.checked?'Adresse visible : ':'Adresse masquée : ')+prefs.email;
   mailStatus.classList.toggle('is-visible',!!prefs&&!!prefs.email&&mail.checked);
   chatStatus.textContent=!prefs?'État indisponible':chat.checked?'Messages et appels autorisés':'Nouveaux échanges désactivés';
   chatStatus.classList.toggle('is-visible',!!prefs&&chat.checked);
   if(prefs&&!save.disabled)message.textContent='Modifications non enregistrées.';
  }
  async function load(){if(busy)return;busy=true;prefs=null;phone.checked=mail.checked=chat.checked=false;message.textContent='Chargement…';render();
   try{const {confidentialite:c}=await requeteAPI('/api/account/confidentialite',{cache:'no-store'});
    if(!c||!Number.isSafeInteger(Number(c.artisan_id))||Number(c.artisan_id)<=0||!bit(c.afficher_telephone)||!bit(c.afficher_email)||!bit(c.autoriser_messagerie)||(c.email_professionnel!==null&&typeof c.email_professionnel!=='string'))throw Error('Préférences indisponibles.');
    prefs={id:Number(c.artisan_id),phone:Number(c.afficher_telephone),visible:Number(c.afficher_email),chat:Number(c.autoriser_messagerie),email:c.email_professionnel||''};chat.checked=!!prefs.chat;phone.checked=!!prefs.phone;mail.checked=!!prefs.visible&&!!prefs.email;message.textContent='';
   }catch(e){message.textContent='Impossible de charger les préférences. Rouvrez cette fenêtre.';}finally{busy=false;render();}}
  button.addEventListener('click',load);phone.addEventListener('change',render);mail.addEventListener('change',render);chat.addEventListener('change',render);
  save.addEventListener('click',async()=>{if(save.disabled||busy||!prefs)return;busy=true;const payload={artisan_id:prefs.id,afficher_telephone:Number(phone.checked),afficher_email:Number(mail.checked),email_professionnel:prefs.email,autoriser_messagerie:Number(chat.checked)};render();message.textContent='Enregistrement…';
   try{await requeteAPI('/api/account/confidentialite',{method:'PUT',body:JSON.stringify(payload)});prefs.phone=payload.afficher_telephone;prefs.visible=payload.afficher_email;prefs.chat=payload.autoriser_messagerie;message.textContent='Préférences enregistrées.';}
   catch(e){prefs=null;message.textContent=(e.message||'Enregistrement impossible.')+' Rouvrez la fenêtre.';}finally{busy=false;render();}});render();
 };
})();
