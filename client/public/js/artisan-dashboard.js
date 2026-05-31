let demandesArtisan = [];
let profilArtisanCourant = null;

function statsDemandesArtisan(demandes) {
  return {
    total: demandes.length,
    en_attente: demandes.filter((d) => d.statut === "en_attente").length,
    acceptee: demandes.filter((d) => d.statut === "acceptee").length,
    terminee: demandes.filter((d) => d.statut === "terminee").length
  };
}

// Afficher les statistiques artisan
function afficherStatsArtisan() {
  const cible = document.getElementById("artisan-stats");
  if (!cible) return;

  const stats = statsDemandesArtisan(demandesArtisan);
  cible.innerHTML = `
    <div class="stat-card"><span>Demandes reçues</span><strong>${stats.total}</strong></div>
    <div class="stat-card"><span>En attente</span><strong>${stats.en_attente}</strong></div>
    <div class="stat-card"><span>Acceptées</span><strong>${stats.acceptee}</strong></div>
    <div class="stat-card"><span>Terminées</span><strong>${stats.terminee}</strong></div>
  `;
}

function carteDemandeArtisan(demande) {
  const peutTraiter = demande.statut === "en_attente";
  const peutTerminer = demande.statut === "acceptee";

  return `
    <article class="request-card">
      <div class="request-head">
        <div>
          <h3>${echapperHTML(nomComplet(demande, "client_"))}</h3>
          <p class="muted">${echapperHTML(demande.client_ville || "Commune non précisée")} · ${echapperHTML(demande.client_telephone || "Téléphone non précisé")}</p>
        </div>
        ${badgeStatut(demande.statut)}
      </div>
      <p>${echapperHTML(demande.message || "Aucun message.")}</p>
      <div class="meta-row" style="margin-top:14px">
        <span class="badge">Adresse : ${echapperHTML(demande.adresse || demande.client_adresse || "Non précisée")}</span>
        <span class="badge">Date souhaitée : ${formatDate(demande.date_souhaitee)}</span>
        <span class="badge">Créée le ${formatDate(demande.created_at)}</span>
      </div>
      ${demande.motif_annulation ? `<p class="alert show warning" style="margin-top:14px">Motif d'annulation : ${echapperHTML(demande.motif_annulation)}</p>` : ""}
      <div class="request-actions">
        ${peutTraiter ? `<button class="btn primary" type="button" data-set-status="${demande.id}" data-status="acceptee">Accepter</button>` : ""}
        ${peutTraiter ? `<button class="btn outline" type="button" data-set-status="${demande.id}" data-status="refusee">Refuser</button>` : ""}
        ${peutTerminer ? `<button class="btn primary" type="button" data-complete-request="${demande.id}">Marquer terminée</button>` : ""}
        ${peutTerminer ? `<button class="btn outline" type="button" data-open-cancel-artisan="${demande.id}">Annuler avec motif</button>` : ""}
        <button class="btn ghost" type="button" data-open-report="${demande.id}">Signaler</button>
      </div>
    </article>
  `;
}

// Afficher les demandes reçues
function afficherDemandesArtisan() {
  const cible = document.getElementById("artisan-requests");
  if (!cible) return;

  if (!demandesArtisan.length) {
    cible.innerHTML = etatVide("Aucune demande reçue pour le moment.");
    return;
  }

  cible.innerHTML = demandesArtisan.map(carteDemandeArtisan).join("");
}

// Charger les demandes depuis le backend
async function chargerDemandesArtisan() {
  const cible = document.getElementById("artisan-requests");
  if (cible) cible.innerHTML = etatChargement("Chargement des demandes reçues...");

  try {
    const data = await requeteAPI("/api/demandes/artisan");
    demandesArtisan = data.demandes || [];
    afficherStatsArtisan();
    afficherDemandesArtisan();
  } catch (error) {
    if (cible) cible.innerHTML = etatVide(error.message);
  }
}

async function changerStatutDemande(id, statut) {
  try {
    await requeteAPI(`/api/demandes/${id}/statut`, {
      method: "PUT",
      body: JSON.stringify({ statut })
    });
    afficherToast("Statut mis à jour.");
    chargerDemandesArtisan();
  } catch (error) {
    afficherToast(error.message, "error");
  }
}

async function terminerDemandeArtisan(id) {
  try {
    await requeteAPI(`/api/demandes/${id}/terminer`, { method: "PUT" });
    afficherToast("Travail marqué comme terminé.");
    chargerDemandesArtisan();
  } catch (error) {
    afficherToast(error.message, "error");
  }
}

function ouvrirAnnulationArtisan(id) {
  document.getElementById("cancel-artisan-demande-id").value = id;
  ouvrirModale("cancel-artisan-modal");
}

function ouvrirSignalementArtisan(id) {
  document.getElementById("artisan-report-demande-id").value = id;
  ouvrirModale("artisan-report-modal");
}

// Initialiser les actions artisan
function initialiserActionsArtisan() {
  document.addEventListener("click", (event) => {
    const statut = event.target.closest("[data-set-status]");
    const terminer = event.target.closest("[data-complete-request]");
    const annuler = event.target.closest("[data-open-cancel-artisan]");
    const signaler = event.target.closest("[data-open-report]");

    if (statut) changerStatutDemande(statut.dataset.setStatus, statut.dataset.status);
    if (terminer) terminerDemandeArtisan(terminer.dataset.completeRequest);
    if (annuler) ouvrirAnnulationArtisan(annuler.dataset.openCancelArtisan);
    if (signaler) ouvrirSignalementArtisan(signaler.dataset.openReport);
  });

  document.getElementById("cancel-artisan-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    try {
      await requeteAPI(`/api/demandes/${document.getElementById("cancel-artisan-demande-id").value}/annuler-artisan`, {
        method: "PUT",
        body: JSON.stringify({
          motifAnnulation: document.getElementById("cancel-artisan-reason").value.trim()
        })
      });
      afficherToast("Demande annulée avec motif.");
      fermerModale("cancel-artisan-modal");
      form.reset();
      chargerDemandesArtisan();
    } catch (error) {
      afficherToast(error.message, "error");
    } finally {
      bouton.disabled = false;
    }
  });

  document.getElementById("artisan-report-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    try {
      await requeteAPI("/api/signalements", {
        method: "POST",
        body: JSON.stringify({
          demandeId: Number(document.getElementById("artisan-report-demande-id").value),
          motif: document.getElementById("artisan-report-motif").value,
          description: document.getElementById("artisan-report-description").value.trim()
        })
      });
      afficherToast("Signalement envoyé.");
      fermerModale("artisan-report-modal");
      form.reset();
    } catch (error) {
      afficherToast(error.message, "error");
    } finally {
      bouton.disabled = false;
    }
  });
}

// Charger le profil de l'artisan connecte
async function chargerProfilArtisanDashboard() {
  const cible = document.getElementById("artisan-profile-card");
  if (!cible || !window.utilisateurCourant) return;

  try {
    const { artisans } = await requeteAPI("/api/artisans");
    profilArtisanCourant = artisans.find((artisan) => artisan.user_id === window.utilisateurCourant.id);
  } catch (error) {
    profilArtisanCourant = null;
  }

  const utilisateur = window.utilisateurCourant;
  const bienvenue = document.getElementById("artisan-welcome");
  if (bienvenue) {
    bienvenue.textContent = `Bienvenue ${nomComplet(utilisateur)}`;
  }

  cible.innerHTML = `
    <div class="profile-panel">
      <img class="avatar large" id="artisan-photo-preview" src="${echapperHTML(imageProfil(profilArtisanCourant?.photo_profil))}" alt="${echapperHTML(nomComplet(utilisateur))}" onerror="this.src='${DEFAULT_AVATAR}'">
      <div>
        <h3>${echapperHTML(nomComplet(utilisateur))}</h3>
        <p class="muted">${echapperHTML(profilArtisanCourant?.service_nom || "Artisan Taskly")} · ${echapperHTML(profilArtisanCourant?.ville || "")}</p>
        <div class="meta-row" style="margin-top:12px">
          <span class="badge primary">${Number(profilArtisanCourant?.experience || 0)} an(s) d'expérience</span>
          <span class="badge accent">${echapperHTML(noteArtisan(profilArtisanCourant || {}))}</span>
        </div>
      </div>
    </div>
    <div class="profile-fields">
      <div><strong>Nom</strong><br><span class="muted">${echapperHTML(utilisateur.nom || "Non précisé")}</span></div>
      <div><strong>Prénom</strong><br><span class="muted">${echapperHTML(utilisateur.prenom || "Non précisé")}</span></div>
      <div><strong>Email</strong><br><span class="muted">${echapperHTML(utilisateur.email || "Non précisé")}</span></div>
      <div><strong>Téléphone</strong><br><span class="muted">${echapperHTML(profilArtisanCourant?.telephone || "Non précisé")}</span></div>
      <div><strong>Service</strong><br><span class="muted">${echapperHTML(profilArtisanCourant?.service_nom || "Non précisé")}</span></div>
      <div><strong>Commune</strong><br><span class="muted">${echapperHTML(profilArtisanCourant?.ville || "Non précisée")}</span></div>
      <div><strong>Expérience</strong><br><span class="muted">${Number(profilArtisanCourant?.experience || 0)} an(s)</span></div>
      <div><strong>Description</strong><br><span class="muted">${echapperHTML(profilArtisanCourant?.description || "Non précisée")}</span></div>
    </div>
  `;

  chargerAvisArtisan();
}

// Charger les avis de l'artisan
async function chargerAvisArtisan() {
  const cible = document.getElementById("artisan-reviews-dashboard");
  if (!cible || !profilArtisanCourant) {
    if (cible) cible.innerHTML = etatVide("Les avis apparaîtront ici après vos premières missions terminées.");
    return;
  }

  cible.innerHTML = etatChargement("Chargement des avis...");

  try {
    const { avis, statistiques } = await requeteAPI(`/api/avis/artisan/${profilArtisanCourant.id}`);
    if (!avis.length) {
      cible.innerHTML = etatVide("Aucun avis reçu pour le moment.");
      return;
    }

    cible.innerHTML = `
      <div class="alert show success">Moyenne actuelle : <strong>${statistiques.moyenne_note || 0}/5</strong> sur ${statistiques.total_avis || 0} avis.</div>
      <div class="grid three">
        ${avis.slice(0, 6).map((item) => `
          <article class="card review-card">
            <div class="card-body">
              <div class="stars">${afficherEtoiles(item.note)}</div>
              <h3>${echapperHTML(nomComplet(item, "client_"))}</h3>
              <p class="muted">${echapperHTML(item.commentaire || "Avis sans commentaire.")}</p>
              <p class="text-small muted">${formatDate(item.created_at)}</p>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  } catch (error) {
    cible.innerHTML = etatVide(error.message);
  }
}

// Modifier la photo de profil
function initialiserPhotoArtisan() {
  const form = document.getElementById("artisan-photo-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("artisan-photo-input");
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
      document.getElementById("artisan-photo-preview").src = reponse.photo_profil;
      afficherToast("Photo de profil mise à jour.");
      form.reset();
    } catch (error) {
      afficherToast(error.message, "error");
    }
  });

  document.getElementById("artisan-photo-delete")?.addEventListener("click", async () => {
    try {
      await requeteAPI("/api/auth/photo", { method: "DELETE" });
      document.getElementById("artisan-photo-preview").src = DEFAULT_AVATAR;
      afficherToast("Photo de profil supprimée.");
    } catch (error) {
      afficherToast(error.message, "error");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await attendreSession();
  if (!window.utilisateurCourant || window.utilisateurCourant.role !== "artisan") return;
  await chargerProfilArtisanDashboard();
  afficherStatsArtisan();
  initialiserPhotoArtisan();
  initialiserActionsArtisan();
  chargerDemandesArtisan();
});
