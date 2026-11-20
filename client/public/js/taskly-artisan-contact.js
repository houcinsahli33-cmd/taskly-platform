/* TASKLY_ARTISAN_CONTACT: consultation volontaire, API protegee, aucune coordonnee en cache. */
(() => {
 'use strict';
 const internalMail=/^[a-z0-9._%+-]+@[a-z0-9-]+\.taskly\.test$/i;
 function contactView(c) {
   if(!c || typeof c !== 'object') throw Error('Coordonnées indisponibles.');
   return {
     phone:typeof c.telephone==='string' ? c.telephone.trim().slice(0,100) : '',
     email:typeof c.email==='string' && c.email.length<=254 && internalMail.test(c.email) ? c.email : '',
     chat:Number(c.autoriser_messagerie)===1
   };
 }
 document.addEventListener('DOMContentLoaded',async()=>{
   const byId=id=>document.getElementById(id);
   const trigger=byId('taskly-contact-open'), dialog=byId('taskly-contact-dialog');
   if(!trigger||!dialog)return;
   const id=new URLSearchParams(location.search).get('id');
   if(!id||!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id)))return;
   try{await attendreSession();}catch{return;}
   if(window.utilisateurCourant?.role!=='client')return;
   const phone=byId('taskly-contact-phone'),email=byId('taskly-contact-email'),chat=byId('taskly-contact-chat'),status=byId('taskly-contact-status'),copy=byId('taskly-contact-copy'),close=byId('taskly-contact-close'),data=byId('taskly-contact-data');
   let version=0;
   function clear(){version++;phone.textContent='';email.textContent='';chat.textContent='';status.textContent='';copy.hidden=true;data.hidden=true;}
   function dismiss(){clear();if(dialog.open)dialog.close();}
   trigger.hidden=false;
   trigger.addEventListener('click',async()=>{
     if(dialog.open||window.utilisateurCourant?.role!=='client')return;
     clear();const v=version;dialog.showModal();status.textContent='Chargement des coordonnées autorisées…';
     try{
       const result=await requeteAPI('/api/artisans/'+encodeURIComponent(id)+'/coordonnees',{cache:'no-store'});
       if(v!==version||!dialog.open)return;
       const c=contactView(result.coordonnees);
       phone.textContent=c.phone||'Non partagé';email.textContent=c.email||'Non partagée';
       chat.textContent=c.chat?'Disponible après acceptation de votre demande, selon les autorisations.':'Nouveaux échanges désactivés par cet artisan.';
       copy.hidden=!c.email;data.hidden=false;status.textContent='';
     }catch{if(v===version&&dialog.open)status.textContent='Coordonnées indisponibles. Réessayez après avoir vérifié votre connexion.';}
   });
   close.addEventListener('click',dismiss);
   dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});
   dialog.addEventListener('close',clear);
   window.addEventListener('pagehide',dismiss);
   copy.addEventListener('click',async()=>{
     if(!dialog.open||copy.hidden||!internalMail.test(email.textContent))return;
     const v=version;
     try{await navigator.clipboard.writeText(email.textContent);if(v===version&&dialog.open)status.textContent='Adresse copiée. Utilisez-la dans Taskly Mail.';}
     catch{if(v===version&&dialog.open)status.textContent='Copie automatique indisponible. Sélectionnez et copiez le texte.';}
   });
 });
})();