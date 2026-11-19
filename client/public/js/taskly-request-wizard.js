'use strict';
/* Demande en trois étapes. Même API, mêmes contrôles serveur et CSRF. */
(function(){
 const $=id=>document.getElementById(id);
 let step=0, busy=false, initialized=false, previousFocus=null;
 const dialog=()=>$('request-modal'), form=()=>$('request-form');
 const val=id=>$(id).value.trim();
 function error(text,field){const e=$('rw-error');e.textContent=text;e.hidden=!text;if(field)field.focus();return false;}
 function message(){const type=form().querySelector('[name="rw-type"]:checked')?.value;return (type?'Type d’intervention : '+type+'\n':'')+val('request-message');}
 function summary(){ $('rw-summary-message').textContent=message(); $('rw-summary-address').textContent=val('request-address'); $('rw-summary-date').textContent=val('request-date')||'À convenir'; }
 function render(){
  form().querySelectorAll('[data-rw-panel]').forEach(p=>p.hidden=Number(p.dataset.rwPanel)!==step);
  dialog().querySelectorAll('[data-rw-step]').forEach(p=>{const n=Number(p.dataset.rwStep);p.classList.toggle('done',n<step);if(n===step)p.setAttribute('aria-current','step');else p.removeAttribute('aria-current');});
  $('rw-back').hidden=step===0;$('rw-next').hidden=step===2;$('rw-submit').hidden=step!==2;
  $('rw-count').textContent=$('request-message').value.length+' / 500';summary();error('');
 }
 function validate(n){
  if(n===0&&(!val('request-message')||val('request-message').length>500))return error('Décrivez votre besoin (500 caractères maximum).',$('request-message'));
  if(n===1&&(!val('request-address')||val('request-address').length>255))return error('Indiquez une adresse valide (255 caractères maximum).',$('request-address'));
  if(n===2&&typeof window.tasklyRequestDateValide==='function'&&!window.tasklyRequestDateValide())return error('Choisissez une date disponible ou retirez la date.',$('request-date'));
  return true;
 }
 function close(){if(busy)return;dialog().close();}
 function open(artisan){
  if(!initialized)init();if(!initialized||dialog().open||busy)return;
  previousFocus=document.activeElement;form().reset();step=0;form().hidden=false;$('rw-success').hidden=true;
  $('request-artisan-id').value=String(artisan.id);$('request-artisan-name').textContent=nomComplet(artisan);
  $('request-artisan-photo').src=imageProfil(artisan.photo_profil);
  $('rw-new').hidden=artisan.moyenne_notes==null||Number(artisan.moyenne_notes)>0;
  $('request-artisan-service').textContent=[artisan.service_nom,artisan.ville].filter(Boolean).join(' · ');
  $('request-artisan-experience').textContent=Number(artisan.experience||0)+' an(s) d’expérience';
  const missions=$('request-artisan-missions');missions.hidden=artisan.total_demandes==null;missions.textContent=Number(artisan.total_demandes||0)+' mission(s)';
  $('request-artisan-description').textContent=artisan.description||'Aucune description détaillée pour le moment.';
  render();dialog().showModal();document.body.classList.add('no-scroll');$('request-message').focus();
 }
 function init(){
  if(initialized||!dialog()||!form())return;initialized=true;
  $('request-artisan-photo').addEventListener('error',e=>{if(!e.target.src.endsWith(DEFAULT_AVATAR))e.target.src=DEFAULT_AVATAR;});
  dialog().querySelectorAll('[data-rw-close]').forEach(b=>b.addEventListener('click',close));
  dialog().addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  dialog().addEventListener('close',()=>{document.body.classList.remove('no-scroll');previousFocus?.focus();});
  $('request-message').addEventListener('input',()=>{$('rw-count').textContent=$('request-message').value.length+' / 500';if(val('request-message'))error('');});
  $('request-address').addEventListener('input',()=>{if(val('request-address'))error('');});
  $('request-date').addEventListener('change',summary);
  $('rw-date-clear').addEventListener('click',()=>{$('request-date').value='';summary();error('');});
  $('rw-back').addEventListener('click',()=>{if(!busy&&step>0){step--;render();$(step===0?'request-message':'request-address').focus();}});
  $('rw-next').addEventListener('click',()=>{if(!busy&&step<2&&validate(step)){step++;render();$(step===1?'request-address':'request-date').focus();}});
  form().addEventListener('submit',async e=>{
   e.preventDefault();if(busy||step!==2)return;
   for(let n=0;n<3;n++){if(n===2&&!validate(n))return;if(n<2&&!(n===0?val('request-message')&&val('request-message').length<=500:val('request-address')&&val('request-address').length<=255)){step=n;render();validate(n);return;}}
   busy=true;const b=$('rw-submit');b.disabled=true;$('rw-back').disabled=true;b.textContent='Envoi en cours…';error('');
   try{
    await requeteAPI('/api/demandes',{method:'POST',body:JSON.stringify({artisanId:Number(val('request-artisan-id')),message:message(),adresse:val('request-address'),dateSouhaitee:val('request-date')||null})});
    form().hidden=true;$('rw-success').hidden=false;$('rw-success').querySelector('a').focus();
   }catch(e){error(e.message||'Impossible d’envoyer la demande.');}
   finally{busy=false;b.disabled=false;$('rw-back').disabled=false;b.textContent='Envoyer la demande';}
  });
 }
 window.tasklyRequestWizard={init,open};
})();
