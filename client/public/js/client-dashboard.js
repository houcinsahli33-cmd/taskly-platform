let demandesClient = [];

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
  const cible = document.getElementById("client-stats");
  if (!cible) return;

  const stats = statsDemandes(demandesClient);
  cible.innerHTML = `
    <div class="stat-card"><span>Total demandes</span><strong>${stats.total}</strong></div>
    <div class="stat-card"><span>En attente</span><strong>${stats.en_attente}</strong></div>
    <div class="stat-card"><span>Terminées</span><strong>${stats.terminee}</strong></div>
    <div class="stat-card"><span>Annulées ou refusées</span><strong>${stats.annulee}</strong></div>
  `;
}

function carteDemandeClient(demande) {
  const peutAnnuler = demande.statut === "en_attente";
  const peutAvis = demande.statut === "terminee" && !demande.avis_id;
  const dejaAvis = demande.avis_id;

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
      <div class="meta-row" style="margin-top:14px">
        <span class="badge">Adresse : ${echapperHTML(demande.adresse || "Non précisée")}</span>
        <span class="badge">Date souhaitée : ${formatDate(demande.date_souhaitee)}</span>
        <span class="badge">Créée le ${formatDate(demande.created_at)}</span>
        ${dejaAvis ? `<span class="badge accent">Avis : ${demande.avis_note}/5</span>` : ""}
      </div>
      ${demande.motif_annulation ? `<p class="alert show warning" style="margin-top:14px">Motif d'annulation : ${echapperHTML(demande.motif_annulation)}</p>` : ""}
      <div class="request-actions">
        ${peutAnnuler ? `<button class="btn outline" type="button" data-cancel-request="${demande.id}">Annuler</button>` : ""}
        ${peutAvis ? `<button class="btn primary" type="button" data-open-review="${demande.id}">Laisser un avis</button>` : ""}
        <button class="btn ghost" type="button" data-open-report="${demande.id}">Signaler</button>
      </div>
    </article>
  `;
}

// Afficher les demandes du client
function afficherDemandesClient() {
  const cible = document.getElementById("client-requests");
  if (!cible) return;

  if (!demandesClient.length) {
    cible.innerHTML = etatVide("Aucune demande pour le moment. Parcourez les artisans pour démarrer.");
    return;
  }

  cible.innerHTML = demandesClient.map(carteDemandeClient).join("");
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
  } catch (error) {
    if (cible) cible.innerHTML = etatVide(error.message);
  }
}

async function annulerDemandeClient(id) {
  try {
    await requeteAPI(`/api/demandes/${id}/annuler`, { method: "PUT" });
    afficherToast("Demande annulée avec succès.");
    chargerDemandesClient();
  } catch (error) {
    afficherToast(error.message, "error");
  }
}

function ouvrirAvisClient(id) {
  document.getElementById("review-demande-id").value = id;
  ouvrirModale("review-modal");
}

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

    if (annuler) annulerDemandeClient(annuler.dataset.cancelRequest);
    if (avis) ouvrirAvisClient(avis.dataset.openReview);
    if (signaler) ouvrirSignalementClient(signaler.dataset.openReport);
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
      await requeteAPI("/api/signalements", {
        method: "POST",
        body: JSON.stringify({
          demandeId: Number(document.getElementById("report-demande-id").value),
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

// Afficher le profil client
function afficherProfilClient() {
  const cible = document.getElementById("client-profile-card");
  if (!cible || !window.utilisateurCourant) return;
  const utilisateur = window.utilisateurCourant;

  const bienvenue = document.getElementById("client-welcome");
  if (bienvenue) {
    bienvenue.textContent = `Bienvenue ${nomComplet(utilisateur)}`;
  }

  cible.innerHTML = `
    <div class="profile-panel">
      <img class="avatar large" id="client-photo-preview" src="${echapperHTML(imageProfil(utilisateur.photo_profil))}" alt="${echapperHTML(nomComplet(utilisateur))}" onerror="this.src='${DEFAULT_AVATAR}'">
      <div>
        <h3>${echapperHTML(nomComplet(utilisateur))}</h3>
        <p class="muted">${echapperHTML(utilisateur.email)}</p>
        <span class="badge primary">Compte client</span>
      </div>
    </div>
    <div class="profile-fields">
      <div><strong>Nom</strong><br><span class="muted">${echapperHTML(utilisateur.nom || "Non précisé")}</span></div>
      <div><strong>Prénom</strong><br><span class="muted">${echapperHTML(utilisateur.prenom || "Non précisé")}</span></div>
      <div><strong>Email</strong><br><span class="muted">${echapperHTML(utilisateur.email || "Non précisé")}</span></div>
      <div><strong>Téléphone</strong><br><span class="muted">Non disponible dans cette session</span></div>
      <div><strong>Commune</strong><br><span class="muted">Non disponible dans cette session</span></div>
      <div><strong>Adresse</strong><br><span class="muted">Non disponible dans cette session</span></div>
    </div>
  `;
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
  afficherProfilClient();
  afficherStatsClient();
  initialiserPhotoClient();
  initialiserActionsClient();
  chargerDemandesClient();
});
