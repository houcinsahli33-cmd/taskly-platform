let servicesCatalogue = [];
let filtreServices = "tous";

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

// Construire une carte de service
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
