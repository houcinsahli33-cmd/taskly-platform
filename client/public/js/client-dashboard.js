let demandesClient = [];

// Calculer les compteurs du client
function statsDemandes(demandes) {
  return {
    total: demandes.length,
    en_attente: demandes.filter((d) => d.statut === "en_attente").length,
    terminee: demandes.filter((d) => d.statut === "terminee").length,
    annulee: demandes.filter((d) => d.statut === "annulee" || d.statut === "refusee").length
  };
}

// Afficher les statistiques du client
function afficherStatsClient() {
  const cible = document.getElementById("client-stats") || document.getElementById("client-demand-stats");
  if (!cible) return;

  const stats = statsDemandes(demandesClient);
  // Données calculées depuis /api/demandes/client, jamais de chiffres de démonstration.
  const enCours = demandesClient.filter(d => ['acceptee','en_cours','attente_confirmation','conteste'].includes(d.statut)).length;
  const surPageDemandes = document.body.dataset.workspacePage === 'demandes';
  const compteurs = surPageDemandes
    ? [['Total des demandes', stats.total, 'Toutes les demandes', 'paper'],
       ['En attente', stats.en_attente, 'En attente de réponse', 'clock'],
       ['En cours', enCours, 'Prestations en cours', 'paper'],
       ['Terminées', stats.terminee, 'Missions réalisées', 'check']]
    : [['Total des demandes', stats.total, 'Depuis votre inscription', 'paper'],
       ['En attente', stats.en_attente, 'En attente de réponse', 'clock'],
       ['Terminées', stats.terminee, 'Prestations finalisées', 'check'],
       ['Annulées ou refusées', stats.annulee, 'Demandes non abouties', 'close']];
  cible.innerHTML = compteurs.map(([label, nombre, detail, icone]) => `
    <div class="stat-card">
      <span>${label}</span><i class="client-stat-icon" aria-hidden="true"><svg aria-hidden="true"><use href="/images/icons/client-workspace.svg#${icone}"/></svg></i>
      <strong>${nombre}</strong><small>${detail}</small>
    </div>
  `).join('');
}

