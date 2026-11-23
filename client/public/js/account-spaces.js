'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 const list=document.getElementById('account-spaces-list');
 const status=document.getElementById('account-spaces-status');
 const dialog=document.getElementById('blocked-space-dialog');
 const reason=document.getElementById('blocked-space-reason');
 const support=document.getElementById('blocked-support');
 let blockedAccount=null;
 const ICON_FILES={client:'/images/icons/taskly-client-valide.svg',artisan:'/images/icons/taskly-artisan-valide.svg'};
 function showBlocked(compte){
  blockedAccount=compte;
  reason.textContent=compte.motifBlocage || 'Contactez le support pour connaître le motif.';
  if(!dialog.open && typeof dialog.showModal==='function')dialog.showModal();
  else dialog.setAttribute('open','');
 }
 function closeBlocked(){if(dialog.open && typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');blockedAccount=null;}
 dialog.querySelectorAll('[data-close-blocked]').forEach(el=>el.addEventListener('click',closeBlocked));
 dialog.addEventListener('click',e=>{if(e.target===dialog)closeBlocked();});
 dialog.addEventListener('close',()=>{blockedAccount=null;});
 support.addEventListener('click',async()=>{
  const compte=blockedAccount;
  if(!compte)return;
  // Le formulaire de contact enregistre une demande dans contacts_support, visible par l'administration.
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
   const img=document.createElement('img');img.src=ICONS_FILES[compte.role==='client'?'client':'artisan'];img.alt='';img.decoding='async';symbol.append(img);
   const info=document.createElement('span');info.className='space-info';
   const title=document.createElement('strong');const detail=document.createElement('small');const arrow=document.createElement('span');arrow.className='space-arrow';
   title.textContent=compte.role==='client'?'Mon espace client':`Artisan — ${compte.metier||'Mon activité'}`;
   const blocked=compte.statut==='Compte bloqué';
   detail.textContent=compte.role==='client'?'Mes demandes, mon profil et le support':compte.statut==='approuve'?'Mon activité, mes demandes et mon profil':'Dossier et suivi auprès du support';
   arrow.textContent='→';arrow.setAttribute('aria-hidden','true');info.append(title,detail);button.append(symbol,info,arrow);list.append(button);
   button.addEventListener('click',async()=>{
    list.querySelectorAll('button').forEach(b=>b.disabled=true);
    status.textContent=blocked?'Vérification du statut de cet espace…':'Ouverture de votre espace…';
    try{
     // Une décision administrative peut avoir changé depuis le chargement de la liste.
     // Le serveur reste la seule source de vérité avant tout accès à l'espace.
     const etat=await requeteAPI('/api/auth/spaces');
     const courant=Array.isArray(etat.comptes)?etat.comptes.find(c=>Number(c.id)===Number(compte.id)):null;
     if(!courant){status.textContent='Cet espace n’est plus accessible. Reconnectez-vous.';return;}
     if(courant.statut==='Compte bloqué'){
      status.textContent='Votre identité est vérifiée. Sélectionnez l’espace à ouvrir.';
      showBlocked(courant);return;
     }
     if(blocked){status.textContent='Le statut de cet espace a changé. Actualisez la page pour mettre à jour vos espaces.';return;}
     const data=await requeteAPI('/api/auth/select-space',{method:'POST',body:JSON.stringify({compteId:compte.id})});
     if(data.supportSeulement){location.replace(data.supportUrl||'/artisan-pending.html');return;}
     const pending=Number(sessionStorage.getItem('tasklyReportPending'));
     if(data.utilisateur.role==='client'&&Number.isSafeInteger(pending)&&pending>0){location.replace('/espace/client/demandes?signaler='+pending);return;}
     location.replace(data.utilisateur.role==='artisan'?'/espace/artisan/accueil':'/espace/client/accueil');
    }catch(e){
     if(e.status===403 && e.data?.statut==='Compte bloqué'){
      showBlocked({...compte,statut:'Compte bloqué',motifBlocage:e.data.motifBlocage||null});
      status.textContent='Votre identité est vérifiée. Sélectionnez l’espace à ouvrir.';
     }else{
      status.textContent=e.message||'Impossible d’ouvrir cet espace.';
     }
    }finally{
     list.querySelectorAll('button').forEach(b=>b.disabled=false);
    }
   });
  }
 }catch(e){status.textContent=e.message||'Reconnectez-vous pour choisir votre espace.';}
});
