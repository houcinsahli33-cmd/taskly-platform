let servicesAccueil = [];
let serviceChoisiAccueil = null;

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
      <article class="card service-card">
        <img class="service-image" src="${echapperHTML(imageService(service))}" alt="${echapperHTML(service.nom)}" data-service-image="${echapperHTML(service.nom)}">
        <div class="card-body">
          <div>
            <h3>${echapperHTML(service.nom)}</h3>
            <p class="muted">${echapperHTML(tronquer(service.description, 105))}</p>
          </div>
          <a class="btn outline" href="/service.html?id=${service.id}">Consulter le service</a>
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
    afficherSuggestionsAccueil(input.value);
  });

  suggestions?.addEventListener("click", (event) => {
    const bouton = event.target.closest("[data-suggestion-service]");
    if (!bouton) return;

    serviceChoisiAccueil = servicesAccueil.find((service) => String(service.id) === String(bouton.dataset.suggestionService));
    input.value = serviceChoisiAccueil.nom;
    suggestions.classList.remove("show");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const recherche = input.value.trim();
    const service = serviceChoisiAccueil || servicesAccueil.find((item) => normaliserTexte(item.nom) === normaliserTexte(recherche));

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
