'use strict';
document.addEventListener('DOMContentLoaded',()=>{
 const search=new URLSearchParams(location.search),token=new URLSearchParams(location.hash.slice(1)).get('token');
 const id=Number(search.get('demande'));
 const state=document.getElementById('taskly-confirm-result'),btn=document.getElementById('taskly-confirm-button');
 const notDone=document.getElementById('taskly-not-done');
 if(Number.isSafeInteger(id)&&id>0)notDone.href='/signalement-prestation.html?demande='+id;
 else notDone.hidden=true;
 // Ne pas conserver le secret dans l'URL après lecture.
 history.replaceState(null,'',location.pathname);
 if(!/^[a-f0-9]{64}$/.test(token||'')){btn.disabled=true;state.textContent='Lien de confirmation manquant ou invalide.';return;}
 btn.addEventListener('click',async()=>{
  btn.disabled=true;state.textContent='Vérification de votre confirmation…';
  try{const data=await requeteAPI('/api/demandes/confirmation-lien',{method:'POST',body:JSON.stringify({token})});
   state.textContent=data.message;btn.hidden=true;
  }catch(err){state.textContent=err.message||'Le lien ne peut pas être utilisé.';}
 });
});
