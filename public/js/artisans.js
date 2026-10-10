// Construire une carte artisan
function carteArtisan(artisan) {
  return `
    <article class="card artisan-card">
      <div class="card-body">
        <div class="artisan-top">
          <img class="avatar large" src="${echapperHTML(imageProfil(artisan.photo_profil))}" alt="${echapperHTML(nomComplet(artisan))}" onerror="this.src='${DEFAULT_AVATAR}'">
          <div>
            <h3>${echapperHTML(nomComplet(artisan))}</h3>
            <p class="muted">${echapperHTML(artisan.service_nom || "Service")} · ${echapperHTML(artisan.ville || "Commune non précisée")}</p>
            <div class="stars">${echapperHTML(afficherEtoiles(artisan.moyenne_notes))}</div>
          </div>
        </div>
        <div class="meta-row">
          <span class="badge primary">${Number(artisan.experience || 0)} an(s) d'expérience</span>
          <span class="badge accent">${echapperHTML(noteArtisan(artisan))}</span>
          <span class="badge">${Number(artisan.total_demandes || 0)} mission(s)</span>
        </div>
        <p class="muted">${echapperHTML(tronquer(artisan.description || "Artisan Taskly disponible pour vos demandes.", 150))}</p>
        <div class="request-actions">
          <a class="btn outline" href="/artisan-profile.html?id=${artisan.id}">Voir le profil</a>
          ${window.utilisateurCourant?.role === "client" ? `<button class="btn primary" type="button" data-open-request="${artisan.id}">Envoyer une demande</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

function obtenirLimiteAffichageArtisans() {
  return window.matchMedia("(max-width: 520px)").matches ? 3 : 6;
}

let artisansCharges = [];
let nombreArtisansAffiches = obtenirLimiteAffichageArtisans();

// Créer ou récupérer le bouton "Afficher plus"
function obtenirBoutonAfficherPlusArtisans() {
  const grille = document.getElementById("artisans-grid");
  if (!grille) return null;

  let bouton = document.getElementById("load-more-artisans");

  if (!bouton) {
    const conteneur = document.createElement("div");
    conteneur.className = "load-more-artisans-wrap";
    conteneur.hidden = true;

    conteneur.innerHTML = `
      <button class="btn load-more-artisans-btn" id="load-more-artisans" type="button">
        Afficher plus
      </button>
      <p class="artisans-results-count" id="artisans-results-count"></p>
    `;

    grille.insertAdjacentElement("afterend", conteneur);

    bouton = document.getElementById("load-more-artisans");

    bouton.addEventListener("click", () => {
      nombreArtisansAffiches += obtenirLimiteAffichageArtisans();
      afficherArtisansLimites();
    });
  }

  return bouton;
}

// Afficher seulement une partie des artisans chargés
function afficherArtisansLimites() {
  const grille = document.getElementById("artisans-grid");
  if (!grille) return;

  const artisansVisibles = artisansCharges.slice(0, nombreArtisansAffiches);
  grille.innerHTML = artisansVisibles.map(carteArtisan).join("");

  const bouton = obtenirBoutonAfficherPlusArtisans();
  if (!bouton) return;

  const conteneur = bouton.closest(".load-more-artisans-wrap");
  const compteur = document.getElementById("artisans-results-count");

  const total = artisansCharges.length;
  const affiches = Math.min(nombreArtisansAffiches, total);
  const reste = total - affiches;

  if (compteur) {
    compteur.innerHTML = `
      <span class="count-number">${affiches}</span>
      artisan${affiches > 1 ? "s" : ""} affiché${affiches > 1 ? "s" : ""}
      sur
      <span class="count-number">${total}</span>
      résultat${total > 1 ? "s" : ""}
    `;
  }

  conteneur.hidden = false;

  if (reste > 0) {
    bouton.hidden = false;
    bouton.textContent = "Afficher plus";
  } else {
    bouton.hidden = true;
  }
}

// Charger les services pour les filtres
async function chargerFiltresArtisans() {
  const serviceSelect = document.getElementById("filter-service");
  if (!serviceSelect) return;

  try {
    const { services } = await requeteAPI("/api/services");
    serviceSelect.innerHTML = `<option value="">Tous les services</option>` + services
      .map((service) => `<option value="${service.id}">${echapperHTML(service.nom)}</option>`)
      .join("");

    const serviceId = obtenirParametre("serviceId");
    if (serviceId) serviceSelect.value = serviceId;
  } catch (error) {
    afficherToast(error.message, "error");
  }
}

// Remplir les filtres de localisation
function initialiserLocalisationArtisans() {
  const wilaya = document.getElementById("filter-wilaya");
  if (typeof remplirWilayas === "function") {
    remplirWilayas(wilaya);
  }
}

// Construire les parametres de recherche artisans
function construireQueryArtisans() {
  const params = new URLSearchParams();
  const serviceId = document.getElementById("filter-service")?.value;
  const wilaya = document.getElementById("filter-wilaya")?.value;
  const recherche = document.getElementById("filter-search")?.value.trim();

  if (serviceId) params.set("serviceId", serviceId);
  if (wilaya) params.set("wilaya", wilaya);
  if (recherche) params.set("recherche", recherche);
  return params.toString();
}

// Charger les artisans selon les filtres
async function chargerArtisans() {
  const grille = document.getElementById("artisans-grid");
  if (!grille) return;

  grille.innerHTML = etatChargement("Chargement des artisans...");

  const bouton = obtenirBoutonAfficherPlusArtisans();
  if (bouton) {
    bouton.closest(".load-more-artisans-wrap").hidden = true;
  }

  const query = construireQueryArtisans();

  try {
    const { artisans } = await requeteAPI(`/api/artisans${query ? `?${query}` : ""}`);

    artisansCharges = artisans || [];
    nombreArtisansAffiches = obtenirLimiteAffichageArtisans();

    if (!artisansCharges.length) {
      grille.innerHTML = etatVideDeuxLignes(
        "Aucun artisan ne correspond à vos critères.",
        "Essayez de changer le service, la wilaya ou la recherche."
      );

      if (bouton) {
        bouton.closest(".load-more-artisans-wrap").hidden = true;
      }

      return;
    }

    afficherArtisansLimites();
  } catch (error) {
    grille.innerHTML = etatVide(error.message);

    if (bouton) {
      bouton.closest(".load-more-artisans-wrap").hidden = true;
    }
  }
}

// Initialiser les filtres de la page artisans
function initialiserFiltresArtisans() {
  const form = document.getElementById("artisans-filter-form");
  if (!form) return;

  const recherche = obtenirParametre("recherche");
  if (recherche) document.getElementById("filter-search").value = recherche;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    chargerArtisans();
  });

  document.getElementById("reset-filters")?.addEventListener("click", () => {
    form.reset();
    chargerArtisans();
  });
}

