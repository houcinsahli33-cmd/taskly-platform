'use strict';
// Cet écran ne se charge que dans l'administration privée, après vérification de session.
let artisansVerification = [];
let pageVerification = 1;
let requeteVerificationNumero = 0;
let dossierActifId = null;
let examenNumero = 0;
const verificationLabel = statut => ({
  en_attente:'En attente', a_completer:'Complément demandé',
  approuve:'Approuvé', refuse:'Refusé'
})[statut] || statut || 'Non renseigné';

function ligneHistorique(h) {
  const safe = echapperHTML;
  return `<li class="review-history-item"><strong>${safe(verificationLabel(h.nouveau_statut))}</strong>
    <span> — ${safe(formatDateHeure(h.created_at))}</span>
    <p>Par ${safe([h.admin_prenom,h.admin_nom].filter(Boolean).join(' ') || 'Administrateur')}</p>
    ${h.commentaire ? `<p class="muted">${safe(h.commentaire)}</p>` : ''}</li>`;
}

async function chargerArtisansVerification(page = pageVerification) {
  const target = document.getElementById('admin-verification-list');
  if (!target) return;
  const numero = ++requeteVerificationNumero;
  const search = String(document.getElementById('admin-verification-search')?.value || '').trim();
  const statut = document.getElementById('admin-verification-status')?.value || 'tous';
  const params = new URLSearchParams({page:String(page),limite:'20',statut});
  if (search) params.set('recherche', search);
  target.innerHTML = typeof etatChargement === 'function' ? etatChargement('Chargement des dossiers…') : '<p>Chargement des dossiers…</p>';
  try {
    const resultat = await requeteAPI(`/api/admin-verification/artisans?${params}`);
    if (numero !== requeteVerificationNumero) return;
    artisansVerification = Array.isArray(resultat.artisans) ? resultat.artisans : [];
    pageVerification = Number(resultat.page) || 1;
    const total = Number(resultat.total || 0), pages = Number(resultat.pages || 1);
    const compteur = document.getElementById('admin-verification-counts');
    if (compteur) compteur.textContent = `${total} résultat(s) · page ${pageVerification} sur ${pages}`;
    target.innerHTML = artisansVerification.map(a => `<article class="card mb-16 admin-review-card" style="padding:16px">
        <h3>${echapperHTML(nomComplet(a))}</h3>
        <p class="muted">${echapperHTML(a.service_nom)} · ${echapperHTML(a.ville)} · ${echapperHTML(verificationLabel(a.verification_statut))} · ${Number(a.documents_count || 0)} pièce(s)</p>
        <button class="btn outline small" type="button" data-examine-artisan="${Number(a.id)}">Examiner le dossier</button>
      </article>`).join('') || '<p>Aucun artisan pour ces critères.</p>';
    const pagination = document.getElementById('admin-verification-pagination');
    if (pagination) pagination.innerHTML = `<button class="btn outline small" type="button" data-review-page="${pageVerification-1}" ${pageVerification<=1?'disabled':''}>Précédent</button>
      <span>Page ${pageVerification} / ${pages}</span>
      <button class="btn outline small" type="button" data-review-page="${pageVerification+1}" ${pageVerification>=pages?'disabled':''}>Suivant</button>`;
  } catch(e) {
    if (numero !== requeteVerificationNumero) return;
    target.textContent = 'Impossible de charger les dossiers : ' + (e.message || 'Erreur serveur');
    const compteur = document.getElementById('admin-verification-counts');
    if (compteur) compteur.textContent = 'Dossiers indisponibles';
  }
}

function fermerDossierArtisan() {
  examenNumero++;
  dossierActifId = null;
  const zone = document.getElementById('admin-verification-details');
  if (!zone) return;
  zone.hidden = true;
  zone.innerHTML = '';
  document.body.classList.remove('admin-review-open');
  document.getElementById('admin-verification-list')?.querySelector('[data-examine-artisan]')?.focus?.();
}

function ouvrirFenetreExamen(artisan) {
  const zone = document.getElementById('admin-verification-details');
  if (!zone) throw new Error('Fenêtre de vérification introuvable. Actualisez la page.');
  zone.hidden = false;
  document.body.classList.add('admin-review-open');
  zone.innerHTML = `<div class="admin-review-backdrop" data-close-review="1"></div>
    <section role="dialog" aria-modal="true" aria-labelledby="admin-review-title" class="admin-review-dialog">
      <header class="admin-review-dialog-header"><div><p class="eyebrow">Vérification privée</p>
      <h2 id="admin-review-title">Dossier de ${echapperHTML(nomComplet(artisan))}</h2></div>
      <button class="btn outline small" type="button" data-close-review="1" aria-label="Fermer le dossier">Fermer ×</button></header>
      <div id="admin-review-content" class="admin-review-dialog-content" role="status" aria-live="polite">Chargement des pièces et de l’historique…</div>
    </section>`;
  zone.querySelector('button[data-close-review]')?.focus?.();
  return zone;
}

