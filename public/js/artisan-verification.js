async function chargerStatutVerification(){
  const cible=document.getElementById('artisan-verification-status');if(!cible)return;
  try{const d=await requeteAPI('/api/artisan-verification/status');
    const statuts={en_attente:'En attente de controle',a_completer:'Documents complementaires demandes',approuve:'Profil approuve',refuse:'Dossier refuse'};
    cible.textContent=`Statut : ${statuts[d.statut]||d.statut}${d.commentaire?' — '+d.commentaire:''}`;
    document.getElementById('artisan-documents-list').textContent=d.documents.length?`${d.documents.length} document(s) recu(s) : ${d.documents.map(x=>x.type_document).join(', ')}`:'Aucun document recu.';
    document.getElementById('artisan-document-form').hidden=d.statut==='approuve';
  }catch(e){cible.textContent=e.message;}
}
document.addEventListener('DOMContentLoaded',async()=>{
  await (window.tasklyAuthReady||Promise.resolve());if(window.utilisateurCourant?.role!=='artisan')return;
  await chargerStatutVerification();
  document.getElementById('artisan-document-form')?.addEventListener('submit',async(e)=>{
    e.preventDefault();const info=document.getElementById('artisan-document-message');
    const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;
    try{const d=await requeteAPI('/api/artisan-verification/documents',{method:'POST',body:new FormData(form)});info.textContent=d.message;form.reset();await chargerStatutVerification();}
    catch(err){info.textContent=err.message;}finally{button.disabled=false;}
  });
});