// Construire une carte demande client
function carteDemandeClient(demande) {
  const peutAnnuler = demande.statut === "en_attente";
  const peutAvis = demande.statut === "terminee" && !demande.avis_id;
  const dejaAvis = demande.avis_id;
  const aConfirmer = demande.statut === 'attente_confirmation';

  return `
    <article class="request-card">
      <div class="request-head">
        <div>
          <h3>${echapperHTML(demande.service_nom || "Service")}</h3>
          <p class="muted">Avec ${echapperHTML(nomComplet(demande, "artisan_"))} · ${echapperHTML(demande.artisan_ville || "")}</p>
        </div>
        ${badgeStatut(demande.statut)}
      </div>
      <p>${echapperHTML(demande.message || "Aucun message.")}</p>
      <div class="meta-row mt-14">
        <span class="badge">Adresse : ${echapperHTML(demande.adresse || "Non précisée")}</span>
        <span class="badge">Date souhaitée : ${formatDate(demande.date_souhaitee)}</span>
        <span class="badge">Créée le ${formatDate(demande.created_at)}</span>
        ${dejaAvis ? `<span class="badge accent">Avis : ${demande.avis_note}/5</span>` : ""}
      </div>
      ${demande.motif_annulation ? `<p class="alert show warning mt-14">Motif d'annulation : ${echapperHTML(demande.motif_annulation)}</p>` : ""}
      <div class="request-actions">
        ${peutAnnuler ? `<button class="btn outline" type="button" data-cancel-request="${demande.id}">Annuler</button>` : ""}
        ${aConfirmer ? `<button class="btn primary" type="button" data-confirm-finish="${demande.id}">Oui, prestation terminée</button><button class="btn outline" type="button" data-not-finished="${demande.id}">Non, pas terminée</button>` : ""}
        ${demande.statut === 'conteste' ? `<span class="badge">Prestation contestée : vous pouvez envoyer un signalement.</span>` : ""}
        ${peutAvis ? `<button class="btn primary" type="button" data-open-review="${demande.id}">Laisser un avis</button>` : ""}
        ${(["acceptee","attente_confirmation","terminee","conteste"].includes(demande.statut) || (demande.statut === "annulee" && demande.date_traitement)) ? `<button class="btn outline" type="button" data-open-taskly-chat="${Number(demande.id)}">Ouvrir le chat</button>` : ""}
        <button class="btn danger" type="button" data-open-report="${demande.id}">Signaler</button>
      </div>
    </article>
  `;
}

// Afficher les demandes du client
function afficherDemandesClient() {
  const cible = document.getElementById("client-requests");
  if (!cible) return;

  const filtres = document.querySelector('[data-client-filter].active');
  const filtre = filtres?.dataset.clientFilter || 'toutes';
  const texte = normaliserTexte(document.getElementById('client-request-search')?.value || '');
  const visibles = demandesClient.filter(d => {
    const statut = filtre === 'annulee' ? ['annulee','refusee'].includes(d.statut) : filtre === 'en_cours' ? ['acceptee','en_cours','attente_confirmation','conteste'].includes(d.statut) : filtre === 'toutes' || d.statut === filtre;
    const contenu = [d.service_nom, d.message, d.artisan_ville, d.artisan_nom, d.artisan_prenom].join(' ');
    return statut && (!texte || normaliserTexte(contenu).includes(texte));
  });
  cible.innerHTML = visibles.length ? visibles.map(carteDemandeClient).join('') :
    demandesClient.length ? etatVide('Aucune demande ne correspond à vos filtres.') : `
      <div class="client-request-empty">
        <div class="client-request-art" aria-hidden="true"><svg width="158" height="158" viewBox="0 0 180 180" fill="none"><rect x="44" y="26" width="102" height="128" rx="12" fill="white" stroke="#a6ddcc" stroke-width="2" transform="rotate(-8 44 26)"/><path d="M64 55h57M64 75h64M64 95h53" stroke="#b8e4d5" stroke-width="6" stroke-linecap="round"/><circle cx="122" cy="117" r="27" stroke="#008e72" stroke-width="9"/><path d="m142 139 27 29" stroke="#008e72" stroke-width="11" stroke-linecap="round"/></svg></div>
        <div class="client-request-empty-description"><span class="client-request-ready">✦ PRÊT À COMMENCER ?</span>
          <h3>Aucune demande pour le moment</h3>
          <p>Explorez les profils des artisans, trouvez le professionnel adapté à votre projet et envoyez votre première demande.</p>
          <div class="client-request-empty-buttons"><a class="btn primary" href="/artisans.html">Explorer les artisans →</a><a class="btn outline" href="#client-demand-how">Comment ça marche ?</a></div>
        </div>
      </div>`;
}

// Charger les demandes depuis le backend
async function chargerDemandesClient() {
  const cible = document.getElementById("client-requests");
  if (cible) cible.innerHTML = etatChargement("Chargement de vos demandes...");

  try {
    const data = await requeteAPI("/api/demandes/client");
    demandesClient = data.demandes || [];
    afficherStatsClient();
    afficherDemandesClient();
    afficherDemandesRecentesClient();
    if(document.body.dataset.workspacePage==='demandes') {
      const requested = Number(new URLSearchParams(location.search).get('signaler') || sessionStorage.getItem('tasklyReportPending'));
      if(Number.isSafeInteger(requested)&&requested>0) {
        sessionStorage.removeItem('tasklyReportPending');
        history.replaceState(null,'',location.pathname);
        if(demandesClient.some(d=>Number(d.id)===requested)) ouvrirSignalementClient(requested);
        else afficherToast('Demande inaccessible depuis ce compte client.','error');
      }
    }
  } catch (error) {
    if (cible) cible.innerHTML = etatVide(error.message);
  }
}

function afficherDemandesRecentesClient() {
  const cible = document.getElementById('client-recent-requests');
  if (!cible) return;
  if (!demandesClient.length) {
    cible.innerHTML = '<div class="client-empty"><span class="client-empty-icon" aria-hidden="true"><svg><use href="/images/icons/client-workspace.svg#paper"/></svg></span><strong>Aucune demande pour le moment</strong><p>Votre prochain projet commence ici. Découvrez les artisans disponibles sur Taskly.</p><a class="btn primary" href="/artisans.html">Explorer les artisans</a></div>';
    return;
  }
  cible.innerHTML = demandesClient.slice(0, 3).map(d => `<article class="client-recent-row"><div><strong>${echapperHTML(d.service_nom || 'Service')}</strong><p>${echapperHTML(nomComplet(d, 'artisan_'))} · ${formatDate(d.created_at)}</p></div>${badgeStatut(d.statut)}</article>`).join('');
}

// Annuler une demande en attente
async function annulerDemandeClient(id) {
  try {
    await requeteAPI(`/api/demandes/${id}/annuler`, { method: "PUT" });
    afficherToast("Demande annulée avec succès.");
    chargerDemandesClient();
  } catch (error) {
    afficherToast(error.message, "error");
  }
}

// Ouvrir la modale d'avis
function ouvrirAvisClient(id) {
  document.getElementById("review-demande-id").value = id;
  ouvrirModale("review-modal");
}

// Ouvrir la modale de signalement
function ouvrirSignalementClient(id) {
  document.getElementById("report-demande-id").value = id;
  ouvrirModale("report-modal");
}

// Initialiser les actions sur les demandes
function initialiserActionsClient() {
  document.addEventListener("click", (event) => {
    const annuler = event.target.closest("[data-cancel-request]");
    const avis = event.target.closest("[data-open-review]");
    const signaler = event.target.closest("[data-open-report]");
    const confirmer = event.target.closest('[data-confirm-finish]');
    const refuserFin = event.target.closest('[data-not-finished]');

    if (annuler) annulerDemandeClient(annuler.dataset.cancelRequest);
    if (avis) ouvrirAvisClient(avis.dataset.openReview);
    if (signaler) ouvrirSignalementClient(signaler.dataset.openReport);
    if (confirmer) {
      if (!confirm('Confirmez-vous que la prestation a réellement été terminée ?')) return;
      requeteAPI(`/api/demandes/${confirmer.dataset.confirmFinish}/confirmer-fin`,{method:'PUT'})
        .then(()=>{afficherToast('Prestation confirmée.');chargerDemandesClient();})
        .catch(e=>afficherToast(e.message,'error'));
    }
    if (refuserFin) {
      if (!confirm('La prestation n’est pas terminée. Souhaitez-vous enregistrer votre contestation ?')) return;
      requeteAPI(`/api/demandes/${refuserFin.dataset.notFinished}/contester-fin`,{method:'PUT'})
        .then(()=>{afficherToast('Prestation contestée. Vous pouvez maintenant envoyer un signalement.');chargerDemandesClient();ouvrirSignalementClient(refuserFin.dataset.notFinished);})
        .catch(e=>afficherToast(e.message,'error'));
    }
  });

  document.getElementById("review-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    try {
      await requeteAPI("/api/avis", {
        method: "POST",
        body: JSON.stringify({
          demandeId: Number(document.getElementById("review-demande-id").value),
          note: Number(document.getElementById("review-note").value),
          commentaire: document.getElementById("review-comment").value.trim()
        })
      });
      afficherToast("Votre avis a été envoyé.");
      fermerModale("review-modal");
      form.reset();
      chargerDemandesClient();
    } catch (error) {
      afficherToast(error.message, "error");
    } finally {
      bouton.disabled = false;
    }
  });

  document.getElementById("report-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    try {
      const demandeId = Number(document.getElementById("report-demande-id").value);
      // Si le client est arrivé depuis l'e-mail "Pas terminée", son signalement
      // enregistre aussi la contestation sans envoyer quoi que ce soit à son insu.
      if (demandesClient.find(d => Number(d.id)===demandeId)?.statut === 'attente_confirmation') {
        await requeteAPI(`/api/demandes/${demandeId}/contester-fin`, {method:'PUT'});
      }
      await requeteAPI("/api/signalements", {
        method: "POST",
        body: JSON.stringify({
          demandeId,
          motif: document.getElementById("report-motif").value,
          description: document.getElementById("report-description").value.trim()
        })
      });
      afficherToast("Votre signalement a été envoyé.");
      fermerModale("report-modal");
      form.reset();
    } catch (error) {
      afficherToast(error.message, "error");
    } finally {
      bouton.disabled = false;
    }
  });
}

// Ne montrer le profil qu’après la préparation de sa carte et des actions.
function actualiserChargementProfilClient() {
  const contenu=document.querySelector('[data-client-profile-content]');
  if (!contenu || document.getElementById('client-profile-card')?.dataset.profileReady !== '1' ||
      document.getElementById('account-profile-editor')?.dataset.profileReady !== '1') return;
  contenu.hidden=false;
  document.getElementById('client-profile-loading').hidden=true;
}

// Afficher le profil client
async function afficherProfilClient() {
  const cible = document.getElementById("client-profile-card");
  if (!cible || !window.utilisateurCourant) return;
  let utilisateur = window.utilisateurCourant;
  try { const {compte}=await requeteAPI('/api/account');utilisateur={...utilisateur,...compte}; }
  catch(e) {cible.textContent=e.message;cible.dataset.profileReady='1';actualiserChargementProfilClient();return;}

  const bienvenue = document.getElementById("client-welcome");
  if (bienvenue) {
    bienvenue.textContent = `Bienvenue ${nomComplet(utilisateur)}`;
  }

  cible.innerHTML = `
    <div class="client-profile-hero">
      <div class="client-profile-person">
        <img class="avatar large" id="client-photo-preview" src="${echapperHTML(imageProfil(utilisateur.photo_profil))}" alt="${echapperHTML(nomComplet(utilisateur))}" onerror="this.src='${DEFAULT_AVATAR}'">
        <div>
          <p class="client-profile-overline">MON ESPACE PERSONNEL</p>
          <h3>${echapperHTML(nomComplet(utilisateur))}</h3>
          <p class="client-profile-email">${echapperHTML(utilisateur.email)}</p>
          <span class="client-profile-label">● Compte client</span>
          <span class="client-profile-label secondary">Profil personnel</span>
        </div>
      </div>
      <aside class="client-profile-right">
        <span class="client-profile-shield" aria-hidden="true"><svg><use href="/images/icons/client-workspace.svg#i-shield"/></svg></span>
        <strong>Vos informations, à portée de main.</strong>
        <p>Mettez votre profil à jour pour faciliter vos échanges avec les artisans.</p>
        <button type="button" class="btn outline" id="client-open-edit-profile">Modifier mon profil ↗</button>
      </aside>
    </div>
    <div class="client-section-heading"><h2>Informations personnelles</h2><span>Données de votre compte</span></div>
    <div class="profile-fields client-profile-fields">
      <div><i aria-hidden="true"><svg><use href="/images/icons/client-workspace.svg#i-user"/></svg></i><span><strong>Nom</strong><br><span class="muted">${echapperHTML(utilisateur.nom || "Non précisé")}</span></span></div>
      <div><i aria-hidden="true"><svg><use href="/images/icons/client-workspace.svg#i-user"/></svg></i><span><strong>Prénom</strong><br><span class="muted">${echapperHTML(utilisateur.prenom || "Non précisé")}</span></span></div>
      <div><i aria-hidden="true"><svg><use href="/images/icons/client-workspace.svg#i-mail"/></svg></i><span><strong>Adresse e-mail</strong><br><span class="muted">${echapperHTML(utilisateur.email || "Non précisé")}</span></span></div>
      <div><i aria-hidden="true"><svg><use href="/images/icons/client-workspace.svg#i-phone"/></svg></i><span><strong>Téléphone</strong><br><span class="muted">${echapperHTML(utilisateur.telephone || "Non précisé")}</span></span></div>
      <div><i aria-hidden="true"><svg><use href="/images/icons/client-workspace.svg#i-location"/></svg></i><span><strong>Commune</strong><br><span class="muted">${echapperHTML(utilisateur.ville || "Non précisé")}</span></span></div>
      <div><i aria-hidden="true"><svg><use href="/images/icons/client-workspace.svg#i-location"/></svg></i><span><strong>Adresse</strong><br><span class="muted">${echapperHTML(utilisateur.adresse || "Non précisé")}</span></span></div>
    </div>`;
  // Utilise le formulaire existant, déplacé dans sa fenêtre par workspace-dialogs.js.
  document.getElementById('client-open-edit-profile')?.addEventListener('click', () => {
    document.querySelector('#account-profile-editor .workspace-actions .workspace-action')?.click();
  });
  cible.dataset.profileReady='1';
  actualiserChargementProfilClient();
}

// Modifier la photo de profil
function initialiserPhotoClient() {
  const form = document.getElementById("client-photo-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("client-photo-input");
    if (!input.files.length) {
      afficherToast("Veuillez choisir une image.", "error");
      return;
    }

    const data = new FormData();
    data.append("photo", input.files[0]);

    try {
      const reponse = await requeteAPI("/api/auth/photo", {
        method: "PUT",
        body: data
      });
      window.utilisateurCourant.photo_profil = reponse.photo_profil;
      document.getElementById("client-photo-preview").src = reponse.photo_profil;
      construireHeader();
      afficherToast("Photo de profil mise à jour.");
      form.reset();
    } catch (error) {
      afficherToast(error.message, "error");
    }
  });

  document.getElementById("client-photo-delete")?.addEventListener("click", async () => {
    try {
      await requeteAPI("/api/auth/photo", { method: "DELETE" });
      window.utilisateurCourant.photo_profil = null;
      document.getElementById("client-photo-preview").src = DEFAULT_AVATAR;
      construireHeader();
      afficherToast("Photo de profil supprimée.");
    } catch (error) {
      afficherToast(error.message, "error");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await attendreSession();
  if (!window.utilisateurCourant || window.utilisateurCourant.role !== "client") return;
  const page=document.body.dataset.workspacePage;
  if(page==='profil'){afficherProfilClient();initialiserPhotoClient();}
  if(page==='accueil'||page==='demandes'){
    if(page==='accueil')afficherStatsClient();
    if(page==='demandes')initialiserActionsClient();
    if (page === 'demandes') {
      document.querySelectorAll('[data-client-filter]').forEach(button => button.addEventListener('click', () => {
        document.querySelectorAll('[data-client-filter]').forEach(other => other.classList.toggle('active', other === button));
        afficherDemandesClient();
      }));
      document.getElementById('client-request-search')?.addEventListener('input', afficherDemandesClient);
    }
    if (page === 'accueil') {
      const name = nomComplet(window.utilisateurCourant);
      const target = document.getElementById('client-welcome');
      if (target && name) target.textContent = `Bienvenue ${name}, votre prochain projet commence ici.`;
    }
    chargerDemandesClient();
  }
});