// Ouvrir la modale de demande
async function ouvrirDemandeArtisan(id) {
  if (!window.utilisateurCourant) {
    window.location.href = `/login.html?redirect=${encodeURIComponent(`/artisan-profile.html?id=${id}`)}`;
    return;
  }

  if (window.utilisateurCourant.role !== "client") {
    afficherToast("Seuls les clients peuvent envoyer une demande.", "error");
    return;
  }

  try {
    const { artisan } = await requeteAPI(`/api/artisans/${encodeURIComponent(id)}`);
    document.getElementById("request-artisan-name").textContent = nomComplet(artisan);
    document.getElementById("request-artisan-id").value = artisan.id;
    ouvrirModale("request-modal");
  } catch (error) {
    afficherToast(error.message, "error");
  }
}

// Envoyer la demande au backend
function initialiserDemandeArtisan() {
  document.addEventListener("click", (event) => {
    const bouton = event.target.closest("[data-open-request]");
    if (bouton) {
      ouvrirDemandeArtisan(bouton.dataset.openRequest);
    }
  });

  const form = document.getElementById("request-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    const payload = {
      artisanId: Number(document.getElementById("request-artisan-id").value),
      message: document.getElementById("request-message").value.trim(),
      adresse: document.getElementById("request-address").value.trim(),
      dateSouhaitee: document.getElementById("request-date").value || null
    };

    try {
      await requeteAPI("/api/demandes", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      afficherToast("Votre demande a été envoyée avec succès.");
      form.reset();
      fermerModale("request-modal");
    } catch (error) {
      afficherToast(error.message, "error");
    } finally {
      bouton.disabled = false;
    }
  });
}

