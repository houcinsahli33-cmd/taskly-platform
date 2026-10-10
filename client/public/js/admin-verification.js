// Dossiers artisans : recherches, examen des justificatifs et traçabilité des décisions.
// La connexion de l'administration et la navigation générale ne sont pas modifiées.
let artisansVerification = [];
let dossierArtisanOuvert = null;

const verificationLabel = statut => ({
  en_attente: 'En attente',
  a_completer: 'Complément demandé',
  approuve: 'Activé',
  refuse: 'Bloqué / refusé'
})[statut] || 'Statut inconnu';

const verificationClasse = statut => ({
  en_attente: 'pending',
  a_completer: 'complement',
  approuve: 'approved',
  refuse: 'blocked'
})[statut] || 'pending';

function afficherResumeVerification(artisans, selection) {
  const resume = document.getElementById('admin-verification-summary');
  if (!resume) return;
  const compte = statut => artisans.filter(a => a.verification_statut === statut).length;
  resume.innerHTML = `
    <span><strong>${artisans.length}</strong> dossier(s) chargés</span>
    <span><strong>${compte('en_attente')}</strong> en attente</span>
    <span><strong>${compte('a_completer')}</strong> à compléter</span>
    <span><strong>${compte('approuve')}</strong> activés</span>
    <span><strong>${compte('refuse')}</strong> bloqués</span>
    <span class="review-result-count">${selection} affiché(s)</span>`;
}

function afficherListeVerification() {
  const cible = document.getElementById('admin-verification-list');
  if (!cible) return;
  const recherche = normaliserTexte(document.getElementById('admin-verification-search')?.value);
  const statut = document.getElementById('admin-verification-filter')?.value || 'tous';
  const selection = artisansVerification.filter(a => {
    if (statut !== 'tous' && statut !== a.verification_statut) return false;
    const termes = [a.nom, a.prenom, a.email, a.service_nom, a.ville].map(normaliserTexte).join(' ');
    return !recherche || termes.includes(recherche);
  });
  afficherResumeVerification(artisansVerification, selection.length);
  cible.innerHTML = selection.map(a => `
    <article class="review-account ${Number(a.id) === dossierArtisanOuvert ? 'selected' : ''}">
      <div class="review-account-info">
        <h3>${echapperHTML(nomComplet(a))}</h3>
        <p class="muted">${echapperHTML(a.service_nom)} · ${echapperHTML(a.ville)}</p>
        <p class="review-account-email">${echapperHTML(a.email)}</p>
      </div>
      <div class="review-account-actions">
        <span class="review-status review-status--${verificationClasse(a.verification_statut)}">${echapperHTML(verificationLabel(a.verification_statut))}</span>
        <small>${Number(a.documents_count) || 0} pièce(s)</small>
        <button class="btn outline small" type="button" data-examine-artisan="${Number(a.id)}"
          aria-label="Examiner le dossier de ${echapperHTML(nomComplet(a))}">Examiner</button>
      </div>
    </article>`).join('') || '<p class="review-empty">Aucun dossier ne correspond à votre recherche.</p>';
}

async function chargerArtisansVerification() {
  const cible = document.getElementById('admin-verification-list');
  const bouton = document.getElementById('admin-verification-refresh');
  if (!cible) return;
  if (bouton) bouton.disabled = true;
  cible.textContent = 'Chargement des dossiers…';
  try {
    const {artisans} = await requeteAPI('/api/admin-verification/artisans');
    artisansVerification = Array.isArray(artisans) ? artisans : [];
    afficherListeVerification();
  } catch (e) {
    cible.textContent = e.message;
  } finally {
    if (bouton) bouton.disabled = false;
  }
}

function ligneHistorique(decision) {
  const safe = echapperHTML;
  const admin = [decision.admin_prenom, decision.admin_nom].filter(Boolean).join(' ') || 'Administrateur';
  return `<li class="review-history-item">
    <span class="review-history-date">${safe(formatDateHeure(decision.created_at))}</span>
    <strong>${safe(verificationLabel(decision.ancien_statut))} → ${safe(verificationLabel(decision.nouveau_statut))}</strong>
    <span>Par ${safe(admin)}</span>
    ${decision.commentaire ? `<p>${safe(decision.commentaire)}</p>` : ''}
  </li>`;
}

