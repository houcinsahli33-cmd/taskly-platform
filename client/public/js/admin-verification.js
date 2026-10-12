'use strict';
// Page dédiée : données, filtres et décisions proviennent uniquement des routes admin privées.
let artisansVerification = [];
let pageVerification = 1;
let requeteVerificationNumero = 0;
let dossierActifId = null;
let examenNumero = 0;
let declencheurExamen = null;
const DOSSIERS_PAR_PAGE = 8;
const verificationLabel = statut => ({
  en_attente:'En attente', a_completer:'Complément demandé', approuve:'Validé', refuse:'Refusé'
})[statut] || statut || 'Non renseigné';
const hVerification = valeur => echapperHTML(valeur ?? '');
const dateVerification = valeur => {
  if (!valeur) return 'Non renseignée';
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? 'Non renseignée' : date.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
};
const initialesVerification = artisan => {
  const prenom = String(artisan.prenom || '').trim();
  const nom = String(artisan.nom || '').trim();
  return (prenom.slice(0,1)+nom.slice(0,1)).toUpperCase() || 'A';
};
function ligneHistorique(h) {
  const safe = echapperHTML;
  return `<li class="review-history-item"><strong>${safe(verificationLabel(h.nouveau_statut))}</strong>
    <span> — ${safe(formatDateHeure(h.created_at))}</span>
    <p>Par ${safe([h.admin_prenom,h.admin_nom].filter(Boolean).join(' ') || 'Administrateur')}</p>
    ${h.commentaire ? `<p class="muted">${safe(h.commentaire)}</p>` : ''}</li>`;
}
function selectionnerFiltreVerification(statut) {
  const select = document.getElementById('admin-verification-status');
  if (select) select.value = statut;
  document.querySelectorAll?.('[data-verify-filter]').forEach(b => {
    const actif = b.dataset.verifyFilter === statut;
    b.classList.toggle('is-active',actif);
    b.setAttribute('aria-pressed',String(actif));
  });
  document.querySelectorAll?.('[data-verify-stat]').forEach(b => {
    const actif = b.dataset.verifyStat === statut || (b.dataset.verifyStat === 'examines' && statut === 'examines');
    b.classList.toggle('is-active',actif);
    b.setAttribute('aria-pressed',String(actif));
  });
}
function paginationVerification(page,pages) {
  const index = new Set([1, pages, page-1, page, page+1]);
  const choix = Array.from(index).filter(n=>n>=1&&n<=pages).sort((a,b)=>a-b);
  let precedent = 0;
  const boutons = choix.map(n=>{
    const points = n-precedent>1 ? '<span aria-hidden="true">…</span>' : '';
    precedent = n;
    return points+`<button type="button" data-review-page="${n}" ${n===page?'class="is-active" aria-current="page"':''} aria-label="Page ${n}">${n}</button>`;
  }).join('');
  return `<button type="button" data-review-page="${page-1}" ${page<=1?'disabled':''} aria-label="Page précédente">‹</button>${boutons}<button type="button" data-review-page="${page+1}" ${page>=pages?'disabled':''} aria-label="Page suivante">›</button>`;
}
function ligneArtisanVerification(a,index) {
  const safe=hVerification, id=Number(a.id), statut=a.verification_statut;
  const compteBloque=a.statut_compte==='bloque';
  const statutAffiche=compteBloque?'Compte bloqué':verificationLabel(statut);
  const statutClasse=compteBloque?'bloque':statut;
  const compteDocs=Number(a.documents_count || 0);
  return `<tr class="admin-review-card" data-artisan-id="${id}">
    <td><div class="verify-person"><span class="verify-avatar color-${index%5}" aria-hidden="true">${safe(initialesVerification(a))}</span><span><strong>${safe(nomComplet(a))}</strong><small>Inscrit le ${safe(dateVerification(a.date_inscription || a.created_at))}</small></span></div></td>
    <td><span class="verify-activity"><strong>${safe(a.service_nom || 'Métier non renseigné')}</strong><small>${safe(a.ville || 'Ville non renseignée')}</small></span></td>
    <td><span class="verify-docs"><strong>${compteDocs} document${compteDocs>1?'s':''} reçu${compteDocs>1?'s':''}</strong><small>${compteDocs?'À contrôler':'Aucun justificatif'}</small></span></td>
    <td><span class="verify-badge ${safe(statutClasse)}">${safe(statutAffiche)}</span></td>
    <td><button class="verify-examine" type="button" data-examine-artisan="${id}">${['approuve','refuse'].includes(statut)?'Consulter le dossier':'Examiner le dossier'}</button></td>
  </tr>`;
}
async function chargerArtisansVerification(page=pageVerification) {
  const target=document.getElementById('admin-verification-list');
  if (!target) return;
  const numero=++requeteVerificationNumero;
  const recherche=String(document.getElementById('admin-verification-search')?.value || '').trim();
  const statut=document.getElementById('admin-verification-status')?.value || 'tous';
  const tri=document.getElementById('admin-verification-sort')?.value || 'recent';
  const params=new URLSearchParams({page:String(page),limite:String(DOSSIERS_PAR_PAGE),statut,tri});
  if (recherche) params.set('recherche',recherche);
  target.innerHTML='<tr><td colspan="5" class="verify-empty">Chargement des dossiers…</td></tr>';
  try {
    const data=await requeteAPI(`/api/admin-verification/artisans?${params}`);
    if (numero!==requeteVerificationNumero) return;
    artisansVerification=Array.isArray(data.artisans)?data.artisans:[];
    pageVerification=Number(data.page)||1;
    const total=Number(data.total || 0), pages=Math.max(1,Number(data.pages)||1);
    const counters=data.comptes||{};
    const champs=[['verify-total','total'],['verify-pending','en_attente'],['verify-complement','a_completer']];
    for (const [id,cle] of champs) {
      const node=document.getElementById(id);
      if (node) node.textContent=counters[cle]!=null?String(Number(counters[cle])):'—';
    }
    const examines=document.getElementById('verify-reviewed');
    if (examines) examines.textContent=counters.approuve!=null&&counters.refuse!=null?String(Number(counters.approuve)+Number(counters.refuse)):'—';
    const tag=document.getElementById('verify-total-tag');
    if (tag) tag.textContent=counters.total!=null?`${Number(counters.total)} dossiers`:'— dossiers';
    const count=document.getElementById('admin-verification-counts');
    if (count) count.textContent=`${total} résultat(s) · Affichage de ${total?(pageVerification-1)*DOSSIERS_PAR_PAGE+1:0} à ${Math.min(pageVerification*DOSSIERS_PAR_PAGE,total)} sur ${total} dossiers · page ${pageVerification} sur ${pages}`;
    target.innerHTML=artisansVerification.map(ligneArtisanVerification).join('') || '<tr><td colspan="5" class="verify-empty">Aucun artisan pour ces critères.</td></tr>';
    const pagination=document.getElementById('admin-verification-pagination');
    if (pagination) pagination.innerHTML=paginationVerification(pageVerification,pages);
    selectionnerFiltreVerification(statut);
  } catch (e) {
    if (numero!==requeteVerificationNumero) return;
    target.innerHTML='<tr><td colspan="5" class="verify-empty">Dossiers temporairement indisponibles. Utilisez « Actualiser » pour réessayer.</td></tr>';
    const count=document.getElementById('admin-verification-counts');
    if(count) count.textContent='Impossible de charger les dossiers : '+(e.message||'Erreur serveur');
  }
}
function fermerDossierArtisan() {
  examenNumero++;
  dossierActifId=null;
  const zone=document.getElementById('admin-verification-details');
  if(!zone)return;
  zone.hidden=true;
  zone.innerHTML='';
  document.body?.classList.remove('admin-review-open');
  (declencheurExamen || document.getElementById('admin-verification-list')?.querySelector('[data-examine-artisan]'))?.focus?.();
  declencheurExamen=null;
}
function ouvrirFenetreExamen(artisan) {
  const zone=document.getElementById('admin-verification-details');
  if(!zone)throw new Error('Fenêtre de vérification introuvable. Actualisez la page.');
  zone.hidden=false;
  document.body?.classList.add('admin-review-open');
  const bloque=artisan.statut_compte==='bloque';
  zone.innerHTML=`<div class="admin-review-backdrop" data-close-review="1"></div>
    <section role="dialog" aria-modal="true" aria-labelledby="admin-review-title" class="admin-review-dialog">
      <header class="admin-review-dialog-header"><div><p class="verify-eyebrow">VÉRIFICATION PRIVÉE · DOSSIER #ART-${String(artisan.id).padStart(3,'0')}</p>
      <div class="verify-dialog-heading"><span class="verify-modal-avatar">${hVerification(initialesVerification(artisan))}</span><div><h2 id="admin-review-title">Dossier de ${hVerification(nomComplet(artisan))}</h2>
      <p>${hVerification(artisan.service_nom)} · ${hVerification(artisan.ville)} &nbsp; · &nbsp; ${bloque?'Compte bloqué':'Compte '+hVerification(artisan.statut_compte||'inconnu')} &nbsp; · &nbsp; ${hVerification(verificationLabel(artisan.verification_statut))}</p></div></div></div>
      <button type="button" class="verify-header-close" data-close-review="1" aria-label="Fermer le dossier">×</button></header>
      <div id="admin-review-content" class="admin-review-dialog-content" role="status" aria-live="polite">Chargement des pièces et de l’historique…</div>
    </section>`;
  zone.querySelector('button[data-close-review]')?.focus?.();
  return zone;
}
function emailMasqueVerification(email) {
  const valeur=String(email||'');
  const ix=valeur.indexOf('@');
  return ix<0?'Non renseigné':valeur.slice(0,1)+'••••••'+valeur.slice(ix);
}
async function ouvrirDossierArtisan(id,donneesArtisan=null) {
  id=Number(id);
  const artisan=donneesArtisan||artisansVerification.find(a=>Number(a.id)===id);
  if(!Number.isSafeInteger(id)||id<=0||!artisan){
    if(typeof afficherToast==='function')afficherToast('Dossier introuvable : actualisez la liste.','error');
    return;
  }
  dossierActifId=id;
  const numero=++examenNumero;
  const zone=ouvrirFenetreExamen(artisan); // Le dialogue apparaît avant toute réponse réseau.
  const cible=zone.querySelector('#admin-review-content');
  try {
    const data=await requeteAPI(`/api/admin-verification/artisans/${id}/documents`);
    if(numero!==examenNumero||dossierActifId!==id)return;
    const safe=hVerification;
    const documents=Array.isArray(data.documents)?data.documents:[];
    const support=Array.isArray(data.support)?data.support:[];
    const historique=Array.isArray(data.historique)?data.historique:[];
    const notifications=Array.isArray(data.notifications)?data.notifications:[];
    const docList=documents.map(d=>{
      const did=Number(d.id);
      const type=String(d.media_type||'');
      const preview=type==='application/pdf'||type==='image/png'||type==='image/jpeg';
      return `<div class="verify-document"><span class="verify-document-icon">${type==='application/pdf'?'PDF':'DOC'}</span><div class="verify-document-desc"><strong>${safe(d.original_name||'Justificatif')}</strong><small>${safe(d.type_document||'Document')} · ${safe(dateVerification(d.created_at))}</small></div><div class="verify-document-actions">
      ${preview?`<a href="/api/admin-verification/documents/${did}?afficher=1" target="_blank" rel="noopener noreferrer" aria-label="Voir ${safe(d.original_name||'le document')}">Voir</a>`:''}
      <a href="/api/admin-verification/documents/${did}" aria-label="Télécharger ${safe(d.original_name||'le document')}">Télécharger</a></div></div>`;
    }).join('');
    const peutDecider=artisan.statut_compte!=='bloque'||artisan.verification_statut==='refuse';
    cible.removeAttribute('role');
    cible.innerHTML=`<div class="admin-review-layout">
      <div class="admin-review-evidence">
        <section><h3>Identité et activité</h3><dl class="verify-details-grid">
          <div><dt>Nom et prénom</dt><dd>${safe(nomComplet(artisan))}</dd></div>
          <div><dt>Adresse e-mail</dt><dd title="Adresse masquée">${safe(emailMasqueVerification(artisan.email))}</dd></div>
          <div><dt>Métier déclaré</dt><dd>${safe(artisan.service_nom||'Non renseigné')}</dd></div>
          <div><dt>Ville</dt><dd>${safe(artisan.ville||'Non renseignée')}</dd></div>
          <div><dt>Expérience déclarée</dt><dd>${Number(artisan.experience)||0} an(s)</dd></div>
          <div><dt>Date d'inscription</dt><dd>${safe(dateVerification(artisan.date_inscription||artisan.created_at))}</dd></div>
          <div><dt>Téléphone</dt><dd>${safe(artisan.telephone||'Non renseigné')}</dd></div>
          <div><dt>État du compte</dt><dd>${safe(artisan.statut_compte||'Non renseigné')}</dd></div>
        </dl>${artisan.description?`<p>${safe(artisan.description)}</p>`:''}${artisan.verification_commentaire?`<p>Dernier motif : ${safe(artisan.verification_commentaire)}</p>`:''}</section>
        <section><h3>Diplômes et justificatifs <small> · ${documents.length} document${documents.length>1?'s':''} reçu${documents.length>1?'s':''}</small></h3>
          ${docList||'<p>Aucun justificatif transmis : validation impossible.</p>'}
          <p class="verify-note">ⓘ Cette vérification est documentaire et manuelle. Elle ne constitue pas une certification officielle du diplôme ni de l'identité.</p>
        </section>
        <section><h3>Historique des décisions</h3><ol class="admin-review-history">${historique.map(ligneHistorique).join('')||'<li>Aucune décision antérieure sur ce dossier.</li>'}</ol></section>
        ${support.length?`<section><h3>Support associé</h3>${support.map(s=>`<article class="review-support"><strong>Message #${Number(s.id)} · ${safe(dateVerification(s.created_at))}</strong><p style="white-space:pre-wrap">${safe(s.message)}</p><small>${safe(s.statut)}</small></article>`).join('')}</section>`:''}
      </div>
      <aside class="admin-review-decision"><h3>Décision administrative</h3><p>Choisissez la suite à donner après l'examen des justificatifs.</p>
        <form id="admin-decision-form" class="verify-decision-form">
          <label class="verify-decision-option" data-option="approuve"><input type="radio" name="statut" value="approuve"><span><strong>✓ Valider le dossier</strong><small>Justificatifs examinés et acceptés · donne l'accès artisan</small></span></label>
          <label class="verify-decision-option" data-option="a_completer"><input type="radio" name="statut" value="a_completer" checked><span><strong>◷ Demander un complément</strong><small>Informations ou documents manquants</small></span></label>
          <label class="verify-decision-option" data-option="refuse"><input type="radio" name="statut" value="refuse"><span><strong>× Refuser le dossier</strong><small>Pièces insuffisantes ou non conformes · bloque le compte</small></span></label>
          <label class="verify-comment-label" for="admin-decision-comment">Motif de la décision <span>· obligatoire pour refus ou complément</span>
            <textarea id="admin-decision-comment" name="commentaire" maxlength="500" placeholder="Expliquez les documents à fournir ou la raison du refus..."></textarea></label>
          <label class="verify-notify-label"><input type="checkbox" name="notifier" checked>Informer l'artisan par e-mail</label>
          ${!peutDecider?'<p>Ce compte est bloqué. Consultez son historique avant toute nouvelle décision.</p>':''}
          <button class="verify-submit" type="submit">Confirmer la décision</button>
          <p class="verify-modal-status" id="admin-decision-info" role="status" aria-live="polite">La décision sera enregistrée avec la date et l'identité de l'administrateur.</p>
        </form>
        <div class="verify-secondary"><h3>Notifications</h3>
        ${notifications.map(n=>`<div class="admin-review-notification">${safe(dateVerification(n.created_at))} · ${safe(({sent:'Envoyé',pending:'En attente',sending:'En cours',failed:'Échec'})[n.statut]||n.statut)} ${n.statut==='pending'||n.statut==='failed'?`<button type="button" data-notification-retry="${Number(n.id)}">Réessayer</button>`:''}</div>`).join('')||'<p>Aucune notification.</p>'}</div>
      </aside>
    </div>`;
    const formulaire=cible.querySelector('#admin-decision-form');
    formulaire?.addEventListener('submit',async event=>{
      event.preventDefault();
      if(dossierActifId!==id)return;
      const statut=formulaire.elements.statut.value;
      const commentaire=formulaire.elements.commentaire.value.trim();
      const notifier=formulaire.elements.notifier?.checked!==false;
      const info=cible.querySelector('#admin-decision-info');
      if(commentaire.length>500||(statut!=='approuve'&&commentaire.length<5)){
        info.textContent='Motif obligatoire de 5 à 500 caractères pour refuser ou demander un complément.';
        return;
      }
      if(!window.confirm?.(`Confirmer la décision « ${verificationLabel(statut)} » pour ${nomComplet(artisan)} ?`))return;
      const bouton=formulaire.querySelector('button[type=submit]');
      bouton.disabled=true;
      info.textContent='Enregistrement de la décision…';
      try{
        const retour=await requeteAPI(`/api/admin-verification/artisans/${id}/decision`,{method:'PUT',body:JSON.stringify({statut,commentaire,notifier})});
        if(dossierActifId!==id)return;
        info.textContent=retour.message||'Décision enregistrée.';
        await chargerArtisansVerification();
        if(dossierActifId===id){
          const misAJour=artisansVerification.find(a=>Number(a.id)===id);
          await ouvrirDossierArtisan(id,misAJour||{...artisan,verification_statut:statut,verification_commentaire:commentaire});
        }
        if(typeof chargerUtilisateursAdmin==='function')chargerUtilisateursAdmin();
      }catch(e){info.textContent=e.message||'Décision impossible.';}
      finally{bouton.disabled=false;}
    });
    cible.querySelectorAll('[data-notification-retry]').forEach(button=>button.addEventListener('click',async()=>{
      button.disabled=true;
      try{
        const retour=await requeteAPI(`/api/admin-verification/notifications/${button.dataset.notificationRetry}/retry`,{method:'POST',body:'{}'});
        if(typeof afficherToast==='function')afficherToast(retour.message);
        if(dossierActifId===id)await ouvrirDossierArtisan(id,artisan);
      }catch(e){if(typeof afficherToast==='function')afficherToast(e.message,'error');button.disabled=false;}
    }));
  }catch(e){
    if(numero!==examenNumero||dossierActifId!==id)return;
    cible.textContent='Impossible de consulter le dossier : '+(e.message||'Erreur serveur')+'. Vérifiez les migrations MySQL.';
    cible.setAttribute('role','alert');
  }
}
async function ouvrirDossierParUtilisateur(userId) {
  try{
    const data=await requeteAPI(`/api/admin-verification/artisans/by-user/${Number(userId)}`);
    if(typeof activerOngletAdmin==='function')activerOngletAdmin('verification');
    if(data.artisan)await ouvrirDossierArtisan(data.artisan.id,data.artisan);
    else{
      await chargerArtisansVerification();
      const artisan=artisansVerification.find(a=>Number(a.id)===Number(data.artisanId));
      if(artisan)await ouvrirDossierArtisan(artisan.id,artisan);
      else if(typeof afficherToast==='function')afficherToast('Dossier disponible dans la rubrique Artisans à vérifier. Utilisez la recherche.','error');
    }
  }catch(e){if(typeof afficherToast==='function')afficherToast(e.message||'Erreur de chargement.','error');}
}
function initialiserVerificationAdmin(){
  const liste=document.getElementById('admin-verification-list');
  if(!liste)return;
  let temporisation;
  document.getElementById('admin-verification-search')?.addEventListener('input',()=>{
    clearTimeout(temporisation);
    temporisation=setTimeout(()=>chargerArtisansVerification(1),280);
  });
  document.getElementById('admin-verification-status')?.addEventListener('change',()=>chargerArtisansVerification(1));
  document.getElementById('admin-verification-sort')?.addEventListener('change',()=>chargerArtisansVerification(1));
  document.getElementById('admin-verification-refresh')?.addEventListener('click',()=>chargerArtisansVerification(1));
  document.querySelectorAll?.('[data-verify-filter], [data-verify-stat]').forEach(b=>b.addEventListener('click',()=>{
    selectionnerFiltreVerification(b.dataset.verifyFilter||b.dataset.verifyStat);
    chargerArtisansVerification(1);
  }));
  liste.addEventListener('click',event=>{
    const bouton=event.target.closest('[data-examine-artisan]');
    if(bouton){declencheurExamen=bouton;ouvrirDossierArtisan(bouton.dataset.examineArtisan);}
  });
  document.getElementById('admin-verification-pagination')?.addEventListener('click',event=>{
    const bouton=event.target.closest('[data-review-page]');
    if(bouton&&!bouton.disabled)chargerArtisansVerification(Number(bouton.dataset.reviewPage));
  });
  document.getElementById('admin-verification-details')?.addEventListener('click',event=>{
    if(event.target.closest('[data-close-review]'))fermerDossierArtisan();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&dossierActifId)fermerDossierArtisan();
    if(event.key==='Tab'&&dossierActifId){
      const modal=document.getElementById('admin-verification-details');
      const focusables=Array.from(modal?.querySelectorAll?.('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled])')||[]).filter(el=>el.getClientRects?.().length);
      if(!focusables.length)return;
      const premier=focusables[0],dernier=focusables[focusables.length-1];
      if(event.shiftKey&&document.activeElement===premier){event.preventDefault();dernier.focus();}
      else if(!event.shiftKey&&document.activeElement===dernier){event.preventDefault();premier.focus();}
    }
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-examine-user]');
    if(button)ouvrirDossierParUtilisateur(button.dataset.examineUser);
  });
  const year=document.getElementById('verify-year');
  if(year)year.textContent=`▣  Vérification documentaire · ${new Date().getFullYear()}`;
  chargerArtisansVerification(1);
}
document.addEventListener('DOMContentLoaded',async()=>{
  try{
    await attendreSession();
    if(window.utilisateurCourant?.role!=='admin')return;
    initialiserVerificationAdmin();
    if(document.body.dataset?.workspacePage==='verification'){
      const user=new URLSearchParams(window.location.search).get('user');
      if(user&&/^\d+$/.test(user))await ouvrirDossierParUtilisateur(user);
    }
  }catch(e){console.error('Initialisation de la vérification :',e.message);}
});
