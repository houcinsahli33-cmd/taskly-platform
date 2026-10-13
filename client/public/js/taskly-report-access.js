'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 const id=Number(new URLSearchParams(location.search).get('demande'));
 const state=document.getElementById('taskly-report-state'),lien=document.getElementById('taskly-report-login');
 if(!Number.isSafeInteger(id)||id<=0){state.textContent='Lien incomplet ou invalide.';lien.hidden=true;return;}
 const destination='/espace/client/demandes?signaler='+id;
 lien.href='/login.html?redirect='+encodeURIComponent(destination);
 sessionStorage.setItem('tasklyReportPending',String(id));
 try{
  const data=await requeteAPI('/api/auth/me');
  if(data.utilisateur?.role==='client'){location.replace(destination);return;}
  state.textContent='Connectez-vous avec le compte client associé à la demande.';
 }catch{state.textContent='Connexion requise pour consulter et signaler cette demande.';}
});
