// Examen administratif Taskly (PFE). Un seul parcours de décision pour les artisans.
let artisansVerification = [];
let verificationPage = 1;
let verificationPages = 1;
let verificationChargement = 0;
const verificationLabel = statut => ({
  en_attente:'En attente', a_completer:'Complément demandé',
  approuve:'Activé', refuse:'Refusé', bloque:'Bloqué'
})[statut] || statut || 'Inconnu';

function ligneHistorique(item) {
  const safe = echapperHTML;
  const administrateur = [item.admin_prenom, item.admin_nom].filter(Boolean).join(' ') || 'Administrateur';
  return `<li class="review-history-entry"><strong>${safe(verificationLabel(item.nouveau_statut))}</strong>
    <span>${safe(formatDateHeure(item.created_at))} · ${safe(administrateur)}</span>
    ${item.commentaire ? `<p>${safe(item.commentaire)}</p>` : ''}</li>`;
}

async function chargerArtisansVerification(page = verificationPage) {
  const target = document.getElementById('admin-verification-list');
  if (!target) return;
  const numero = ++verificationChargement;
  verificationPage = page;
  const statut = document.getElementById('admin-verification-status')?.value || 'tous';
  const recherche = document.getElementById('admin-verification-search')?.value?.trim() || '';
  const params = new URLSearchParams({page:String(page),limite:'20',statut});
  if (recherche) params.set('recherche', recherche);
  try {
    const resultat = await requeteAPI(`/api/admin-verification/artisans?${params.toString()}`);
    // Une ancienne réponse arrivée en retard ne doit pas remplacer le dernier filtre.
    if (numero !== verificationChargement) return;
    artisansVerification = Array.isArray(resultat.artisans) ? resultat.artisans : [];
    verificationPage = Number(resultat.page || page);
    verificationPages = Math.max(1, Number(resultat.pages || 1));
    target.innerHTML = artisansVerification.map(a => `<article class="card mb-16 admin-review-item">
      <div><h3>${echapperHTML(nomComplet(a))}</h3>
      <p class="muted">${echapperHTML(a.service_nom || 'Métier non renseigné')} · ${echapperHTML(a.ville || 'Ville non renseignée')}</p>
      <p class="muted">${echapperHTML(a.email || '')} · ${echapperHTML(a.statut_compte === 'bloque' ? 'Compte bloqué' : verificationLabel(a.verification_statut))} · ${Number(a.documents_count || 0)} pièce(s)</p></div>
      <button class="btn outline small" type="button" data-examine-artisan="${Number(a.id)}">Examiner le dossier</button>
    </article>`).join('') || '<p>Aucun artisan.</p>';
    const compteur = document.getElementById('admin-verification-counts');
    if (compteur) compteur.textContent = `${Number(resultat.total || 0)} résultat(s) · Page ${verificationPage} / ${verificationPages}`;
    const navigation = document.getElementById('admin-verification-pagination');
    if (navigation) navigation.innerHTML = `<button type="button" class="btn outline small" data-verification-page="${verificationPage-1}" ${verificationPage<=1?'disabled':''}>Précédent</button>
      <span>Page ${verificationPage} sur ${verificationPages}</span>
      <button type="button" class="btn outline small" data-verification-page="${verificationPage+1}" ${verificationPage>=verificationPages?'disabled':''}>Suivant</button>`;
  } catch (erreur) {
    if (numero !== verificationChargement) return;
    target.textContent = erreur.message || 'Impossible de charger les dossiers artisans.';
    const compteur = document.getElementById('admin-verification-counts');
    if (compteur) compteur.textContent = 'Chargement impossible';
  }
}

