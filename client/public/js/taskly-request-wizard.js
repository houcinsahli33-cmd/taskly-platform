'use strict';
/* Demande en trois étapes. Même API, mêmes contrôles serveur et CSRF. */
(function(){
 const $=id=>document.getElementById(id);
 let step=0, busy=false, checking=false, initialized=false, previousFocus=null;
 let creneauKey='', creneauVersion=0, creneauTimer=null, creneauEtat='vide', heuresLibres=new Set();
 const hhmm=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 function cleCreneaux(){return val('request-artisan-id')+'|'+val('request-date');}
 function reinitialiserCreneaux(){
  creneauVersion++;creneauKey='';creneauEtat='vide';
  $('rw-hour').value='';$('rw-hour').disabled=true;$('rw-hour-period').disabled=true;$('rw-hour-grid').replaceChildren();heuresLibres=new Set();$('rw-hours').hidden=true;
 }
 function dessinerHeures(){
  const grille=$('rw-hour-grid'),debut=Number($('rw-hour-period').value);grille.replaceChildren();
  for(let n=debut;n<debut+360&&n<1440;n+=15){
   const bouton=document.createElement('button');bouton.type='button';bouton.className='rw-hour-option';bouton.textContent=hhmm(n);bouton.disabled=!heuresLibres.has(n);
   bouton.setAttribute('aria-pressed',String(val('rw-hour')===hhmm(n)));if(bouton.disabled)bouton.setAttribute('aria-label',hhmm(n)+' indisponible');
   bouton.addEventListener('click',()=>{ $('rw-hour').value=hhmm(n);grille.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===bouton)));summary();error(''); });
   grille.append(bouton);
  }
 }
 function installerCreneaux(){
  const bloc=document.createElement('div');bloc.id='rw-hours';bloc.hidden=true;
  const label=document.createElement('label');label.htmlFor='rw-hour-period';label.textContent='Heure souhaitée (heure d’Algérie)';
  const select=document.createElement('input');select.type='hidden';select.id='rw-hour';select.disabled=true;
  const periode=document.createElement('select');periode.id='rw-hour-period';periode.className='form-control';periode.disabled=true;
  for(const [n,texte] of [[0,'Nuit · 00 h – 06 h'],[360,'Matin · 06 h – 12 h'],[720,'Après-midi · 12 h – 18 h'],[1080,'Soir · 18 h – minuit']])periode.add(new Option(texte,String(n)));
  periode.value='360';periode.addEventListener('change',dessinerHeures);
  const grille=document.createElement('div');grille.id='rw-hour-grid';grille.setAttribute('role','group');grille.setAttribute('aria-label','Créneaux horaires');
  const info=document.createElement('p');info.id='rw-hour-info';info.className='muted';info.setAttribute('role','status');periode.setAttribute('aria-describedby',info.id);
  const retry=document.createElement('button');retry.type='button';retry.className='rw-date-clear';retry.textContent='Actualiser les créneaux';
  retry.addEventListener('click',()=>{creneauKey='';synchroniserCreneaux();});
  bloc.append(label,select,periode,grille,info,retry);$('rw-date-clear').insertAdjacentElement('afterend',bloc);
 }
 async function synchroniserCreneaux(){
  if(!dialog().open||form().hidden||step!==2)return;
  const key=cleCreneaux();if(key===creneauKey)return;
  const jour=val('request-date'),id=val('request-artisan-id');
  reinitialiserCreneaux();creneauKey=key;const version=creneauVersion;
  if(!jour){summary();return;}
  const select=$('rw-hour'),info=$('rw-hour-info');$('rw-hours').hidden=false;
  creneauEtat='chargement';info.textContent='Recherche des créneaux…';summary();
  try{
   const data=await requeteAPI('/api/artisans/'+encodeURIComponent(id)+'/creneaux-disponibles?jour='+encodeURIComponent(jour));
   if(version!==creneauVersion||cleCreneaux()!==key||!dialog().open)return;
   if(!Array.isArray(data.heures)||data.heures.some(n=>!Number.isInteger(n)||n<0||n>1395||n%15!==0))throw Error('Réponse calendrier invalide');
   heuresLibres=new Set(data.heures);
   const periode=$('rw-hour-period');periode.disabled=false;
   const plages=[360,720,1080,0];periode.value=String(plages.find(d=>data.heures.some(n=>n>=d&&n<d+360))??360);
   select.disabled=false;creneauEtat='pret';dessinerHeures();
   info.textContent=heuresLibres.size?'Heure indicative : l’artisan choisira la durée avant acceptation.':'Aucun début horaire possible pour cette date.';
  }catch(e){
   if(version!==creneauVersion||cleCreneaux()!==key||!dialog().open)return;
   creneauEtat='erreur';select.disabled=true;info.textContent='Créneaux indisponibles. Actualisez ou retirez la date pour convenir d’un rendez-vous ultérieurement.';
  }
 }
 function heureSelection(){return creneauEtat==='pret'&&creneauKey===cleCreneaux()&&!$('rw-hour').disabled?val('rw-hour'):'';}
 const dialog=()=>$('request-modal'), form=()=>$('request-form');
 const val=id=>$(id).value.trim();
 function error(text,field){const e=$('rw-error');e.textContent=text;e.hidden=!text;if(field)field.focus();return false;}
 function message(){const type=form().querySelector('[name="rw-type"]:checked')?.value;return (type?'Type d’intervention : '+type+'\n':'')+val('request-message');}
 function summary(){ $('rw-summary-message').textContent=message(); $('rw-summary-address').textContent=val('request-address'); $('rw-summary-date').textContent=(val('request-date')||'À convenir')+(heureSelection()?' à '+heureSelection():''); }
 function render(){
  form().querySelectorAll('[data-rw-panel]').forEach(p=>p.hidden=Number(p.dataset.rwPanel)!==step);
  dialog().querySelectorAll('[data-rw-step]').forEach(p=>{const n=Number(p.dataset.rwStep);p.classList.toggle('done',n<step);if(n===step)p.setAttribute('aria-current','step');else p.removeAttribute('aria-current');});
  $('rw-back').hidden=step===0;$('rw-next').hidden=step===2;$('rw-submit').hidden=step!==2;
  $('rw-count').textContent=$('request-message').value.length+' / 500';summary();error('');if(step===2)synchroniserCreneaux();
 }
 function validate(n){
  if(n===0&&(!val('request-message')||val('request-message').length>500))return error('Décrivez votre besoin (500 caractères maximum).',$('request-message'));
  if(n===1&&(!val('request-address')||val('request-address').length>255))return error('Indiquez une adresse valide (255 caractères maximum).',$('request-address'));
  if(n===2&&typeof window.tasklyRequestDateValide==='function'&&!window.tasklyRequestDateValide())return error('Choisissez une date disponible ou retirez la date.',$('request-date'));
  if(n===2&&val('request-date')){
   synchroniserCreneaux();
   if(creneauEtat==='chargement'||creneauKey!==cleCreneaux())return error('Attendez le chargement des créneaux.');
   if(creneauEtat!=='pret')return error('Actualisez les créneaux ou retirez la date.');
   if(!heureSelection())return error('Choisissez un créneau libre.',$('rw-hour-period'));
  }
  return true;
 }
 function close(){if(busy)return;dialog().close();}
 async function verifierDemande(id){
  const data=await requeteAPI('/api/demandes/en-cours/'+encodeURIComponent(String(id)));
  return data.demande||null;
 }
 function afficherDemandeOuverte(d){
  const labels={en_attente:'En attente',acceptee:'Acceptée',attente_confirmation:'En attente de confirmation',conteste:'Contestée'};
  let panel=$('rw-existing-request');
  if(!panel){
   panel=document.createElement('section');panel.id='rw-existing-request';panel.className='rw-success';panel.setAttribute('aria-live','polite');dialog().append(panel);
  }
  const create=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
  const icon=create('div','!','rw-success-icon');icon.setAttribute('aria-hidden','true');icon.style.color='#9a6700';icon.style.backgroundColor='#fff4db';
  const title=create('h3','Vous avez déjà une demande en cours');
  const info=create('p','Demande n° '+String(d.id)+' — '+(labels[d.statut]||'En cours'));
  const detail=create('p','Une nouvelle demande auprès de cet artisan sera possible après la clôture de la demande actuelle.');
  const link=create('a','Voir mes demandes','rw-primary');link.href='/espace/client/demandes';
  const button=create('button','Fermer','rw-secondary');button.type='button';button.addEventListener('click',close);
  panel.replaceChildren(icon,title,info,detail,link,button);
  form().hidden=true;$('rw-success').hidden=true;dialog().querySelector('.rw-steps').hidden=true;panel.hidden=false;link.focus();
 }
 async function open(artisan){
  if(!initialized)init();if(!initialized||dialog().open||busy||checking)return;
  checking=true;let existante=null,verificationEchouee=false;
  try{existante=await verifierDemande(artisan.id);}catch(e){verificationEchouee=true;}finally{checking=false;}
  if(dialog().open||busy)return;
  const existing=$('rw-existing-request');if(existing)existing.hidden=true;
  dialog().querySelector('.rw-steps').hidden=false;
  previousFocus=document.activeElement;form().reset();reinitialiserCreneaux();step=0;form().hidden=false;$('rw-success').hidden=true;
  $('request-artisan-id').value=String(artisan.id);$('request-artisan-name').textContent=nomComplet(artisan);
  $('request-artisan-photo').src=imageProfil(artisan.photo_profil);
  $('rw-new').hidden=artisan.moyenne_notes==null||Number(artisan.moyenne_notes)>0;
  $('request-artisan-service').textContent=[artisan.service_nom,artisan.ville].filter(Boolean).join(' · ');
  $('request-artisan-experience').textContent=Number(artisan.experience||0)+' an(s) d’expérience';
  const missions=$('request-artisan-missions');missions.hidden=artisan.total_demandes==null;missions.textContent=Number(artisan.total_demandes||0)+' mission(s)';
  $('request-artisan-description').textContent=artisan.description||'Aucune description détaillée pour le moment.';
  render();dialog().showModal();document.body.classList.add('no-scroll');
  // Le calendrier existant peut modifier la valeur via JavaScript sans événement change.
  clearInterval(creneauTimer);creneauTimer=setInterval(synchroniserCreneaux,250);
  if(existante){afficherDemandeOuverte(existante);return;}
  if(verificationEchouee)error('Vérification préalable indisponible. Le serveur vérifiera votre demande lors de l’envoi.');
  $('request-message').focus();
 }
 function init(){
  if(initialized||!dialog()||!form())return;initialized=true;installerCreneaux();reinitialiserCreneaux();
  $('request-artisan-photo').addEventListener('error',e=>{if(!e.target.src.endsWith(DEFAULT_AVATAR))e.target.src=DEFAULT_AVATAR;});
  dialog().querySelectorAll('[data-rw-close]').forEach(b=>b.addEventListener('click',close));
  dialog().addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  dialog().addEventListener('close',()=>{clearInterval(creneauTimer);reinitialiserCreneaux();document.body.classList.remove('no-scroll');previousFocus?.focus();});
  $('request-message').addEventListener('input',()=>{$('rw-count').textContent=$('request-message').value.length+' / 500';if(val('request-message'))error('');});
  $('request-address').addEventListener('input',()=>{if(val('request-address'))error('');});
  $('request-date').addEventListener('change',()=>{synchroniserCreneaux();summary();});
  $('rw-date-clear').addEventListener('click',()=>{$('request-date').value='';synchroniserCreneaux();summary();error('');});
  $('rw-back').addEventListener('click',()=>{if(!busy&&step>0){step--;render();$(step===0?'request-message':'request-address').focus();}});
  $('rw-next').addEventListener('click',()=>{if(!busy&&step<2&&validate(step)){step++;render();$(step===1?'request-address':'request-date').focus();}});
  form().addEventListener('submit',async e=>{
   e.preventDefault();if(busy||step!==2)return;
   for(let n=0;n<3;n++){if(n===2&&!validate(n))return;if(n<2&&!(n===0?val('request-message')&&val('request-message').length<=500:val('request-address')&&val('request-address').length<=255)){step=n;render();validate(n);return;}}
   busy=true;const b=$('rw-submit');b.disabled=true;$('rw-back').disabled=true;b.textContent='Envoi en cours…';error('');
   try{
    await requeteAPI('/api/demandes',{method:'POST',body:JSON.stringify({artisanId:Number(val('request-artisan-id')),message:message(),adresse:val('request-address'),dateSouhaitee:val('request-date')||null,heureSouhaitee:heureSelection()||undefined})});
    form().hidden=true;$('rw-success').hidden=false;$('rw-success').querySelector('a').focus();
   }catch(e){
    let existante=null;try{existante=await verifierDemande(val('request-artisan-id'));}catch{}
    if(existante)afficherDemandeOuverte(existante);else error(e.message||'Impossible d’envoyer la demande.');
   }
   finally{busy=false;b.disabled=false;$('rw-back').disabled=false;b.textContent='Envoyer la demande';}
  });
 }
 window.tasklyRequestWizard={init,open};
})();
