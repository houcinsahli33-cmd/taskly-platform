let demandesArtisan = [];
let profilArtisanCourant = null;
let filtreDemandesArtisan = "";
let rechercheDemandesArtisan = "";

function filtrerDemandesArtisan(demandes, statut, recherche) {
  const texte = recherche.trim().toLocaleLowerCase('fr');
  return demandes.filter(d => (!statut || d.statut === statut) &&
    (!texte || [d.client_nom, d.client_prenom, d.client_ville, d.message, d.id]
      .join(' ').toLocaleLowerCase('fr').includes(texte)));
}

// Calculer les compteurs artisan
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
  const cible = document.getElementById("artisan-stats") || document.getElementById("artisan-demandes-stats");
  if (!cible) return;

  const stats = statsDemandesArtisan(demandesArtisan);
  cible.innerHTML = `
    <div class="stat-card"><span>Demandes reçues</span><strong>${stats.total}</strong></div>
    <div class="stat-card"><span>En attente</span><strong>${stats.en_attente}</strong></div>
    <div class="stat-card"><span>Acceptées</span><strong>${stats.acceptee}</strong></div>
    <div class="stat-card"><span>Terminées</span><strong>${stats.terminee}</strong></div>
  `;
}

// Construire une carte demande artisan
function carteDemandeArtisan(demande) {
  const peutTraiter = demande.statut === "en_attente";
  const peutTerminer = demande.statut === "acceptee";
  const donneesPrivees = ['acceptee','attente_confirmation','terminee','conteste'].includes(demande.statut);

  return `
    <article class="request-card">
      <div class="request-head">
        <div>
          <h3>${echapperHTML(nomComplet(demande, "client_"))}</h3>
          <p class="muted">${echapperHTML(demande.client_ville || "Commune non précisée")} · ${echapperHTML(donneesPrivees ? (demande.client_telephone || "Téléphone non précisé") : "Coordonnées après acceptation")}</p>
        </div>
        ${badgeStatut(demande.statut)}
      </div>
      <p>${echapperHTML(demande.message || "Aucun message.")}</p>
      <div class="meta-row mt-14">
        <span class="badge">Adresse : ${echapperHTML(donneesPrivees ? (demande.adresse || demande.client_adresse || "Non précisée") : "Disponible après acceptation")}</span>
        <span class="badge">Date souhaitée : ${formatDate(demande.date_souhaitee)}</span>
        <span class="badge">Créée le ${formatDate(demande.created_at)}</span>
      </div>
      ${demande.motif_annulation ? `<p class="alert show warning mt-14">Motif d'annulation : ${echapperHTML(demande.motif_annulation)}</p>` : ""}
      <div class="request-actions">
        <button class="btn outline" type="button" data-view-artisan-request="${Number(demande.id)}">Consulter la demande</button>
        ${peutTraiter ? `<button class="btn primary" type="button" data-set-status="${demande.id}" data-status="acceptee">Accepter</button>` : ""}
        ${peutTraiter ? `<button class="btn outline" type="button" data-set-status="${demande.id}" data-status="refusee">Refuser</button>` : ""}
        ${peutTerminer ? `<button class="btn primary" type="button" data-complete-request="${demande.id}">Marquer terminée</button>` : ""}
        ${peutTerminer ? `<button class="btn outline" type="button" data-open-cancel-artisan="${demande.id}">Annuler avec motif</button>` : ""}
        ${(["acceptee","attente_confirmation","terminee","conteste"].includes(demande.statut) || (demande.statut === "annulee" && demande.date_traitement)) ? `<button class="btn outline" type="button" data-open-taskly-chat="${Number(demande.id)}">Ouvrir le chat</button>` : ""}
        <button class="btn danger" type="button" data-open-report="${demande.id}">Signaler</button>
      </div>
    </article>
  `;
}

// Afficher les demandes recues
function afficherDemandesArtisan() {
  const cible = document.getElementById("artisan-requests");
  if (!cible) return;

  const demandes = filtrerDemandesArtisan(demandesArtisan, filtreDemandesArtisan, rechercheDemandesArtisan);
  if (!demandes.length) {
    cible.innerHTML = etatVide(demandesArtisan.length ? "Aucune demande ne correspond à votre recherche." : "Aucune demande reçue pour le moment.");
    return;
  }

  cible.innerHTML = demandes.map(carteDemandeArtisan).join("");
}

function afficherDernieresDemandesArtisan() {
  const cible = document.getElementById('artisan-recent-requests');
  if (!cible) return;
  if (!demandesArtisan.length) {
    cible.innerHTML = `<div class="artisan-empty"><span class="artisan-empty-icon" aria-hidden="true">✉</span><div><h3>Aucune demande pour le moment</h3><p>Lorsqu’un client vous contactera, sa demande apparaîtra ici et dans la rubrique « Demandes reçues ».</p><a class="btn outline" href="/espace/artisan/profil">Consulter mon profil →</a></div></div>`;
    return;
  }
  cible.innerHTML = [...demandesArtisan].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0,3).map(d =>
    `<article class="artisan-recent"><div><h3>${echapperHTML(nomComplet(d,'client_'))}</h3><p>${echapperHTML(tronquer(d.message || '',100))}</p><small>${formatDate(d.created_at)}</small></div>${badgeStatut(d.statut)}<a href="/espace/artisan/demandes">Consulter →</a></article>`).join('');
}

// Charger les demandes depuis le backend
async function chargerDemandesArtisan() {
  const cible = document.getElementById("artisan-requests");
  if (cible) cible.innerHTML = etatChargement("Chargement des demandes reçues...");
  const recentes = document.getElementById('artisan-recent-requests');
  if (recentes) recentes.innerHTML = etatChargement("Chargement des demandes reçues...");

  try {
    const data = await requeteAPI("/api/demandes/artisan");
    demandesArtisan = data.demandes || [];
    afficherStatsArtisan();
    afficherDemandesArtisan();
    afficherDernieresDemandesArtisan();
  } catch (error) {
    if (cible) cible.innerHTML = etatVide(error.message);
    if (recentes) recentes.innerHTML = etatVide(error.message);
  }
}

// Changer le statut d'une demande
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

// Marquer une demande comme terminee
async function terminerDemandeArtisan(id) {
  try {
    await requeteAPI(`/api/demandes/${id}/terminer`, { method: "PUT" });
    afficherToast("Le client a reçu une demande de confirmation de fin de prestation.");
    chargerDemandesArtisan();
  } catch (error) {
    afficherToast(error.message, "error");
  }
}

// Ouvrir la modale d'annulation artisan
function ouvrirAnnulationArtisan(id) {
  document.getElementById("cancel-artisan-demande-id").value = id;
  ouvrirModale("cancel-artisan-modal");
}

// Ouvrir la modale de signalement artisan
function ouvrirSignalementArtisan(id) {
  document.getElementById("artisan-report-demande-id").value = id;
  ouvrirModale("artisan-report-modal");
}

// Initialiser les actions artisan
function initialiserActionsArtisan() {
  document.querySelectorAll('[data-artisan-filter]').forEach(bouton => bouton.addEventListener('click', () => {
    filtreDemandesArtisan = bouton.dataset.artisanFilter;
    document.querySelectorAll('[data-artisan-filter]').forEach(b => {
      const actif = b === bouton;
      b.classList.toggle('active', actif);
      b.setAttribute('aria-pressed', String(actif));
    });
    afficherDemandesArtisan();
  }));
  document.getElementById('artisan-request-search')?.addEventListener('input', event => {
    rechercheDemandesArtisan = event.target.value;
    afficherDemandesArtisan();
  });
  document.addEventListener("click", (event) => {
    const details = event.target.closest("[data-view-artisan-request]");
    if (details) consulterDemandeArtisan(details.dataset.viewArtisanRequest);
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
    const {compte}=await requeteAPI('/api/account');
    profilArtisanCourant={...compte,id:compte.artisan_id,user_id:compte.id};
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
        <div class="meta-row mt-12">
          <span class="badge primary">${Number(profilArtisanCourant?.experience || 0)} an(s) d'expérience</span>
          <span class="badge accent">${echapperHTML(noteArtisan(profilArtisanCourant || {}))}</span>
        </div>
      </div>
    </div>
    <div class="profile-fields">
      <div><i aria-hidden="true"><svg viewBox="0 0 24 24"><use href="/images/icons/client-workspace.svg#i-user"/></svg></i><span><strong>Nom</strong><br><span class="muted">${echapperHTML(utilisateur.nom || "Non précisé")}</span></span></div>
      <div><i aria-hidden="true"><svg viewBox="0 0 24 24"><use href="/images/icons/client-workspace.svg#i-user"/></svg></i><span><strong>Prénom</strong><br><span class="muted">${echapperHTML(utilisateur.prenom || "Non précisé")}</span></span></div>
      <div><i aria-hidden="true"><svg viewBox="0 0 24 24"><use href="/images/icons/client-workspace.svg#i-mail"/></svg></i><span><strong>Email</strong><br><span class="muted">${echapperHTML(utilisateur.email || "Non précisé")}</span></span></div>
      <div><i aria-hidden="true"><svg viewBox="0 0 24 24"><use href="/images/icons/client-workspace.svg#i-phone"/></svg></i><span><strong>Téléphone</strong><br><span class="muted">${echapperHTML(profilArtisanCourant?.telephone || "Non précisé")}</span></span></div>
      <div><i aria-hidden="true"><svg viewBox="0 0 24 24"><use href="/images/icons/client-workspace.svg#paper"/></svg></i><span><strong>Service</strong><br><span class="muted">${echapperHTML(profilArtisanCourant?.service_nom || "Non précisé")}</span></span></div>
      <div><i aria-hidden="true"><svg viewBox="0 0 24 24"><use href="/images/icons/client-workspace.svg#i-location"/></svg></i><span><strong>Commune</strong><br><span class="muted">${echapperHTML(profilArtisanCourant?.ville || "Non précisée")}</span></span></div>
      <div><i aria-hidden="true"><svg viewBox="0 0 24 24"><use href="/images/icons/client-workspace.svg#clock"/></svg></i><span><strong>Expérience</strong><br><span class="muted">${Number(profilArtisanCourant?.experience || 0)} an(s)</span></span></div>
      <div><i aria-hidden="true"><svg viewBox="0 0 24 24"><use href="/images/icons/client-workspace.svg#i-chat"/></svg></i><span><strong>Description</strong><br><span class="muted">${echapperHTML(profilArtisanCourant?.description || "Non précisée")}</span></span></div>
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
    const stats = document.getElementById('artisan-review-stats');
    if (stats) stats.innerHTML = `<div class="stat-card"><span>Total des avis</span><strong>${Number(statistiques.total_avis || 0)}</strong></div><div class="stat-card"><span>Note moyenne</span><strong>${Number(statistiques.total_avis) ? Number(statistiques.moyenne_note || 0).toFixed(1) : '—'} / 5</strong></div><div class="stat-card"><span>Avis affichés</span><strong>${Math.min(avis.length,6)}</strong></div>`;
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
      window.utilisateurCourant.photo_profil = reponse.photo_profil;
      if (profilArtisanCourant) profilArtisanCourant.photo_profil = reponse.photo_profil;
      document.getElementById("artisan-photo-preview").src = reponse.photo_profil;
      construireHeader();
      afficherToast("Photo de profil mise à jour.");
      form.reset();
    } catch (error) {
      afficherToast(error.message, "error");
    }
  });

  document.getElementById("artisan-photo-delete")?.addEventListener("click", async () => {
    try {
      await requeteAPI("/api/auth/photo", { method: "DELETE" });
      window.utilisateurCourant.photo_profil = null;
      if (profilArtisanCourant) profilArtisanCourant.photo_profil = null;
      document.getElementById("artisan-photo-preview").src = DEFAULT_AVATAR;
      construireHeader();
      afficherToast("Photo de profil supprimée.");
    } catch (error) {
      afficherToast(error.message, "error");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await attendreSession();
  if (!window.utilisateurCourant || window.utilisateurCourant.role !== "artisan") return;
  const page=document.body.dataset.workspacePage;
  if(page==='profil'){await chargerProfilArtisanDashboard();initialiserPhotoArtisan();}
  if(page==='avis'){
    const cible=document.getElementById('artisan-reviews-dashboard');
    try {const {compte}=await requeteAPI('/api/account');profilArtisanCourant={...compte,id:compte.artisan_id};await chargerAvisArtisan();}
    catch(error){cible.textContent=error.message;}
  }
  if(page==='accueil'||page==='demandes'){
    if(page==='demandes')initialiserActionsArtisan();
    chargerDemandesArtisan();
  }
});


// Ouvre les informations privées d'une demande appartenant au profil artisan actif.
// Le serveur décide quelles coordonnées sont accessibles selon le statut.
async function consulterDemandeArtisan(id) {
  let dialogue = document.getElementById("taskly-detail-artisan");
  if (!dialogue) {
    dialogue = document.createElement("dialog");
    dialogue.id = "taskly-detail-artisan";
    dialogue.className = "taskly-detail-dialog";
    dialogue.innerHTML = '<div class="taskly-detail-content"><button class="btn outline taskly-detail-close" type="button" data-close-artisan-detail>Fermer ×</button><div id="taskly-detail-body"></div></div>';
    document.body.appendChild(dialogue);
    dialogue.addEventListener("click", (event) => {
      if (event.target === dialogue || event.target.closest("[data-close-artisan-detail]")) dialogue.close();
      if (event.target.closest("[data-set-status], [data-complete-request], [data-open-cancel-artisan], [data-open-report]")) dialogue.close();
    });
  }
  const corps = dialogue.querySelector("#taskly-detail-body");
  corps.innerHTML = '<p class="taskly-detail-loading" role="status">Chargement des informations…</p>';
  corps.setAttribute('aria-busy','true');
  const ouverture = (dialogue._tasklyOuverture = (dialogue._tasklyOuverture || 0) + 1);
  if (!dialogue.open) dialogue.showModal();
  try {
    const { demande: d } = await requeteAPI("/api/demandes/" + encodeURIComponent(id) + "/details");
    if (!d) throw new Error("Demande indisponible.");
    if (ouverture !== dialogue._tasklyOuverture || !dialogue.open) return;
    corps.removeAttribute('aria-busy');
    const autorisee = ["acceptee", "attente_confirmation", "terminee", "conteste"].includes(d.statut);
    const nom = echapperHTML(nomComplet(d, "client_"));
    const commune = echapperHTML(d.client_ville || "Commune non précisée");
    const adresse = autorisee ? String(d.adresse || "") : "";
    const numero = Number(d.id);
    const tel = autorisee && d.client_telephone ? String(d.client_telephone) : "";
    const email = autorisee && d.client_email ? String(d.client_email) : "";
    const telHref = tel.replace(/[^+0-9]/g, "");
    const courrielHref = encodeURIComponent(email).replace(/%40/g,"@");
    const destination = encodeURIComponent([adresse, d.client_ville, "Algérie"].filter(Boolean).join(", "));
    const googleMaps = "https://www.google.com/maps/dir/?api=1&destination=" + destination;
    const peutTraiter = d.statut === "en_attente";
    const peutTerminer = d.statut === "acceptee";
    // SVG locaux, identiques pour chaque demande ; seules les données proviennent de l'API.
    const pictos={
      user:'<circle cx="12" cy="8" r="3.4"/><path d="M5 21c0-4 2.7-6.5 7-6.5s7 2.5 7 6.5"/>',
      phone:'<path d="M7 3h3l1.3 4-2 1.7c1.2 2.4 3.1 4.2 5.4 5.4l1.7-2L21 14v3c0 2-1.7 3.5-3.7 3.1A17 17 0 0 1 3.9 6.7C3.5 4.7 5 3 7 3Z"/>',
      mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.4"/>',
      briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18M11 12v2h2v-2"/>',
      wrench:'<path d="M14 7a5 5 0 0 1 6-4l-4 4 1 3 3 1a5 5 0 0 1-6 4l-8 8-4-4 8-8a5 5 0 0 1 4-4Z"/>',
      message:'<rect x="3" y="4" width="18" height="15" rx="2"/><path d="M7 9h10M7 13h7M9 19l-3 3v-3"/>',
      calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/>',
      created:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18m-12 6 2 2 4-4"/>',
      check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
      navigate:'<path d="m3 11 18-8-8 18-2-8-8-2Z"/>',
      external:'<path d="M13 4h7v7M20 4 10 14"/><path d="M20 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"/>',
      flag:'<path d="M5 22V3m0 2c6-4 8 4 15 0v12c-7 4-9-4-15 0"/>'
    };
    const picto=nom=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pictos[nom]}</svg>`;
    const detailRow=(icon,libelle,valeur,classe='')=>`<div class="taskly-detail-row ${classe}"><span class="taskly-row-icon taskly-picto-${icon}" aria-hidden="true">${picto(icon)}</span><span class="taskly-row-label">${libelle}</span><span class="taskly-row-value">${valeur}</span></div>`;
    corps.innerHTML = `<h2>Demande n° ${numero}</h2>${badgeStatut(d.statut)}
      <section class="taskly-detail-grid">
        <section class="taskly-detail-card"><h3><span class="taskly-heading-icon" aria-hidden="true">${picto("user")}</span>Informations du client</h3>
          ${detailRow('user','Nom complet',nom)}
          ${detailRow('phone','Téléphone',tel ? `<a href="tel:${telHref}">${echapperHTML(tel)}</a>` : 'Disponible après acceptation')}
          ${detailRow('mail','Email',email ? `<a href="mailto:${courrielHref}">${echapperHTML(email)}</a>` : 'Disponible après acceptation')}
          ${detailRow('pin','Adresse',adresse ? echapperHTML(adresse) : commune)}
        </section>
        <section class="taskly-detail-card"><h3><span class="taskly-heading-icon" aria-hidden="true">${picto("briefcase")}</span>La prestation</h3>
          ${detailRow('wrench','Métier',echapperHTML(d.service_nom || 'Non précisé'))}
          ${detailRow('message','Demande',`<span class="taskly-detail-message" id="taskly-detail-message-${numero}">${echapperHTML(d.message || 'Aucun message fourni.')}</span><button type="button" class="taskly-detail-expand" aria-expanded="false" aria-label="Afficher la description complète" aria-controls="taskly-detail-message-${numero}" hidden>⌄</button>`,'taskly-detail-message-row')}
          ${detailRow('calendar','Date souhaitée',echapperHTML(formatDate(d.date_souhaitee)))}
          ${detailRow('created','Créée le',echapperHTML(formatDate(d.created_at)))}
          ${detailRow('check','Statut',`<span class="taskly-detail-status">${echapperHTML(libelleStatut(d.statut))}</span>`)}
        </section>
      </section>
      <div class="request-actions taskly-detail-actions">
        ${peutTraiter ? `<button class="btn primary" type="button" data-set-status="${numero}" data-status="acceptee">Accepter</button><button class="btn outline" type="button" data-set-status="${numero}" data-status="refusee">Refuser</button>` : ""}
        ${peutTerminer ? `<button class="btn primary" type="button" data-complete-request="${numero}">Marquer terminée</button><button class="btn outline" type="button" data-open-cancel-artisan="${numero}">Annuler avec motif</button>` : ""}
        <button class="btn danger taskly-detail-report" type="button" data-open-report="${numero}">${picto("flag")} Signaler</button>
      </div>
      ${autorisee && adresse ? `<div class="taskly-route-preview"><h3><span class="taskly-location-picto">${picto("pin")}</span>Localisation de l'intervention</h3>
        <iframe title="Carte de l'intervention" referrerpolicy="strict-origin-when-cross-origin" loading="lazy" src="https://maps.google.com/maps?q=${destination}&amp;output=embed" id="taskly-route-map-${numero}"></iframe>
        <div class="taskly-detail-actions taskly-route-actions"><a class="btn outline" target="_blank" rel="noopener noreferrer" href="${googleMaps}" data-taskly-route="${numero}">${picto("navigate")} Calculer le trajet sur cette carte</a>
        <a class="btn primary" target="_blank" rel="noopener noreferrer" href="${googleMaps}">${picto("external")} Ouvrir l'itinéraire Google Maps</a></div>
        <p id="taskly-route-status-${numero}" role="status" class="muted">Le trajet intégré nécessite votre autorisation de localisation et l'activation du service de carte.</p></div>` : ""}`;
    const message = corps.querySelector('.taskly-detail-message');
    const developper = corps.querySelector('.taskly-detail-expand');
    if (message && developper) {
      const ajuster = () => {
        if (message.classList.contains('expanded')) return;
        developper.hidden = !(message.scrollHeight > message.clientHeight + 2);
      };
      developper.addEventListener('click', () => {
        const ouvert = message.classList.toggle('expanded');
        developper.setAttribute('aria-expanded', String(ouvert));
        developper.setAttribute('aria-label', ouvert ? 'Réduire la description' : 'Afficher la description complète');
        developper.textContent = ouvert ? '⌃' : '⌄';
      });
      requestAnimationFrame(ajuster);
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(ajuster).observe(message);
    }
    if (autorisee && adresse) {
      const bouton = corps.querySelector('[data-taskly-route]');
      // Charger la configuration sans bloquer l'ouverture du dialogue.
      // Si la clé Embed n'est pas disponible, l'ancre garde le vrai trajet Google Maps.
      let embedKey = null;
      requeteAPI('/api/demandes/itineraire/config')
        .then(res => { embedKey = typeof res.embedKey === 'string' ? res.embedKey : null; })
        .catch(() => { embedKey = null; });
      bouton?.addEventListener('click', async event => {
        const status = corps.querySelector('#taskly-route-status-'+numero);
        // La vérification est synchrone : la navigation de secours reste fiable.
        if (!embedKey || !navigator.geolocation) {
          status.textContent = 'Le trajet intégré n’est pas configuré : ouvrez l’itinéraire dans Google Maps.';
          return;
        }
        event.preventDefault();
        bouton.setAttribute('aria-disabled','true');
        status.textContent = 'Localisation en cours : autorisez votre position pour tracer le trajet.';
        try {
          const position = await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,
            {enableHighAccuracy:false,timeout:12000,maximumAge:120000}));
          if (!dialogue.open || ouverture !== dialogue._tasklyOuverture) return;
          const origine=position.coords.latitude+','+position.coords.longitude;
          const route='https://www.google.com/maps/embed/v1/directions?key='+encodeURIComponent(embedKey)+
            '&origin='+encodeURIComponent(origine)+'&destination='+destination+'&mode=driving';
          const iframe=corps.querySelector('#taskly-route-map-'+numero);
          if (iframe) {
            iframe.src=route;
            status.textContent='Chargement du trajet routier sur la carte…';
            iframe.addEventListener('load',()=>{
              if(dialogue.open && ouverture === dialogue._tasklyOuverture) status.textContent='Carte d’itinéraire chargée. Si aucun tracé n’apparaît, utilisez Google Maps.';
            },{once:true});
          }
        } catch(e) {
          status.textContent = 'Position indisponible. Le bouton Google Maps permet de poursuivre le trajet.';
        } finally {
          bouton.removeAttribute('aria-disabled');
        }
      });
    }
  } catch (error) {
    if (ouverture === dialogue._tasklyOuverture && dialogue.open) {
      corps.removeAttribute('aria-busy');
      corps.textContent = error.message || "Détail indisponible.";
    }
  }
}