async function ouvrirDossierArtisan(id) {
  const zone = document.getElementById('admin-verification-details');
  const artisan = artisansVerification.find(a => Number(a.id) === Number(id));
  if (!zone || !artisan) return;
  try {
    const d = await requeteAPI(`/api/admin-verification/artisans/${Number(id)}/documents`);
    const safe = echapperHTML;
    const documents = Array.isArray(d.documents) ? d.documents : [];
    const support = Array.isArray(d.support) ? d.support : [];
    const notifications = Array.isArray(d.notifications) ? d.notifications : [];
    const historique = Array.isArray(d.historique) ? d.historique : [];
    zone.innerHTML = `<section class="panel"><div class="panel-header"><h3>Dossier de ${safe(nomComplet(artisan))}</h3></div>
      <div class="panel-body"><div class="admin-review-layout"><div>
      <p>${safe(artisan.email)} · ${safe(artisan.telephone)} · ${safe(artisan.ville)}</p>
      <p>${safe(artisan.service_nom)} · ${Number(artisan.experience || 0)} an(s) d’expérience</p>
      <p>${safe(artisan.description || '')}</p>
      <p>Compte : ${safe(artisan.statut_compte)} · Dossier : ${safe(verificationLabel(artisan.verification_statut))}</p>
      <p>${safe(artisan.verification_commentaire || '')}</p>
      <h4>Diplômes et certificats</h4>
      ${documents.map(doc => `<div class="review-document"><span>${safe(doc.type_document)} — ${safe(doc.original_name)}</span><a class="btn outline small" href="/api/admin-verification/documents/${Number(doc.id)}">Télécharger</a></div>`).join('') || '<p>Aucun document : activation impossible sans diplôme ou certificat.</p>'}
      <h4>Demandes au support liées au compte</h4>
      ${support.map(m => `<article class="mb-16 review-support"><strong>Demande #${Number(m.id)} · ${safe(formatDateHeure(m.created_at))}</strong><p style="white-space:pre-wrap">${safe(m.message)}</p><small>${safe(m.statut)}</small></article>`).join('') || '<p>Aucune demande liée.</p>'}
      <h4>Historique des décisions</h4><ol class="review-history">${historique.map(ligneHistorique).join('') || '<li>Aucune décision enregistrée.</li>'}</ol>
      </div><div class="admin-review-decision"><h4>Décision administrative</h4>
      <form id="admin-decision-form" class="grid">
      <label><span class="field-label">Décision</span><select class="form-select" name="statut"><option value="a_completer">Demander un complément</option><option value="approuve">Activer le compte</option><option value="refuse">Bloquer le compte</option></select></label>
      <label><span class="field-label">Motif (obligatoire pour refus ou complément)</span><textarea class="form-textarea" name="commentaire" maxlength="500"></textarea></label>
      <button class="btn primary" type="submit">Confirmer la décision</button></form>
      <p id="admin-decision-info" role="status"></p>
      <h4>Notifications e-mail</h4>
      ${notifications.map(n => `<p>${safe(formatDateHeure(n.created_at))} — ${safe(({sent:'Envoyé',pending:'En attente',sending:'En cours',failed:'Échec à réessayer'})[n.statut] || n.statut)} ${n.statut !== 'sent' ? `<button class="btn outline small" type="button" data-notification-retry="${Number(n.id)}">Réessayer</button>` : ''}</p>`).join('') || '<p>Aucune notification.</p>'}
      </div></div></div></section>`;
    zone.querySelector('form').addEventListener('submit', async evenement => {
      evenement.preventDefault();
      const formulaire = evenement.currentTarget;
      const donnees = new FormData(formulaire);
      const statut = donnees.get('statut');
      const commentaire = String(donnees.get('commentaire') || '').trim();
      const information = document.getElementById('admin-decision-info');
      if (statut !== 'approuve' && commentaire.length < 5) {
        information.textContent = 'Motif de cinq caractères minimum requis.';
        return;
      }
      if (!window.confirm(`Confirmer la décision « ${verificationLabel(statut)} » pour ${nomComplet(artisan)} ?`)) return;
      const bouton = formulaire.querySelector('button');
      bouton.disabled = true;
      try {
        const resultat = await requeteAPI(`/api/admin-verification/artisans/${Number(id)}/decision`, {
          method:'PUT', body:JSON.stringify({statut, commentaire})
        });
        information.textContent = resultat.message;
        afficherToast(resultat.message);
        await chargerArtisansVerification();
      } catch (erreur) {
        information.textContent = erreur.message;
      } finally {
        bouton.disabled = false;
      }
    });
    zone.querySelectorAll('[data-notification-retry]').forEach(bouton => bouton.addEventListener('click', async () => {
      bouton.disabled = true;
      try {
        const resultat = await requeteAPI(`/api/admin-verification/notifications/${bouton.dataset.notificationRetry}/retry`, {method:'POST',body:'{}'});
        afficherToast(resultat.message);
        await ouvrirDossierArtisan(id);
      } catch (erreur) { afficherToast(erreur.message, 'error'); bouton.disabled = false; }
    }));
  } catch (erreur) { zone.textContent = erreur.message || 'Dossier indisponible.'; }
}

document.addEventListener('DOMContentLoaded', async () => {
  await attendreSession();
  if (window.utilisateurCourant?.role !== 'admin') return;
  await chargerArtisansVerification();
  const liste = document.getElementById('admin-verification-list');
  liste?.addEventListener('click', evenement => {
    const bouton = evenement.target.closest('[data-examine-artisan]');
    if (bouton) ouvrirDossierArtisan(bouton.dataset.examineArtisan);
  });
  const recherche = document.getElementById('admin-verification-search');
  const statut = document.getElementById('admin-verification-status');
  let delai;
  recherche?.addEventListener('input', () => {
    clearTimeout(delai);
    delai = setTimeout(() => chargerArtisansVerification(1), 250);
  });
  statut?.addEventListener('change', () => chargerArtisansVerification(1));
  document.getElementById('admin-verification-pagination')?.addEventListener('click', evenement => {
    const bouton = evenement.target.closest('[data-verification-page]');
    if (!bouton || bouton.disabled) return;
    const page = Number(bouton.dataset.verificationPage);
    if (page >= 1 && page <= verificationPages) chargerArtisansVerification(page);
  });
});
