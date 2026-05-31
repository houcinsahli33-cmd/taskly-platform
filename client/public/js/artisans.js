let tousLesServicesArtisans = [];
let artisanSelectionne = null;

function carteArtisan(artisan) {
  return `
    <article class="card artisan-card">
      <div class="card-body">
        <div class="artisan-top">
          <img class="avatar" src="${echapperHTML(imageProfil(artisan.photo_profil))}" alt="${echapperHTML(nomComplet(artisan))}">
          <div>
            <h3>${echapperHTML(nomComplet(artisan))}</h3>
            <p class="muted">${echapperHTML(artisan.service_nom || "Service")} à ${echapperHTML(artisan.ville || "Ville non précisée")}</p>
          </div>
        </div>
        <div class="meta-row">
          <span class="badge primary">${Number(artisan.experience || 0)} an(s) d'expérience</span>
          <span class="badge">Profil vérifié</span>
        </div>
        <p class="muted">${echapperHTML(tronquer(artisan.description || "Artisan Taskly disponible pour vos demandes.", 130))}</p>
        <div class="request-actions">
          <a class="btn outline" href="/artisan-profile.html?id=${artisan.id}">Voir le profil</a>
          ${window.utilisateurCourant?.role === "client" ? `<button class="btn primary" type="button" data-open-request="${artisan.id}">Envoyer une demande</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

async function chargerFiltresArtisans() {
  const serviceSelect = document.getElementById("filter-service");
  if (!serviceSelect) return;

  try {
    const { services } = await requeteAPI("/api/services");
    tousLesServicesArtisans = services;
    serviceSelect.innerHTML = `<option value="">Tous les services</option>` + services
      .map((service) => `<option value="${service.id}">${echapperHTML(service.nom)}</option>`)
      .join("");

    const serviceId = obtenirParametre("serviceId");
    if (serviceId) serviceSelect.value = serviceId;
  } catch (error) {
    afficherToast(error.message, "error");
  }
}

function construireQueryArtisans() {
  const params = new URLSearchParams();
  const serviceId = document.getElementById("filter-service")?.value;
  const ville = document.getElementById("filter-city")?.value.trim();
  const recherche = document.getElementById("filter-search")?.value.trim();

  if (serviceId) params.set("serviceId", serviceId);
  if (ville) params.set("ville", ville);
  if (recherche) params.set("recherche", recherche);
  return params.toString();
}

async function chargerArtisans() {
  const grille = document.getElementById("artisans-grid");
  if (!grille) return;
  grille.innerHTML = etatChargement("Chargement des artisans...");

  const query = construireQueryArtisans();
  try {
    const { artisans } = await requeteAPI(`/api/artisans${query ? `?${query}` : ""}`);

    if (!artisans.length) {
      grille.innerHTML = etatVide("Aucun artisan ne correspond à votre recherche.");
      return;
    }

    grille.innerHTML = artisans.map(carteArtisan).join("");
  } catch (error) {
    grille.innerHTML = etatVide(error.message);
  }
}

function initialiserFiltresArtisans() {
  const form = document.getElementById("artisans-filter-form");
  if (!form) return;

  const ville = obtenirParametre("ville");
  const recherche = obtenirParametre("recherche");
  if (ville) document.getElementById("filter-city").value = ville;
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
    artisanSelectionne = artisan;
    document.getElementById("request-artisan-name").textContent = nomComplet(artisan);
    document.getElementById("request-artisan-id").value = artisan.id;
    ouvrirModale("request-modal");
  } catch (error) {
    afficherToast(error.message, "error");
  }
}

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

    const moyenne = avisData.statistiques?.moyenne_note || "Nouveau";
    const total = avisData.statistiques?.total_avis || 0;

    cible.innerHTML = `
      <div class="profile-hero">
        <img class="avatar large" src="${echapperHTML(imageProfil(artisan.photo_profil))}" alt="${echapperHTML(nomComplet(artisan))}">
        <div>
          <p class="eyebrow">Profil artisan</p>
          <h1>${echapperHTML(nomComplet(artisan))}</h1>
          <p class="lead">${echapperHTML(artisan.service_nom)} à ${echapperHTML(artisan.ville)}</p>
          <div class="meta-row" style="margin-top:16px">
            <span class="badge primary">${Number(artisan.experience || 0)} an(s) d'expérience</span>
            <span class="badge accent">${echapperHTML(String(moyenne))}${total ? " / 5" : ""} · ${total} avis</span>
          </div>
        </div>
        ${window.utilisateurCourant?.role === "client" ? `<button class="btn primary" type="button" data-open-request="${artisan.id}">Envoyer une demande</button>` : `<a class="btn outline" href="/login.html">Se connecter pour demander</a>`}
      </div>
      <div class="panel" style="margin-top:24px">
        <div class="panel-header">
          <h2>À propos de l'artisan</h2>
        </div>
        <div class="panel-body">
          <p>${echapperHTML(artisan.description || "Cet artisan n'a pas encore ajouté de description détaillée.")}</p>
          <div class="meta-row" style="margin-top:18px">
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

    avisCible.innerHTML = avisData.avis.map((avis) => `
      <article class="card review-card">
        <div class="stars">${"★".repeat(Number(avis.note || 0))}${"☆".repeat(5 - Number(avis.note || 0))}</div>
        <h3>${echapperHTML(nomComplet(avis, "client_"))}</h3>
        <p class="muted">${echapperHTML(avis.commentaire || "Avis sans commentaire.")}</p>
        <p class="text-small muted">${formatDate(avis.created_at)}</p>
      </article>
    `).join("");
  } catch (error) {
    cible.innerHTML = etatVide(error.message);
    avisCible.innerHTML = "";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await attendreSession();
  await chargerFiltresArtisans();
  initialiserFiltresArtisans();
  initialiserDemandeArtisan();
  chargerArtisans();
  chargerProfilArtisan();
});
