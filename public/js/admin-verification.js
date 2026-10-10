let artisansVerification=[];
async function chargerArtisansVerification(){
  const cible=document.getElementById('admin-verification-list');if(!cible)return;
  try{const d=await requeteAPI('/api/admin-verification/artisans');artisansVerification=d.artisans;
    cible.innerHTML=d.artisans.map(a=>`<div class="card mb-16" style="padding:16px">
      <h3>${echapperHTML(a.nom)} ${echapperHTML(a.prenom)}</h3>
      <p class="muted">${echapperHTML(a.service_nom)} · ${echapperHTML(a.ville)} · ${echapperHTML(a.verification_statut)} · ${Number(a.documents_count)} fichier(s)</p>
      <button class="btn outline small" type="button" data-examine-artisan="${Number(a.id)}">Examiner les justificatifs</button>
      </div>`).join('')||'<p>Aucun artisan.</p>';
  }catch(e){cible.textContent=e.message;}
}
async function ouvrirDossierArtisan(id){
  const zone=document.getElementById('admin-verification-details');
  const a=artisansVerification.find(x=>Number(x.id)===Number(id));if(!a)return;
  try{const d=await requeteAPI(`/api/admin-verification/artisans/${id}/documents`);
    zone.innerHTML=`<div class="panel"><div class="panel-header"><h3>Dossier de ${echapperHTML(a.nom)} ${echapperHTML(a.prenom)}</h3></div><div class="panel-body">
    ${d.documents.map(x=>`<p>${echapperHTML(x.type_document)} — <a class="btn outline small" href="/api/admin-verification/documents/${Number(x.id)}">Télécharger le document</a></p>`).join('')||'<p>Aucun justificatif fourni.</p>'}
    <form id="admin-decision-form" class="grid"><input type="hidden" name="id" value="${Number(id)}">
      <label><span class="field-label">Décision</span><select class="form-select" name="statut"><option value="a_completer">Demander un complément</option><option value="approuve">Approuver</option><option value="refuse">Refuser</option></select></label>
      <label><span class="field-label">Motif (obligatoire en cas de refus ou complément)</span><textarea class="form-textarea" name="commentaire" placeholder="Décrivez ce qui a été contrôlé"></textarea></label>
      <button class="btn primary" type="submit">Enregistrer la décision</button></form><p id="admin-decision-info" role="status"></p></div></div>`;
    zone.querySelector('form').addEventListener('submit',async(e)=>{
      e.preventDefault();const f=new FormData(e.currentTarget);try{const r=await requeteAPI(`/api/admin-verification/artisans/${id}/decision`,{method:'PUT',body:JSON.stringify({statut:f.get('statut'),commentaire:f.get('commentaire')})});
        zone.querySelector('#admin-decision-info').textContent=r.message;await chargerArtisansVerification();}
      catch(err){zone.querySelector('#admin-decision-info').textContent=err.message;}
    });
  }catch(e){zone.textContent=e.message;}
}
document.addEventListener('DOMContentLoaded',async()=>{
  await (window.tasklyAuthReady||Promise.resolve());if(window.utilisateurCourant?.role!=='admin')return;
  await chargerArtisansVerification();
  document.getElementById('admin-verification-list')?.addEventListener('click',e=>{
    const b=e.target.closest('[data-examine-artisan]');if(b)ouvrirDossierArtisan(b.dataset.examineArtisan);
  });
});
