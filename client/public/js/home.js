
// Pictogrammes SVG de presentation, independants des donnees/API.
function pictogrammeServiceAccueil(nom) {
  const name = String(nom || "").toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  if (/carrelage|revetement|faience|sols/.test(name)) return svg('<path d="m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>');
  if (/climatis|froid|refriger/.test(name)) return svg('<path d="M12 2v20M4 6l16 12M20 6 4 18M9 5l3 3 3-3M9 19l3-3 3 3M3 9l4 1-1 4M21 9l-4 1 1 4"/>');
  if (/demenag|transport|livraison/.test(name)) return svg('<path d="M2 6h12v12H2zM14 10h4l4 4v4h-8z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>');
  if (/plomb|sanitaire|canalis/.test(name)) return svg('<path d="m15 6 3 3-9 9-3-3zM14 5l5-3 3 3-3 5M5 14l-3 5 3 3 5-3"/>');
  if (/electri/.test(name)) return svg('<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>');
  return svg('<path d="M14 6a5 5 0 0 0-6 6L3 17a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4z"/>');
}

function pictogrammeStatAccueil(type) {
  const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  switch (type) {
    case "artisans": return svg('<circle cx="9" cy="8" r="3"/><path d="M2 20v-2a6 6 0 0 1 12 0v2M17 6a3 3 0 0 1 0 6M16 14a5 5 0 0 1 6 5v1"/>');
    case "demandes": return svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 2v6M16 2v6M3 10h18M9 15l2 2 4-4"/>');
    case "notes": return svg('<path d="m12 2 3.1 6.4 7.1 1-5.1 4.9 1.2 7-6.3-3.3-6.3 3.3 1.2-7-5.1-4.9 7.1-1z"/>');
    case "avis": return svg('<path d="M21 11a8 8 0 0 1-8 8H4l2-5a8 8 0 1 1 15-3z"/>');
    default: return "";
  }
}

let servicesAccueil = [];
let serviceChoisiAccueil = null;

// Placer la liste de suggestions sous la recherche
function placerSuggestionsAccueil() {
  const form = document.getElementById("home-search-form");
  const suggestions = document.getElementById("home-suggestions");

  if (!form || !suggestions || !suggestions.classList.contains("show")) {
    return;
  }

  const position = form.getBoundingClientRect();

  suggestions.style.left = position.left + "px";
  suggestions.style.top = position.bottom + 8 + "px";
  suggestions.style.width = position.width + "px";
}

// Charger les services depuis le backend
async function chargerServicesAccueil() {
  const piste = document.getElementById("services-carousel");
  const miniServices = document.getElementById("home-mini-services");
  if (!piste) return;

  piste.innerHTML = etatChargement("Chargement des services...");

  try {
    const { services } = await requeteAPI("/api/services");
    servicesAccueil = services;

    if (!services.length) {
      piste.innerHTML = etatVide("Aucun service disponible pour le moment.");
      return;
    }

    piste.innerHTML = services.map((service) => `
      <article class="card service-card taskly-svc-card">
        <div class="taskly-svc-image-wrap"><img class="service-image" loading="lazy" decoding="async" src="${echapperHTML(imageService(service))}" alt="${echapperHTML(service.nom)}" data-service-image="${echapperHTML(service.nom)}"></div>
        <div class="card-body">
          <div class="taskly-svc-summary"><span class="taskly-svc-symbol">${pictogrammeServiceAccueil(service.nom)}</span><div class="taskly-svc-copy"><h3>${echapperHTML(service.nom)}</h3><p class="muted">${echapperHTML(tronquer(service.description || "Service proposé par les artisans Taskly.", 105))}</p></div></div>
          <div class="service-stats taskly-svc-stats">
            <span class="badge primary">${pictogrammeStatAccueil("artisans")}${Number(service.total_artisans || 0)} artisan(s)</span>
            <span class="badge">${pictogrammeStatAccueil("demandes")}${Number(service.total_demandes || 0)} demande(s)</span>
            <span class="badge accent">${pictogrammeStatAccueil("notes")}${Number(service.moyenne_notes || 0) ? formatNombre(Number(service.moyenne_notes)) + "/5" : "Nouveau"}</span>
            <span class="badge">${pictogrammeStatAccueil("avis")}${Number(service.total_avis || 0)} avis</span>
          </div>
          <a class="btn primary taskly-svc-link" href="/service.html?id=${encodeURIComponent(service.id)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-3.5-9.5L2 9zM22 2 11.5 12.5"/></svg><span>Consulter le service</span><span aria-hidden="true">→</span></a>
        </div>
      </article>
    `).join("");

    if (miniServices) {
      miniServices.innerHTML = services.slice(0, 5).map((service) => (
        `<a href="/service.html?id=${service.id}">${echapperHTML(service.nom)}</a>`
      )).join("");
    }

    piste.querySelectorAll("[data-service-image]").forEach((img) => {
      gererImageService(img, img.dataset.serviceImage);
    });
  } catch (error) {
    piste.innerHTML = etatVide(error.message);
  }
}

