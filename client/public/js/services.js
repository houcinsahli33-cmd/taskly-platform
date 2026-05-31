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

async function chargerPageServices() {
  const grille = document.getElementById("services-grid");
  if (!grille) return;
  grille.innerHTML = etatChargement("Chargement des services...");

  try {
    const { services } = await requeteAPI("/api/services");
    if (!services.length) {
      grille.innerHTML = etatVide("Aucun service disponible.");
      return;
    }

    grille.innerHTML = services.map((service) => `
      <article class="card service-card">
        <img class="service-image" src="${echapperHTML(imageService(service))}" alt="${echapperHTML(service.nom)}" data-service-image="${echapperHTML(service.nom)}">
        <div class="card-body">
          <h3>${echapperHTML(service.nom)}</h3>
          <p class="muted">${echapperHTML(service.description || "Service proposé par les artisans Taskly.")}</p>
          <a class="btn outline" href="/service.html?id=${service.id}">Voir les artisans</a>
        </div>
      </article>
    `).join("");

    grille.querySelectorAll("[data-service-image]").forEach((img) => {
      gererImageService(img, img.dataset.serviceImage);
    });
  } catch (error) {
    grille.innerHTML = etatVide(error.message);
  }
}

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
      <div class="profile-hero">
        <img class="avatar large" src="${echapperHTML(imageService(service))}" alt="${echapperHTML(service.nom)}" data-service-image="${echapperHTML(service.nom)}">
        <div>
          <p class="eyebrow">Service Taskly</p>
          <h1>${echapperHTML(service.nom)}</h1>
          <p class="lead">${echapperHTML(service.description || "Trouvez un artisan qualifié pour ce service.")}</p>
        </div>
        <a class="btn primary" href="/artisans.html?serviceId=${service.id}">Comparer les artisans</a>
      </div>
    `;
    cible.querySelectorAll("[data-service-image]").forEach((img) => gererImageService(img, service.nom));

    if (!artisans.length) {
      artisansCible.innerHTML = etatVide("Aucun artisan n'est encore inscrit pour ce service.");
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
  chargerPageServices();
  chargerDetailService();
});
