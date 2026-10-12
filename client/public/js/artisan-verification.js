async function chargerStatutVerification(){
  const cible=document.getElementById('artisan-verification-status');if(!cible)return;
  try{const d=await requeteAPI('/api/artisan-verification/status');
    const statuts={en_attente:'En attente de controle',a_completer:'Documents complementaires demandes',approuve:'Profil approuve',refuse:'Dossier refuse'};
    cible.textContent=`Statut : ${statuts[d.statut]||d.statut}${d.commentaire?' — '+d.commentaire:''}`;
    const liste=document.getElementById('artisan-documents-list');
    liste.innerHTML=d.documents.length?d.documents.map(doc=>{
      const id=Number(doc.id),safe=echapperHTML;
      if(!Number.isSafeInteger(id)||id<=0)return '';
      const voir=['application/pdf','image/jpeg','image/png'].includes(doc.media_type);
      return `<article class="artisan-document"><div><strong>${safe(doc.original_name||'Justificatif')}</strong><small>${safe(doc.type_document||'Document')}</small></div><div class="artisan-document-actions">${voir?`<a class="btn outline" href="/api/artisan-verification/documents/${id}?afficher=1" target="_blank" rel="noopener noreferrer">Voir ↗</a>`:''}<a class="btn outline" href="/api/artisan-verification/documents/${id}">Télécharger</a></div></article>`;
    }).join(''):'Aucun document reçu.';
    document.getElementById('artisan-document-form').hidden=d.statut==='approuve';
    const aide=document.getElementById('artisan-verification-help');
    if(aide)aide.textContent=d.statut==='approuve'
      ? 'Votre dossier est approuvé. Vous pouvez consulter et télécharger vos justificatifs. Le dépôt de nouvelles pièces reste réservé aux dossiers en cours d’examen.'
      : 'Consultez vos pièces ou déposez un nouveau justificatif pour compléter votre dossier. Les fichiers restent privés et sont examinés par un administrateur.';
  }catch(e){cible.textContent=e.message;}
}
document.addEventListener('DOMContentLoaded',async()=>{
  await (window.tasklyAuthReady||Promise.resolve());if(window.utilisateurCourant?.role!=='artisan'||!document.getElementById('artisan-verification-panel'))return;
  await chargerStatutVerification();
  document.getElementById('artisan-document-form')?.addEventListener('submit',async(e)=>{
    e.preventDefault();const info=document.getElementById('artisan-document-message');
    const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;
    try{const d=await requeteAPI('/api/artisan-verification/documents',{method:'POST',body:new FormData(form)});info.textContent=d.message;form.reset();await chargerStatutVerification();}
    catch(err){info.textContent=err.message;}finally{button.disabled=false;}
  });
});