async function ouvrirDossierArtisan(id) {
  const zone = document.getElementById('admin-verification-details');
  const artisan = artisansVerification.find(a => Number(a.id) === Number(id));
  if (!zone || !artisan) return;
  dossierArtisanOuvert = Number(id);
  afficherListeVerification();
  zone.textContent = 'Chargement du dossier…';
  try {
    const donnees = await requeteAPI(`/api/admin-verification/artisans/${Number(id)}/documents`);
    const safe = echapperHTML;
    const documents = Array.isArray(donnees.documents) ? donnees.documents : [];
    const support = Array.isArray(donnees.support) ? donnees.support : [];
    const notifications = Array.isArray(donnees.notifications) ? donnees.notifications : [];
    const historique = Array.isArray(donnees.historique) ? donnees.historique : [];
    const justifie = documents.some(doc => ['diplome', 'certificat'].includes(doc.type_document));

    zone.innerHTML = `<section class="panel review-dossier" aria-labelledby="review-dossier-title">
      <div class="panel-header review-dossier-header">
        <div><p class="review-eyebrow">EXAMEN D'UN ARTISAN</p><h3 id="review-dossier-title">${safe(nomComplet(artisan))}</h3>
          <span class="review-status review-status--${verificationClasse(artisan.verification_statut)}">${safe(verificationLabel(artisan.verification_statut))}</span></div>
        <button class="btn outline small" id="admin-close-review" type="button">Fermer le dossier</button>
      </div>
      <div class="panel-body">
        <div class="admin-review-layout">
          <div class="review-evidence">
            <h4>Informations professionnelles</h4>
            <dl class="review-facts">
              <div><dt>E-mail</dt><dd>${safe(artisan.email)}</dd></div>
              <div><dt>Téléphone</dt><dd>${safe(artisan.telephone)}</dd></div>
              <div><dt>Ville</dt><dd>${safe(artisan.ville)}</dd></div>
              <div><dt>Métier</dt><dd>${safe(artisan.service_nom)}</dd></div>
              <div><dt>Expérience déclarée</dt><dd>${Number(artisan.experience) || 0} an(s)</dd></div>
              <div><dt>État du compte</dt><dd>${safe(artisan.statut_compte)}</dd></div>
            </dl>
            <p class="review-description">${safe(artisan.description || 'Aucune description professionnelle fournie.')}</p>
            ${artisan.verification_commentaire ? `<p class="review-last-reason"><strong>Dernier motif :</strong> ${safe(artisan.verification_commentaire)}</p>` : ''}

            <h4>Justificatifs déposés</h4>
            ${documents.map(doc => `<div class="review-document">
              <span><strong>${safe(doc.type_document)}</strong> — ${safe(doc.original_name)}
                <small>${safe(formatDateHeure(doc.created_at))}</small></span>
              <a class="btn outline small" href="/api/admin-verification/documents/${Number(doc.id)}">Télécharger</a>
            </div>`).join('') || '<p class="review-empty">Aucune pièce disponible : activation impossible.</p>'}
            <p class="admin-form-hint">Les documents doivent être examinés par un humain. Leur présence ne garantit pas leur authenticité.</p>

            <h4>Messages de support associés</h4>
            ${support.map(message => `<article class="review-support">
              <strong>Demande n° ${Number(message.id)} · ${safe(formatDateHeure(message.created_at))}</strong>
              <p>${safe(message.message)}</p><small>Statut : ${safe(message.statut)}</small>
            </article>`).join('') || '<p class="review-empty">Aucun message lié à ce compte.</p>'}

            <h4>Historique des décisions</h4>
            <ol class="review-history">${historique.map(ligneHistorique).join('')}</ol>
            ${historique.length ? '' : '<p class="review-empty">Aucune décision enregistrée pour cet artisan.</p>'}
          </div>
          <div class="admin-review-decision">
            <h4>Décision administrative</h4>
            <p class="admin-form-hint">Choisissez la décision après avoir lu les justificatifs et les demandes éventuelles.</p>
            <form id="admin-decision-form" class="grid">
              <label for="review-statut"><span class="field-label">Décision à appliquer</span>
                <select id="review-statut" class="form-select" name="statut" required>
                  <option value="">Sélectionner une décision…</option>
                  <option value="a_completer">Demander un complément</option>
                  <option value="approuve" ${justifie ? '' : 'disabled'}>Activer le compte</option>
                  <option value="refuse">Bloquer le compte avec motif</option>
                </select>
              </label>
              ${justifie ? '' : '<p class="review-warning" role="alert">Activation indisponible : diplôme ou certificat obligatoire.</p>'}
              <label for="review-commentaire"><span class="field-label">Motif de la décision</span>
                <textarea id="review-commentaire" class="form-textarea" name="commentaire" maxlength="500" placeholder="Indiquez un motif clair, notamment la pièce manquante ou non conforme."></textarea>
              </label>
              <p id="review-motif-hint" class="admin-form-hint">Obligatoire (5 caractères minimum) pour un refus ou une demande de complément.</p>
              <label class="review-confirm"><input type="checkbox" id="review-confirm" required>
                <span>Je confirme avoir examiné ce dossier et vouloir appliquer cette décision.</span>
              </label>
              <button class="btn primary" type="submit">Enregistrer et notifier l'artisan</button>
            </form>
            <p id="admin-decision-info" role="status" aria-live="polite"></p>
            <h4>Notifications e-mail</h4>
            ${notifications.map(notification => `<div class="review-notification">
              <span>${safe(formatDateHeure(notification.created_at))}<br><strong>${safe(({
                sent: 'Envoyé', pending: 'En attente', sending: 'En cours', failed: 'Échec d’envoi'
              })[notification.statut] || notification.statut)}</strong></span>
              ${['failed', 'pending'].includes(notification.statut) ? `<button class="btn outline small" type="button" data-notification-retry="${Number(notification.id)}">Réessayer</button>` : ''}
            </div>`).join('') || '<p class="review-empty">Aucune notification.</p>'}
          </div>
        </div>
      </div>
    </section>`;

    document.getElementById('admin-close-review')?.addEventListener('click', () => {
      zone.replaceChildren();
      dossierArtisanOuvert = null;
      afficherListeVerification();
      document.getElementById('admin-verification-search')?.focus();
    });
    const formulaire = document.getElementById('admin-decision-form');
    const select = formulaire.querySelector('[name=statut]');
    const motif = formulaire.querySelector('[name=commentaire]');
    select.addEventListener('change', () => {
      motif.required = select.value === 'refuse' || select.value === 'a_completer';
      motif.minLength = motif.required ? 5 : 0;
      document.getElementById('review-motif-hint').textContent = motif.required
        ? 'Motif obligatoire : au moins 5 caractères pour expliquer la décision.'
        : 'Motif facultatif pour l’activation.';
    });
    formulaire.addEventListener('submit', async evenement => {
      evenement.preventDefault();
      const bouton = formulaire.querySelector('button[type=submit]');
      const info = document.getElementById('admin-decision-info');
      const donneesFormulaire = new FormData(formulaire);
      const statut = donneesFormulaire.get('statut');
      const commentaire = String(donneesFormulaire.get('commentaire') || '').trim();
      if (!['approuve', 'a_completer', 'refuse'].includes(statut)) {
        info.textContent = 'Sélectionnez une décision.';
        return;
      }
      if (statut !== 'approuve' && commentaire.length < 5) {
        info.textContent = 'Le motif doit comporter au moins cinq caractères.';
        motif.focus();
        return;
      }
      bouton.disabled = true;
      info.textContent = 'Enregistrement de la décision…';
      try {
        const resultat = await requeteAPI(`/api/admin-verification/artisans/${Number(id)}/decision`, {
          method: 'PUT', body: JSON.stringify({statut, commentaire})
        });
        afficherToast(resultat.message);
        await chargerArtisansVerification();
        await ouvrirDossierArtisan(id);
      } catch (erreur) {
        info.textContent = erreur.message;
        bouton.disabled = false;
      }
    });
    zone.querySelectorAll('[data-notification-retry]').forEach(bouton => bouton.addEventListener('click', async () => {
      bouton.disabled = true;
      try {
        const resultat = await requeteAPI(`/api/admin-verification/notifications/${bouton.dataset.notificationRetry}/retry`, {
          method: 'POST', body: '{}'
        });
        afficherToast(resultat.message);
        await ouvrirDossierArtisan(id);
      } catch (erreur) {
        afficherToast(erreur.message, 'error');
        bouton.disabled = false;
      }
    }));
  } catch (erreur) {
    zone.textContent = erreur.message;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await attendreSession();
  if (window.utilisateurCourant?.role !== 'admin') return;
  document.getElementById('admin-verification-search')?.addEventListener('input', afficherListeVerification);
  document.getElementById('admin-verification-filter')?.addEventListener('change', afficherListeVerification);
  document.getElementById('admin-verification-refresh')?.addEventListener('click', chargerArtisansVerification);
  document.getElementById('admin-verification-list')?.addEventListener('click', evenement => {
    const bouton = evenement.target.closest('[data-examine-artisan]');
    if (bouton) ouvrirDossierArtisan(bouton.dataset.examineArtisan);
  });
  await chargerArtisansVerification();
});