// Afficher les suggestions dans la barre de recherche
function afficherSuggestionsAccueil(texte) {
  const cible = document.getElementById("home-suggestions");
  if (!cible) return;

  const recherche = normaliserTexte(texte);
  if (!recherche) {
    cible.classList.remove("show");
    cible.innerHTML = "";
    serviceChoisiAccueil = null;
    return;
  }

  const resultats = servicesAccueil
    .filter((service) => normaliserTexte(service.nom).includes(recherche))
    .slice(0, 6);

  if (!resultats.length) {
    cible.classList.remove("show");
    cible.innerHTML = "";
    return;
  }

  cible.innerHTML = resultats.map((service) => (
    `<button type="button" data-suggestion-service="${service.id}">${echapperHTML(service.nom)}</button>`
  )).join("");

  cible.classList.add("show");
  placerSuggestionsAccueil();
}

// Initialiser la recherche de la page d'accueil
function initialiserRechercheAccueil() {
  const form = document.getElementById("home-search-form");
  const input = document.getElementById("home-search-input");
  const suggestions = document.getElementById("home-suggestions");
  if (!form || !input) return;

  input.addEventListener("input", () => {
    serviceChoisiAccueil = null;
    afficherSuggestionsAccueil(input.value);
  });

  suggestions?.addEventListener("click", (event) => {
    const bouton = event.target.closest("[data-suggestion-service]");
    if (!bouton) return;

    serviceChoisiAccueil = servicesAccueil.find((service) => String(service.id) === String(bouton.dataset.suggestionService));
    if (!serviceChoisiAccueil) return;
    input.value = serviceChoisiAccueil.nom;
    suggestions.classList.remove("show");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const recherche = input.value.trim();
    const service = (serviceChoisiAccueil && normaliserTexte(serviceChoisiAccueil.nom) === normaliserTexte(recherche) ? serviceChoisiAccueil : null) || servicesAccueil.find((item) => normaliserTexte(item.nom) === normaliserTexte(recherche));

    if (service) {
      window.location.href = `/service.html?id=${service.id}`;
      return;
    }

    const params = new URLSearchParams();
    if (recherche) params.set("recherche", recherche);
    window.location.href = `/artisans.html${params.toString() ? `?${params}` : ""}`;
  });

  document.querySelectorAll("[data-carousel]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const piste = document.getElementById(bouton.dataset.carousel);
      if (!piste) return;
      const direction = bouton.dataset.direction === "prev" ? -1 : 1;
      piste.scrollBy({ left: direction * 340, behavior: "smooth" });
    });
  });

  document.addEventListener("click", (event) => {
    if (
      !event.target.closest(".search-shell") &&
      !event.target.closest("#home-suggestions")
    ) {
      suggestions?.classList.remove("show");
    }
  });
  window.addEventListener("resize", placerSuggestionsAccueil);
  window.addEventListener("scroll", placerSuggestionsAccueil);
}

document.addEventListener("DOMContentLoaded", async () => {
  await attendreSession();
  initialiserRechercheAccueil();
  chargerServicesAccueil();
});
