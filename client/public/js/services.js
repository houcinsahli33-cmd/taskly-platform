let servicesCatalogue = [];
let filtreServices = "tous";

async function remplirSelectServices(selecteur) {
  const elements = document.querySelectorAll(selecteur);
  if (!elements.length) return [];

  const { services } = await requeteAPI("/api/services");
  elements.forEach((select) => {
    const placeholder = select.dataset.placeholder || "Tous les services";
    select.innerHTML = `<option value="">${echapperHTML(placeholder)}</option>` + services
      .map((service) => `<option value="${service.id}">${echapperHTML(service.nom)}</option>`)
      .join("");
  });
  return services;
}

// Construire les statistiques d'un service
function statsService(service) {
  const moyenne = Number(service.moyenne_notes || 0);
  return `
    <div class="service-stats">
      <span class="badge primary">${Number(service.total_artisans || 0)} artisan(s)</span>
      <span class="badge">${Number(service.total_demandes || 0)} demande(s)</span>
      <span class="badge accent">${moyenne ? formatNombre(moyenne) + "/5" : "Nouveau"}</span>
      <span class="badge">${Number(service.total_avis || 0)} avis</span>
    </div>
  `;
}

function carteService(service) {
  return `
    <article class="card service-card">
      <img class="service-image" src="${echapperHTML(imageService(service))}" alt="${echapperHTML(service.nom)}" data-service-image="${echapperHTML(service.nom)}">
      <div class="card-body">
        <div>
          <h3>${echapperHTML(service.nom)}</h3>
          <p class="muted">${echapperHTML(service.description || "Service proposé par les artisans Taskly.")}</p>
          ${statsService(service)}
        </div>
        <a class="btn outline" href="/service.html?id=${service.id}">Consulter le service</a>
      </div>
    </article>
  `;
}

// Afficher les services dans la page
function afficherServicesCatalogue() {
  const grille = document.getElementById("services-grid");
  if (!grille) return;

  const recherche = normaliserTexte(document.getElementById("service-search")?.value || "");
  let services = servicesCatalogue.filter((service) => normaliserTexte(service.nom).includes(recherche));

  if (filtreServices === "populaires") {
    services = services.filter((service) => Number(service.total_demandes || 0) > 0 || Number(service.total_artisans || 0) > 0);
  }

  if (filtreServices === "notes") {
    services = services.filter((service) => Number(service.moyenne_notes || 0) >= 4);
  }

  if (!services.length) {
    grille.innerHTML = etatVide("Aucun service ne correspond à votre recherche.");
    return;
  }

  grille.innerHTML = services.map(carteService).join("");
  grille.querySelectorAll("[data-service-image]").forEach((img) => {
    gererImageService(img, img.dataset.serviceImage);
  });
}

// Charger les services du catalogue
async function chargerPageServices() {
  const grille = document.getElementById("services-grid");
  if (!grille) return;
  grille.innerHTML = etatChargement("Chargement des services...");

  try {
    const { services } = await requeteAPI("/api/services");
    servicesCatalogue = services;
    afficherServicesCatalogue();
  } catch (error) {
    grille.innerHTML = etatVide(error.message);
  }
}

// Initialiser les filtres des services
function initialiserFiltresServices() {
  document.getElementById("service-search")?.addEventListener("input", afficherServicesCatalogue);

  document.querySelectorAll("[data-service-filter]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      filtreServices = bouton.dataset.serviceFilter;
      document.querySelectorAll("[data-service-filter]").forEach((item) => {
        item.classList.toggle("active", item === bouton);
      });
      afficherServicesCatalogue();
    });
  });
}

// Charger le detail d'un service
async function chargerDetailService() {
  const cible = document.getElementById("service-detail");
  const artisansCible = document.getElementById("service-artisans");
  if (!cible || !artisansCible) return;

  const id = obtenirParametre("id");
  if (!id) {
    cible.innerHTML = etatVide("Service introuvable.");
    artisansCible.innerHTML = "";
    return;
  }

  cible.innerHTML = etatChargement("Chargement du service...");
  artisansCible.innerHTML = etatChargement("Chargement des artisans...");

  try {
    const [{ service }, { artisans }] = await Promise.all([
      requeteAPI(`/api/services/${encodeURIComponent(id)}`),
      requeteAPI(`/api/artisans?serviceId=${encodeURIComponent(id)}`)
    ]);

    cible.innerHTML = `
      <div class="service-detail-hero">
        <img src="${echapperHTML(imageService(service))}" alt="${echapperHTML(service.nom)}" data-service-image="${echapperHTML(service.nom)}">
        <div>
          <p class="eyebrow">Service Taskly</p>
          <h1>${echapperHTML(service.nom)}</h1>
          <p class="lead">${echapperHTML(service.description || "Trouvez un artisan qualifié pour ce service.")}</p>
          ${statsService(service)}
          <div class="request-actions" style="margin-top:22px">
            <a class="btn primary" href="/artisans.html?serviceId=${service.id}">Comparer les artisans</a>
            <a class="btn outline" href="/services.html">Tous les services</a>
          </div>
        </div>
      </div>
    `;
    cible.querySelectorAll("[data-service-image]").forEach((img) => gererImageService(img, service.nom));

    if (!artisans.length) {
      artisansCible.innerHTML = etatVideDeuxLignes(
        "Aucun artisan ne correspond à vos critères.",
        "Essayez de changer le service, la wilaya ou la commune."
      );
      return;
    }

    artisansCible.innerHTML = artisans.map(carteArtisan).join("");
  } catch (error) {
    cible.innerHTML = etatVide(error.message);
    artisansCible.innerHTML = "";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await attendreSession();
  initialiserFiltresServices();
  chargerPageServices();
  chargerDetailService();
});