async function ouvrirDossierArtisan(id, donneesArtisan = null) {
  id = Number(id);
  const artisan = donneesArtisan || artisansVerification.find(a => Number(a.id) === id);
  if (!Number.isSafeInteger(id) || id <= 0 || !artisan) {
    if (typeof afficherToast === 'function') afficherToast('Dossier introuvable : actualisez la liste.', 'error');
    return;
  }
  dossierActifId = id;
  const numero = ++examenNumero;
  const zone = ouvrirFenetreExamen(artisan); // visible immédiatement, avant l'appel serveur
  const cible = zone.querySelector('#admin-review-content');
  try {
    const data = await requeteAPI(`/api/admin-verification/artisans/${id}/documents`);
    if (numero !== examenNumero || dossierActifId !== id) return;
    const safe = echapperHTML;
    const documents = Array.isArray(data.documents) ? data.documents : [];
    const support = Array.isArray(data.support) ? data.support : [];
    const historique = Array.isArray(data.historique) ? data.historique : [];
    const notifications = Array.isArray(data.notifications) ? data.notifications : [];
    cible.removeAttribute('role');
    cible.innerHTML = `<div class="admin-review-layout">
      <div class="admin-review-evidence">
        <section><h3>Identité et activité</h3>
          <p><strong>${safe(nomComplet(artisan))}</strong> · ${safe(artisan.service_nom)}</p>
          <p>${safe(artisan.email)} · ${safe(artisan.telephone)} · ${safe(artisan.ville)}</p>
          <p>${Number(artisan.experience || 0)} an(s) d'expérience · Compte : ${safe(artisan.statut_compte)}</p>
          <p>${safe(artisan.description || 'Aucune description.')}</p>
          <p>Statut du dossier : <strong>${safe(verificationLabel(artisan.verification_statut))}</strong></p>
          ${artisan.verification_commentaire ? `<p>${safe(artisan.verification_commentaire)}</p>` : ''}
        </section>
        <section><h3>Diplômes et certificats</h3>
          ${documents.map(d=>`<div class="review-document"><span>${safe(d.type_document)} — ${safe(d.original_name)}</span>
            <a class="btn outline small" href="/api/admin-verification/documents/${Number(d.id)}">Télécharger</a></div>`).join('') || '<p>Aucune pièce : approbation impossible.</p>'}
        </section>
        <section><h3>Historique des décisions</h3>
          <ol class="admin-review-history">${historique.map(ligneHistorique).join('') || '<li>Aucune décision antérieure.</li>'}</ol>
        </section>
        <section><h3>Support associé</h3>
          ${support.map(s=>`<article class="review-support"><strong>Demande #${Number(s.id)} · ${safe(formatDateHeure(s.created_at))}</strong>
            <p style="white-space:pre-wrap">${safe(s.message)}</p><small>${safe(s.statut)}</small></article>`).join('') || '<p>Aucune demande au support.</p>'}
        </section>
      </div>
      <div class="admin-review-decision">
        <h3>Décision administrative</h3>
        <form id="admin-decision-form">
          <label class="form-label" for="admin-decision-status">Décision</label>
          <select class="form-select" id="admin-decision-status" name="statut" required>
            <option value="a_completer">Demander un complément</option>
            <option value="approuve">Approuver et activer</option>
            <option value="refuse">Refuser et bloquer</option>
          </select>
          <label class="form-label" for="admin-decision-comment">Motif (obligatoire pour refuser ou demander un complément)</label>
          <textarea class="form-textarea" id="admin-decision-comment" name="commentaire" maxlength="500"></textarea>
          <button class="btn primary" type="submit">Confirmer la décision</button>
        </form>
        <p id="admin-decision-info" role="status" aria-live="polite"></p>
        <h3>Notifications</h3>
        ${notifications.map(n=>`<div class="admin-review-notification">${safe(formatDateHeure(n.created_at))} · ${safe(({sent:'Envoyé',pending:'En attente',sending:'En cours',failed:'Échec'})[n.statut] || n.statut)}
          ${n.statut !== 'sent' ? `<button class="btn outline small" type="button" data-notification-retry="${Number(n.id)}">Réessayer</button>` : ''}</div>`).join('') || '<p>Aucune notification.</p>'}
      </div>
    </div>`;
    const formulaire = cible.querySelector('#admin-decision-form');
    formulaire.addEventListener('submit', async event => {
      event.preventDefault();
      const statut = formulaire.elements.statut.value;
      const commentaire = formulaire.elements.commentaire.value.trim();
      const info = cible.querySelector('#admin-decision-info');
      if (commentaire.length > 500 || (statut !== 'approuve' && commentaire.length < 5)) {
        info.textContent = 'Motif de 5 à 500 caractères obligatoire pour refuser ou demander un complément.';
        return;
      }
      const bouton = formulaire.querySelector('button[type=submit]');
      bouton.disabled = true;
      info.textContent = 'Enregistrement de la décision…';
      try {
        const retour = await requeteAPI(`/api/admin-verification/artisans/${id}/decision`, {
          method:'PUT',body:JSON.stringify({statut,commentaire})
        });
        info.textContent = retour.message;
        await chargerArtisansVerification();
        // Une nouvelle sélection peut avoir remplacé le dossier pendant la requête.
        if (dossierActifId === id) {
          const misAJour = artisansVerification.find(a=>Number(a.id)===id);
          await ouvrirDossierArtisan(id, misAJour || {...artisan,verification_statut:statut,verification_commentaire:commentaire});
        }
        if (typeof chargerUtilisateursAdmin === 'function') chargerUtilisateursAdmin();
      } catch(e) {info.textContent = e.message || 'Décision impossible.';}
      finally {bouton.disabled=false;}
    });
    cible.querySelectorAll('[data-notification-retry]').forEach(button => button.addEventListener('click', async()=>{
      button.disabled=true;
      try {
        const retour=await requeteAPI(`/api/admin-verification/notifications/${button.dataset.notificationRetry}/retry`,{method:'POST',body:'{}'});
        if(typeof afficherToast === 'function') afficherToast(retour.message);
        await ouvrirDossierArtisan(id, artisan);
      } catch(e){if(typeof afficherToast==='function') afficherToast(e.message,'error');button.disabled=false;}
    }));
  } catch(e) {
    if (numero !== examenNumero || dossierActifId !== id) return;
    cible.textContent = 'Impossible de consulter le dossier : ' + (e.message || 'Erreur serveur') + '. Vérifiez les migrations MySQL.';
    cible.setAttribute('role','alert');
  }
}

