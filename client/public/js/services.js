
// Pictogrammes SVG de presentation, independants des donnees/API.
function pictogrammeServicePremium(nom) {
  const name = String(nom || "").toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const svg = (body, icon = "") => `<svg${icon ? ` data-taskly-service-icon="${icon}"` : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  if (/carrelage|revetement|faience|sols/.test(name)) return svg('<path d="m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>');
  if (/climatis|froid|refriger/.test(name)) return svg('<path d="M12 2.3v19.4M3.6 7.15l16.8 9.7M20.4 7.15l-16.8 9.7"/><path d="m9.3 4.75 2.7 2.7 2.7-2.7m-5.4 14.5 2.7-2.7 2.7 2.7M4.7 10.4l3.7-.95-.9-3.7M19.3 13.6l-3.7.95.9 3.7M7.5 18.25l.9-3.7-3.7-.95M16.5 5.75l-.9 3.7 3.7.95"/><circle cx="12" cy="12" r="1.65"/>', "climatisation");
  if (/demenag|transport|livraison/.test(name)) return svg('<path d="M2.4 6.4h11.1v10H2.4zM13.5 9.2h4.2l3.8 4.25v2.95h-2.3M13.5 16.4h-3.4M4.8 16.4H2.4"/><path d="M5.1 6.4v3.2h5.7V6.4M16 10.8h1.15l2.1 2.5H16z"/><path d="M5.8 12.15h4"/><circle cx="7.45" cy="17.1" r="1.85"/><circle cx="17.25" cy="17.1" r="1.85"/>', "demenagement");
  if (/plomb|sanitaire|canalis/.test(name)) return svg('<path d="M14 3a6 6 0 0 0-6.6 7.2L3 14.6a3.4 3.4 0 0 0 4.8 4.8l4.4-4.4A6 6 0 0 0 21 8.4l-4.2 3.1-4.4-4.4L15.5 3"/><circle cx="5.7" cy="16.9" r=".65" fill="currentColor" stroke="none"/>');
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
let triServices = "pertinence";
let versionFiltrageServices = 0;
// Ne jamais recalculer une vérification de wilaya déjà effectuée.
const cacheServicesParWilaya = new Map();

// Les catégories sont basées sur les données du catalogue. Lorsque l'API ne
// fournit pas de catégorie, un groupe d'affichage est déduit du nom du service.
function categoriePourService(service) {
  const brute = service.categorie_nom || service.category_name || service.categorie?.nom || service.categorie || service.category;
  if (typeof brute === "string" && brute.trim() && !/^\d+$/.test(brute.trim())) return brute.trim();
  const nom = normaliserTexte(service.nom || "");
  if (/demenag|transport|livraison|logistique/.test(nom)) return "Transport et déménagement";
  if (/climatis|plomb|electri|electromenager|chauff|sanitaire|installation|depannage/.test(nom)) return "Installation et dépannage";
  if (/jardin|paysag|espaces? verts|elaga/.test(nom)) return "Jardin et extérieur";
  if (/menage|nettoy|entretien|desinfect/.test(nom)) return "Entretien et nettoyage";
  if (/carrel|macon|menuis|peint|renov|platre|isolation|travaux|construction/.test(nom)) return "Travaux et rénovation";
  return "Autres services";
}

function initialiserCategoriesServices(services) {
  const select = document.getElementById("services-category");
  if (!select) return;
  const value = select.value;
  const categories = [...new Set(services.map(categoriePourService))].sort((a,b) => a.localeCompare(b, "fr"));
  select.replaceChildren(new Option("Toutes les catégories", ""), ...categories.map(c => new Option(c,c)));
  if (categories.includes(value)) select.value = value;
}

function initialiserLocalitesServices() {
  const select = document.getElementById("services-wilaya");
  if (!select || typeof wilayasAlgerie === "undefined") return;
  // Mêmes wilayas que dans l'annuaire Artisans ; aucune liste inventée.
  const names = [...new Set(wilayasAlgerie.map(w => w.nom))].sort((a,b) => a.localeCompare(b,"fr"));
  select.replaceChildren(new Option("Toutes les localités", ""), ...names.map(name => new Option(name,name)));
}

async function serviceEstDisponibleDansWilaya(service, wilaya) {
  const key = `${wilaya}::${service.id}`;
  if (!cacheServicesParWilaya.has(key)) {
    const params = new URLSearchParams({serviceId:String(service.id), wilaya, page:"1", limit:"1"});
    const requete = requeteAPI(`/api/artisans?${params}`, {cache:"no-store"})
      .then(resultat => {
        const total = Number(resultat.total);
        if (resultat.total !== undefined && Number.isFinite(total)) return total > 0;
        if (Array.isArray(resultat.artisans) && resultat.artisans.length) return true;
        // Sans total fiable, ne pas déclarer le service indisponible.
        return null;
      })
      .catch(() => null);
    cacheServicesParWilaya.set(key, requete);
  }
  return cacheServicesParWilaya.get(key);
}

function trierCatalogueServices(services) {
  const tri = triServices !== "pertinence" ? triServices : filtreServices === "populaires" ? "demandes" : filtreServices === "notes" ? "notes" : "pertinence";
  const resultat = [...services];
  if (tri === "demandes") resultat.sort((a,b) => Number(b.total_demandes||0)-Number(a.total_demandes||0) || Number(b.total_artisans||0)-Number(a.total_artisans||0));
  else if (tri === "notes") resultat.sort((a,b) => Number(b.moyenne_notes||0)-Number(a.moyenne_notes||0) || Number(b.total_avis||0)-Number(a.total_avis||0));
  else if (tri === "artisans") resultat.sort((a,b) => Number(b.total_artisans||0)-Number(a.total_artisans||0));
  else if (tri === "nom") resultat.sort((a,b) => String(a.nom||"").localeCompare(String(b.nom||""),"fr"));
  return resultat;
}


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
async function afficherServicesCatalogue() {
  const grille = document.getElementById("services-grid");
  if (!grille) return;
  const version = ++versionFiltrageServices;
  const recherche = normaliserTexte(document.getElementById("service-search")?.value || "");
  const categorie = document.getElementById("services-category")?.value || "";
  const wilaya = document.getElementById("services-wilaya")?.value || "";
  const info = document.getElementById("services-filter-info");
  let services = servicesCatalogue.filter(service => {
    const texte = normaliserTexte(`${service.nom || ""} ${service.description || ""}`);
    return texte.includes(recherche) && (!categorie || categoriePourService(service) === categorie);
  });

  let verificationsInconnues = 0;
  if (wilaya && services.length) {
    grille.setAttribute("aria-busy", "true");
    grille.innerHTML = etatChargement("Recherche des artisans disponibles dans cette wilaya...");
    if (info) info.textContent = `Recherche des services disponibles à ${wilaya}…`;
    const candidats = [];
    // Quatre requêtes simultanées au maximum ; le résultat reste lié à une
    // wilaya et un service, et les recherches obsolètes sont ignorées.
    for (let i = 0; i < services.length; i += 4) {
      const bloc = services.slice(i, i + 4);
      const etats = await Promise.all(bloc.map(service => serviceEstDisponibleDansWilaya(service, wilaya)));
      if (version !== versionFiltrageServices) return;
      bloc.forEach((service, index) => {
        if (etats[index] !== false) candidats.push(service);
        if (etats[index] === null) verificationsInconnues++;
      });
    }
    services = candidats;
  }
  if (version !== versionFiltrageServices) return;
  services = trierCatalogueServices(services);
  grille.setAttribute("aria-busy", "false");
  if (info) {
    info.textContent = `${services.length} service${services.length > 1 ? "s" : ""} trouvé${services.length > 1 ? "s" : ""}${wilaya ? ` · ${wilaya}` : ""}${verificationsInconnues ? " · disponibilité de certains services non vérifiable" : ""}`;
  }
  if (!services.length) {
    grille.innerHTML = etatVide("Aucun service ne correspond à ces critères.");
    return;
  }
  grille.innerHTML = services.map(carteService).join("");
  grille.querySelectorAll("[data-service-image]").forEach(img => gererImageService(img, img.dataset.serviceImage));
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
    servicesCatalogue = Array.isArray(services) ? services : [];
    initialiserCategoriesServices(servicesCatalogue);

    if (redirigerVersServiceDepuisURL()) return;

    afficherServicesCatalogue();
  } catch (error) {
    grille.innerHTML = etatVide(error.message);
  }
}

// Initialiser les filtres des services
function initialiserFiltresServices() {
  document.getElementById("service-search")?.addEventListener("input", afficherServicesCatalogue);
  document.getElementById("services-search-form")?.addEventListener("submit", event => {
    event.preventDefault();
    afficherServicesCatalogue();
  });
  document.getElementById("services-wilaya")?.addEventListener("change", afficherServicesCatalogue);
  document.getElementById("services-category")?.addEventListener("change", afficherServicesCatalogue);
  document.getElementById("services-sort")?.addEventListener("change", event => {
    triServices = event.target.value;
    filtreServices = "tous";
    document.querySelectorAll("[data-service-filter]").forEach(item => {
      item.classList.remove("active", "primary");
      item.classList.add("outline");
      item.setAttribute("aria-pressed", "false");
    });
    afficherServicesCatalogue();
  });
  document.querySelectorAll("[data-service-filter]").forEach(bouton => {
    bouton.addEventListener("click", () => {
      const dejaActif = bouton.classList.contains("active");
      filtreServices = dejaActif ? "tous" : bouton.dataset.serviceFilter;
      triServices = "pertinence";
      const selectTri = document.getElementById("services-sort");
      if (selectTri) selectTri.value = "pertinence";
      document.querySelectorAll("[data-service-filter]").forEach(item => {
        const actif = !dejaActif && item === bouton;
        item.classList.toggle("active", actif);
        item.classList.toggle("primary", actif);
        item.classList.toggle("outline", !actif);
        item.setAttribute("aria-pressed", String(actif));
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
  initialiserLocalitesServices();
  initialiserFiltresServices();
  chargerPageServices();
  chargerDetailService();
});
