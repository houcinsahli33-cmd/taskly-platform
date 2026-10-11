'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 const list=document.getElementById('account-spaces-list'),status=document.getElementById('account-spaces-status');
 try{
  const {comptes}=await requeteAPI('/api/auth/spaces');
  if(!comptes.length){status.textContent='Aucun espace accessible. Reconnectez-vous.';return;}
  status.textContent='Votre identité est vérifiée. Sélectionnez l’espace à ouvrir.';
  for(const compte of comptes){
   const button=document.createElement('button');button.type='button';button.className='space-option';
   const symbol=document.createElement('span');symbol.className='space-symbol';symbol.textContent=compte.role==='client'?'♙':'⚒';symbol.setAttribute('aria-hidden','true');
   const text=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small'),arrow=document.createElement('span');
   title.textContent=compte.role==='client'?'Mon espace client':`Artisan — ${compte.metier||'Mon activité'}`;
   detail.textContent=compte.role==='client'?'Mes demandes, mon profil et le support':compte.statut==='approuve'?'Mon activité, mes demandes et mon profil':'Dossier et suivi auprès du support';
   arrow.textContent='→';arrow.setAttribute('aria-hidden','true');text.append(title,detail);button.append(symbol,text,arrow);list.append(button);
   button.addEventListener('click',async()=>{
    list.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Ouverture de votre espace…';
    try{
     const data=await requeteAPI('/api/auth/select-space',{method:'POST',body:JSON.stringify({compteId:compte.id})});
     if(data.supportSeulement){location.replace('/artisan-pending.html');return;}
     location.replace(data.utilisateur.role==='artisan'?'/espace/artisan/accueil':'/espace/client/accueil');
    }catch(e){status.textContent=e.message;list.querySelectorAll('button').forEach(b=>b.disabled=false);}
   });
  }
 }catch(e){status.textContent=e.message||'Reconnectez-vous pour choisir votre espace.';}
});