async function ouvrirDossierParUtilisateur(userId) {
  try {
    const data = await requeteAPI(`/api/admin-verification/artisans/by-user/${Number(userId)}`);
    if (typeof activerOngletAdmin === 'function') activerOngletAdmin('verification');
    if (data.artisan) {
      await ouvrirDossierArtisan(data.artisan.id, data.artisan);
    } else {
      await chargerArtisansVerification();
      const artisan=artisansVerification.find(a=>Number(a.id)===Number(data.artisanId));
      if (artisan) await ouvrirDossierArtisan(artisan.id,artisan);
      else if (typeof afficherToast==='function') afficherToast('Dossier disponible dans la rubrique Artisans à vérifier. Utilisez la recherche.', 'error');
    }
  } catch(e) {if (typeof afficherToast === 'function') afficherToast(e.message || 'Erreur de chargement.','error');}
}

function initialiserVerificationAdmin() {
  const liste = document.getElementById('admin-verification-list');
  if (!liste) return;
  let temporisation;
  document.getElementById('admin-verification-search')?.addEventListener('input',()=>{
    clearTimeout(temporisation);
    temporisation=setTimeout(()=>chargerArtisansVerification(1),250);
  });
  document.getElementById('admin-verification-status')?.addEventListener('change',()=>chargerArtisansVerification(1));
  document.getElementById('admin-verification-refresh')?.addEventListener('click',()=>chargerArtisansVerification(1));
  liste.addEventListener('click',event=>{
    const bouton=event.target.closest('[data-examine-artisan]');
    if(bouton) ouvrirDossierArtisan(bouton.dataset.examineArtisan);
  });
  document.getElementById('admin-verification-pagination')?.addEventListener('click',event=>{
    const bouton=event.target.closest('[data-review-page]');
    if(bouton && !bouton.disabled) chargerArtisansVerification(Number(bouton.dataset.reviewPage));
  });
  document.getElementById('admin-verification-details')?.addEventListener('click',event=>{
    if(event.target.closest('[data-close-review]')) fermerDossierArtisan();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && dossierActifId) fermerDossierArtisan();});
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-examine-user]');
    if(button) ouvrirDossierParUtilisateur(button.dataset.examineUser);
  });
  chargerArtisansVerification(1);
}

document.addEventListener('DOMContentLoaded', async()=>{
  try {
    await attendreSession();
    if (window.utilisateurCourant?.role !== 'admin') return;
    initialiserVerificationAdmin();
  } catch(e) {console.error('Initialisation de la vérification :',e.message);}
});
