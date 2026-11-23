'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 const list=document.getElementById('account-spaces-list');
 const status=document.getElementById('account-spaces-status');
 const dialog=document.getElementById('blocked-space-dialog');
 const reason=document.getElementById('blocked-space-reason');
 const support=document.getElementById('blocked-support');
 let blockedAccount=null;
 const ICONS={
  client:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  artisan:'<path d="m5 4 4 4M4 5l4-1 12 12a2 2 0 0 1-3 3L5 7 4 5Zm15-2-5 5m2-6 3-3 2 2-3 3M6 14l-3 3 4 4 3-3"/>'
 };
 function showBlocked(compte){
  blockedAccount=compte;
  reason.textContent=compte.motifBlocage || 'Contactez le support pour connaître le motif.';
  if(typeof dialog.showModal==='function')dialog.showModal();
  else dialog.setAttribute('open','');
 }
 function closeBlocked(){dialog.close?.();dialog.removeAttribute('open');blockedAccount=null;}
 dialog.querySelectorAll('[data-close-blocked]').forEach(el=>el.addEventListener('click',closeBlocked));
 dialog.addEventListener('click',e=>{if(e.target===dialog)closeBlocked();});
 dialog.addEventListener('close',()=>{blockedAccount=null;});
 support.addEventListener('click',async()=>{
  const compte=blockedAccount;
  if(!compte)return;
  if(compte.role==='client'){location.assign('/contact.html');return;}
  support.disabled=true;
  try{
   // Le serveur établit la session limitée au suivi et support.
   const data=await requeteAPI('/api/auth/select-space',{method:'POST',body:JSON.stringify({compteId:compte.id})});
   if(data.supportSeulement){location.replace(data.supportUrl||'/artisan-pending.html');return;}
   // Le blocage peut avoir été levé entre l'affichage et le clic : on ne redirige pas
   // silencieusement vers un espace différent de l'état annoncé.
   closeBlocked();status.textContent='Le statut de cet espace a changé. Reconnectez-vous pour actualiser la liste.';
  }catch(e){status.textContent=e.message||'Impossible de contacter le support depuis cet espace.';closeBlocked();}
  finally{support.disabled=false;}
 });
 try{
  const {comptes}=await requeteAPI('/api/auth/spaces');
  if(!Array.isArray(comptes)||!comptes.length){status.textContent='Aucun espace accessible. Reconnectez-vous.';return;}
  status.textContent='Votre identité est vérifiée. Sélectionnez l’espace à ouvrir.';
  for(const compte of comptes){
   const button=document.createElement('button');button.type='button';button.className='space-option';
   const symbol=document.createElement('span');symbol.className='space-symbol';symbol.setAttribute('aria-hidden','true');
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
   svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.innerHTML=ICONS[compte.role==='client'?'client':'artisan'];symbol.append(svg);
   const info=document.createElement('span');info.className='space-info';
   const title=document.createElement('strong');const detail=document.createElement('small');const arrow=document.createElement('span');arrow.className='space-arrow';
   title.textContent=compte.role==='client'?'Mon espace client':`Artisan — ${compte.metier||'Mon activité'}`;
   const blocked=compte.statut==='Compte bloqué';
   detail.textContent=compte.role==='client'?'Mes demandes, mon profil et le support':compte.statut==='approuve'?'Mon activité, mes demandes et mon profil':'Dossier et suivi auprès du support';
   arrow.textContent='→';arrow.setAttribute('aria-hidden','true');info.append(title,detail);button.append(symbol,info,arrow);list.append(button);
   button.addEventListener('click',async()=>{
    if(blocked){showBlocked(compte);return;}
    list.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Ouverture de votre espace…';
    try{
     const data=await requeteAPI('/api/auth/select-space',{method:'POST',body:JSON.stringify({compteId:compte.id})});
     if(data.supportSeulement){location.replace(data.supportUrl||'/artisan-pending.html');return;}
     const pending=Number(sessionStorage.getItem('tasklyReportPending'));
     if(data.utilisateur.role==='client'&&Number.isSafeInteger(pending)&&pending>0){location.replace('/espace/client/demandes?signaler='+pending);return;}
     location.replace(data.utilisateur.role==='artisan'?'/espace/artisan/accueil':'/espace/client/accueil');
    }catch(e){
     status.textContent=e.message||'Impossible d’ouvrir cet espace.';
     list.querySelectorAll('button').forEach(b=>b.disabled=false);
    }
   });
  }
 }catch(e){status.textContent=e.message||'Reconnectez-vous pour choisir votre espace.';}
});