// Charger le profil public d'un artisan
async function chargerProfilArtisan() {
  const cible = document.getElementById("artisan-profile");
  const avisCible = document.getElementById("artisan-reviews");
  if (!cible || !avisCible) return;

  const id = obtenirParametre("id");
  if (!id) {
    cible.innerHTML = etatVide("Artisan introuvable.");
    avisCible.innerHTML = "";
    return;
  }

  cible.innerHTML = etatChargement("Chargement du profil...");
  avisCible.innerHTML = etatChargement("Chargement des avis...");

  try {
    const [{ artisan }, avisData] = await Promise.all([
      requeteAPI(`/api/artisans/${encodeURIComponent(id)}`),
      requeteAPI(`/api/avis/artisan/${encodeURIComponent(id)}`).catch(() => ({ avis: [], statistiques: {} }))
    ]);

    const moyenne = avisData.statistiques?.moyenne_note || artisan.moyenne_notes || 0;
    const total = avisData.statistiques?.total_avis || artisan.total_avis || 0;

    cible.innerHTML = `
      <div class="profile-hero">
        <img class="avatar large" src="${echapperHTML(imageProfil(artisan.photo_profil))}" alt="${echapperHTML(nomComplet(artisan))}" onerror="this.src='${DEFAULT_AVATAR}'">
        <div>
          <p class="eyebrow">Profil artisan</p>
          <h1>${echapperHTML(nomComplet(artisan))}</h1>
          <p class="lead">${echapperHTML(artisan.service_nom)} à ${echapperHTML(artisan.ville)}</p>
          <div class="meta-row mt-16">
            <span class="badge primary">${Number(artisan.experience || 0)} an(s) d'expérience</span>
            <span class="badge accent">${Number(moyenne) ? formatNombre(moyenne) + " / 5" : "Nouveau"} · ${total} avis</span>
          </div>
        </div>
        ${window.utilisateurCourant?.role === "client" ? `<button class="btn primary" type="button" data-open-request="${artisan.id}">Envoyer une demande</button>` : `<a class="btn outline" href="/login.html">Se connecter pour demander</a>`}
      </div>
      <div class="panel mt-24">
        <div class="panel-header">
          <h2>À propos de l'artisan</h2>
        </div>
        <div class="panel-body">
          <p>${echapperHTML(artisan.description || "Cet artisan n'a pas encore ajouté de description détaillée.")}</p>
          <div class="meta-row mt-18">
            <span class="badge">Téléphone : ${echapperHTML(artisan.telephone || "Non précisé")}</span>
            <span class="badge">Email : ${echapperHTML(artisan.email || "Non précisé")}</span>
          </div>
        </div>
      </div>
    `;

    if (!avisData.avis?.length) {
      avisCible.innerHTML = etatVide("Aucun avis pour le moment.");
      return;
    }

    avisCible.innerHTML = avisData.avis.map((avis) => {
      const nomClient = nomComplet(avis, "client_");
      const initiale = nomClient.trim().charAt(0).toUpperCase() || "C";

      return `
        <article class="profile-testimonial-card">
          <div class="profile-testimonial-header">
            <div class="profile-testimonial-avatar">${echapperHTML(initiale)}</div>
            <div>
              <h3>${echapperHTML(nomClient)}</h3>
              <p>Client Taskly</p>
            </div>
          </div>

          <div class="profile-testimonial-stars">${afficherEtoiles(avis.note)}</div>

          <p class="profile-testimonial-text">
            “${echapperHTML(avis.commentaire || "Avis sans commentaire.")}”
          </p>

          <div class="profile-testimonial-footer">
            <span class="profile-testimonial-tag">${echapperHTML(artisan.service_nom || "Service")}</span>
            <span class="profile-testimonial-date">${formatDate(avis.created_at)}</span>
          </div>
        </article>
      `;
    }).join("");
  } catch (error) {
    cible.innerHTML = etatVide(error.message);
    avisCible.innerHTML = "";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await attendreSession();
  initialiserLocalisationArtisans();
  await chargerFiltresArtisans();
  initialiserFiltresArtisans();
  initialiserDemandeArtisan();
  chargerArtisans();
  chargerProfilArtisan();
});
