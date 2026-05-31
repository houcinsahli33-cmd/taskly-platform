async function chargerServicesAccueil() {
  const piste = document.getElementById("services-carousel");
  const select = document.getElementById("home-service");
  if (!piste) return;

  piste.innerHTML = etatChargement("Chargement des services...");

  try {
    const { services } = await requeteAPI("/api/services");

    if (select) {
      select.innerHTML = `<option value="">Tous les services</option>` + services
        .map((service) => `<option value="${service.id}">${echapperHTML(service.nom)}</option>`)
        .join("");
    }

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
            <p class="muted">${echapperHTML(tronquer(service.description, 96))}</p>
          </div>
          <a class="btn outline" href="/service.html?id=${service.id}">Voir les artisans</a>
        </div>
      </article>
    `).join("");

    piste.querySelectorAll("[data-service-image]").forEach((img) => {
      gererImageService(img, img.dataset.serviceImage);
    });
  } catch (error) {
    piste.innerHTML = etatVide(error.message);
  }
}

async function chargerArtisansAccueil() {
  const cible = document.getElementById("home-artisans");
  if (!cible) return;

  cible.innerHTML = etatChargement("Recherche d'artisans...");

  try {
    const { artisans } = await requeteAPI("/api/artisans");
    const visibles = artisans.slice(0, 3);

    if (!visibles.length) {
      cible.innerHTML = etatVide("Les artisans apparaîtront ici dès leur inscription.");
      return;
    }

    cible.innerHTML = visibles.map((artisan) => `
      <article class="card artisan-card">
        <div class="card-body">
          <div class="artisan-top">
            <img class="avatar" src="${echapperHTML(imageProfil(artisan.photo_profil))}" alt="${echapperHTML(nomComplet(artisan))}">
            <div>
              <h3>${echapperHTML(nomComplet(artisan))}</h3>
              <p class="muted">${echapperHTML(artisan.service_nom)} à ${echapperHTML(artisan.ville)}</p>
            </div>
          </div>
          <div class="meta-row">
            <span class="badge primary">${Number(artisan.experience || 0)} an(s) d'expérience</span>
            <span class="badge accent">Disponible</span>
          </div>
          <p class="muted">${echapperHTML(tronquer(artisan.description || "Artisan Taskly prêt à intervenir.", 110))}</p>
          <a class="btn outline" href="/artisan-profile.html?id=${artisan.id}">Voir le profil</a>
        </div>
      </article>
    `).join("");
  } catch (error) {
    cible.innerHTML = etatVide(error.message);
  }
}

function initialiserRechercheAccueil() {
  const form = document.getElementById("home-search-form");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const serviceId = document.getElementById("home-service")?.value;
    const ville = document.getElementById("home-city")?.value.trim();
    const params = new URLSearchParams();

    if (serviceId) params.set("serviceId", serviceId);
    if (ville) params.set("ville", ville);

    window.location.href = `/artisans.html${params.toString() ? `?${params}` : ""}`;
  });

  document.querySelectorAll("[data-carousel]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const piste = document.getElementById(bouton.dataset.carousel);
      if (!piste) return;
      const direction = bouton.dataset.direction === "prev" ? -1 : 1;
      piste.scrollBy({ left: direction * 320, behavior: "smooth" });
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await attendreSession();
  initialiserRechercheAccueil();
  chargerServicesAccueil();
  chargerArtisansAccueil();
});
