/* Justificatifs professionnels : consultation, telechargement, ajout ou remplacement. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const noms={identite:'Pièce d’identité',diplome:'Diplôme',certificat:'Certificat',qualification:'Qualification professionnelle'};
  function afficherDocuments(documents) {
    const cible=$('artisan-documents-list');if(!cible)return;
    cible.replaceChildren();
    if(!documents?.length){cible.textContent='Aucun justificatif reçu.';return;}
    const titre=document.createElement('h3');titre.textContent='Documents déposés';cible.append(titre);
    for(const d of documents){
      const id=Number(d.id);
      if(!Number.isSafeInteger(id)||id<1)continue;
      const ligne=document.createElement('div');ligne.className='artisan-document';
      const infos=document.createElement('div');
      const nom=document.createElement('strong');nom.textContent=noms[d.type_document]||d.type_document||'Justificatif';
      const fichier=document.createElement('small');fichier.textContent=d.original_name||`Document n°${id}`;
      infos.append(nom,fichier);
      const actions=document.createElement('div');actions.className='artisan-document-actions';
      function lien(texte,afficher){
        const a=document.createElement('a');a.className='btn outline';
        a.textContent=texte;a.href=`/api/artisan-verification/documents/${id}`+(afficher?'?afficher=1':'');
        if(afficher){a.target='_blank';a.rel='noopener noreferrer';}return a;
      }
      if(['application/pdf','image/jpeg','image/png'].includes(d.media_type))actions.append(lien('Voir ↗',true));
      actions.append(lien('Télécharger',false));
      const remplacer=document.createElement('button');remplacer.type='button';remplacer.className='btn outline';remplacer.textContent='Remplacer';
      remplacer.addEventListener('click',()=>{
        const form=$('artisan-document-form');
        const champ=$('artisan-document-replace-id');
        const select=form.querySelector('[name="type_document"]');
        const bouton=form.querySelector('button[type="submit"]');
        champ.value=String(id);if(noms[d.type_document])select.value=d.type_document;
        bouton.textContent='Envoyer le remplacement';
        $('artisan-document-cancel-replace').hidden=false;
        $('artisan-document-message').textContent=`Remplacement de : ${d.original_name||nom.textContent}. Sélectionnez le nouveau fichier puis confirmez.`;
        form.querySelector('[name="document"]').focus();
      });
      actions.append(remplacer);ligne.append(infos,actions);cible.append(ligne);
    }
  }
  function resetRemplacement(){
    $('artisan-document-replace-id').value='';
    $('artisan-document-cancel-replace').hidden=true;
    $('artisan-document-form').querySelector('button[type="submit"]').textContent='Ajouter ce justificatif';
  }
  async function actualiser() {
    const cible=$('artisan-verification-status');
    try {
      const d=await requeteAPI('/api/artisan-verification/status');
      const libelles={en_attente:'En attente de contrôle',a_completer:'Documents complémentaires demandés',approuve:'Profil approuvé',refuse:'Dossier refusé'};
      cible.textContent=`Statut : ${libelles[d.statut]||d.statut}${d.commentaire?' — '+d.commentaire:''}`;
      afficherDocuments(d.documents);
      $('artisan-document-form').hidden=false;
    } catch(e){cible.textContent=e.message;}
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    await (window.tasklyAuthReady||Promise.resolve());
    if(window.utilisateurCourant?.role!=='artisan'||!$('artisan-verification-panel'))return;
    $('artisan-document-cancel-replace').addEventListener('click',()=>{
      resetRemplacement();$('artisan-document-message').textContent='Ajout d’un nouveau justificatif.';
    });
    $('artisan-document-form').addEventListener('submit',async(e)=>{
      e.preventDefault();
      const form=e.currentTarget,button=form.querySelector('button[type="submit"]');
      if(button.disabled)return;button.disabled=true;
      const info=$('artisan-document-message');
      try{
        const data=await requeteAPI('/api/artisan-verification/documents',{method:'POST',body:new FormData(form)});
        form.reset();resetRemplacement();info.textContent=data.message;
        if(data.nouvelleVerification){
          $('artisan-verification-status').textContent='Statut : En attente de contrôle administratif';
          info.textContent+=' Votre espace artisan sera limité pendant cet examen ; reconnectez-vous pour suivre votre dossier.';
        }else {await actualiser();info.textContent=data.message;}
      } catch(err){info.textContent=err.message;}finally{button.disabled=false;}
    });
    await actualiser();
  });
})();
