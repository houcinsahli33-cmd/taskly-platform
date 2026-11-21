
// Pictogrammes SVG de presentation, independants des donnees/API.
function pictogrammeServicePremium(nom) {
  const name = String(nom || "").toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  if (/carrelage|revetement|faience|sols/.test(name)) return svg('<path d="m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>');
  if (/climatis|froid|refriger/.test(name)) return svg('<path d="M12 2v20M4 6l16 12M20 6 4 18M9 5l3 3 3-3M9 19l3-3 3 3M3 9l4 1-1 4M21 9l-4 1 1 4"/>');
  if (/demenag|transport|livraison/.test(name)) return svg('<path d="M2 6h12v12H2zM14 10h4l4 4v4h-8z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>');
  if (/plomb|sanitaire|canalis/.test(name)) return svg('<path d="m15 6 3 3-9 9-3-3zM14 5l5-3 3 3-3 5M5 14l-3 5 3 3 5-3"/>');
  if (/electri/.test(name)) return svg('<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>');
  return svg('<path d="M14 6a5 5 0 0 0-6 6L3 17a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4z"/>');
}

function pictogrammeStatPremium(type) {
  const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  switch (type) {
    case "artisans": return svg('<circle cx="9" cy="8" r="3"/><path d="M2 20v-2a6 6 0 0 1 12 0v2M17 6a3 3 0 0 1 0 6M16 14a5 5 0 0 1 6 5v1"/>');
    case "demandes": return svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 2v6M16 2v6M3 10h18M9 15l2 2 4-4"/>');
    case "notes": return svg('<path d="m12 2 3.1 6.4 7.1 1-5.1 4.9 1.2 7-6.3-3.3-6.3 3.3 1.2-7-5.1-4.9 7.1-1z"/>');
    case "avis": return svg('<path d="M21 11a8 8 0 0 1-8 8H4l2-5a8 8 0 1 1 15-3z"/>');
    default: return "";
  }
}

let servicesCatalogue = [];
let filtreServices = "tous";

// Construire les statistiques d'un service
function statsService(service, premium = false) {
  const moyenne = Number(service.moyenne_notes || 0);
  if (premium) {
    return `
      <div class="service-stats taskly-svc-stats">
        <span class="badge primary">${pictogrammeStatPremium("artisans")} ${Number(service.total_artisans || 0)} artisan(s)</span>
        <span class="badge">${pictogrammeStatPremium("demandes")} ${Number(service.total_demandes || 0)} demande(s)</span>
        <span class="badge accent">${pictogrammeStatPremium("notes")} ${moyenne ? formatNombre(moyenne) + "/5" : "Nouveau"}</span>
        <span class="badge">${pictogrammeStatPremium("avis")} ${Number(service.total_avis || 0)} avis</span>
      </div>
    `;
  }
  return `
    <div class="service-stats">
      <span class="badge primary">${Number(service.total_artisans || 0)} artisan(s)</span>
      <span class="badge">${Number(service.total_demandes || 0)} demande(s)</span>
      <span class="badge accent">${moyenne ? formatNombre(moyenne) + "/5" : "Nouveau"}</span>
      <span class="badge">${Number(service.total_avis || 0)} avis</span>
    </div>
  `;
}

// Construire une carte de service
function carteService(service) {
  return `
    <article class="card service-card taskly-svc-card">
      <div class="taskly-svc-image-wrap"><img class="service-image" loading="lazy" decoding="async" src="${echapperHTML(imageService(service))}" alt="${echapperHTML(service.nom)}" data-service-image="${echapperHTML(service.nom)}"></div>
      <div class="card-body">
        <div class="taskly-svc-summary">
          <span class="taskly-svc-symbol">${pictogrammeServicePremium(service.nom)}</span>
          <div class="taskly-svc-copy">
            <h3>${echapperHTML(service.nom)}</h3>
            <p class="muted">${echapperHTML(service.description || "Service proposé par les artisans Taskly.")}</p>
          </div>
        </div>
        ${statsService(service, true)}
        <a class="btn primary taskly-svc-link" href="/service.html?id=${encodeURIComponent(service.id)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-3.5-9.5L2 9zM22 2 11.5 12.5"/></svg><span>Consulter le service</span><span aria-hidden="true">→</span></a>
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
    services = services.sort((a, b) => {
      const demandesA = Number(a.total_demandes || 0);
      const demandesB = Number(b.total_demandes || 0);

      const artisansA = Number(a.total_artisans || 0);
      const artisansB = Number(b.total_artisans || 0);

      return demandesB - demandesA || artisansB - artisansA;
    });
  }

  if (filtreServices === "notes") {
    services = services.sort((a, b) => {
      const noteA = Number(a.moyenne_notes || 0);
      const noteB = Number(b.moyenne_notes || 0);

      const avisA = Number(a.total_avis || 0);
      const avisB = Number(b.total_avis || 0);

      return noteB - noteA || avisB - avisA;
    });
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

// Appliquer la recherche venue de l'accueil
function appliquerRechercheDepuisURL() {
  const champRecherche = document.getElementById("service-search");
  if (!champRecherche) return;

  const rechercheURL = obtenirParametre("search");
  if (!rechercheURL) return;

  champRecherche.value = rechercheURL;
}

// Rediriger vers le service exact quand la recherche correspond
function redirigerVersServiceDepuisURL() {
  const rechercheURL = obtenirParametre("search");
  if (!rechercheURL) return false;

  const recherche = normaliserTexte(rechercheURL);

  const serviceTrouve = servicesCatalogue.find((service) => {
    return normaliserTexte(service.nom) === recherche;
  });

  if (!serviceTrouve) return false;

  window.location.href = `/service.html?id=${encodeURIComponent(serviceTrouve.id)}`;
  return true;
}

// Charger les services du catalogue
async function chargerPageServices() {
  const grille = document.getElementById("services-grid");
  if (!grille) return;
  grille.innerHTML = etatChargement("Chargement des services...");

  try {
    const { services } = await requeteAPI("/api/services");
    servicesCatalogue = services;

    if (redirigerVersServiceDepuisURL()) return;

    afficherServicesCatalogue();
  } catch (error) {
    grille.innerHTML = etatVide(error.message);
  }
}

// Initialiser les filtres des services
function initialiserFiltresServices() {
  document.getElementById("service-search")?.addEventListener("input", afficherServicesCatalogue);
  document.getElementById("services-search-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    afficherServicesCatalogue();
  });

  document.querySelectorAll("[data-service-filter]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const dejaActif = bouton.classList.contains("active");

      filtreServices = dejaActif ? "tous" : bouton.dataset.serviceFilter;

      document.querySelectorAll("[data-service-filter]").forEach((item) => {
        const estActif = !dejaActif && item === bouton;

        item.classList.toggle("active", estActif);
        item.classList.toggle("primary", estActif);
        item.classList.toggle("outline", !estActif);
        item.setAttribute("aria-pressed", String(estActif));
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
          <div class="request-actions mt-22">
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
        "Essayez de changer le service, la wilaya ou la recherche."
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
  appliquerRechercheDepuisURL();
  initialiserFiltresServices();
  chargerPageServices();
  chargerDetailService();
});
