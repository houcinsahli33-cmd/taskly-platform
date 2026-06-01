// Remplir les champs wilaya/commune des formulaires
function initialiserLocalisationAuth() {
  const clientWilaya = document.getElementById("client-wilaya");
  const clientCommune = document.getElementById("client-commune");
  const artisanWilaya = document.getElementById("artisan-wilaya");
  const artisanCommune = document.getElementById("artisan-commune");

  if (typeof remplirWilayas !== "function") return;

  remplirWilayas(clientWilaya, clientCommune);
  remplirWilayas(artisanWilaya, artisanCommune);
}

// Charger les services dans le formulaire artisan
async function chargerServicesInscriptionArtisan() {
  const select = document.getElementById("artisan-service");
  if (!select) return;

  try {
    const { services } = await requeteAPI("/api/services");
    select.innerHTML = `<option value="">Choisir un service</option>` + services
      .map((service) => `<option value="${service.id}">${echapperHTML(service.nom)}</option>`)
      .join("");
  } catch (error) {
    select.innerHTML = `<option value="">Services indisponibles</option>`;
    afficherToast(error.message, "error");
  }
}

function afficherOngletAuth(nomOnglet) {
  const boutonActif = document.querySelector(`[data-auth-tab="${nomOnglet}"]`);
  if (!boutonActif) return;

  document.querySelectorAll("[data-auth-tab]").forEach((bouton) => {
    bouton.classList.toggle("active", bouton === boutonActif);
  });

  document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.authPanel === nomOnglet);
  });
}

// Changer l'onglet connexion / inscription
function initialiserOngletsAuth() {
  document.querySelectorAll("[data-auth-tab]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      afficherOngletAuth(bouton.dataset.authTab);
    });
  });

  document.querySelectorAll("[data-switch-auth]").forEach((lien) => {
    lien.addEventListener("click", (event) => {
      event.preventDefault();
      afficherOngletAuth(lien.dataset.switchAuth);
    });
  });

  const mode = obtenirParametre("mode") || document.body.dataset.authMode;
  if (mode === "register") {
    afficherOngletAuth("register");
  }
}

// Envoyer le formulaire de connexion
function initialiserConnexion() {
  const form = document.getElementById("login-form");
  if (!form) return;

  const alerte = document.getElementById("login-alert");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    masquerAlerte(alerte);

    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    try {
      const data = await requeteAPI("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: document.getElementById("login-email").value.trim(),
          motDePasse: document.getElementById("login-password").value
        })
      });

      afficherToast("Connexion réussie.");
      const redirect = obtenirParametre("redirect");
      window.location.href = redirect || lienDashboard(data.utilisateur.role);
    } catch (error) {
      if (error.status === 403 && error.data?.motif) {
        afficherAlerte(
          alerte,
          `<strong>Votre compte a été bloqué.</strong><br>${echapperHTML(error.data.motif)}<br><a class="btn outline small" href="/contact.html" style="margin-top:12px">Contacter le support</a>`,
          "error"
        );
      } else {
        afficherAlerte(alerte, echapperHTML(error.message), "error");
      }
    } finally {
      bouton.disabled = false;
    }
  });
}

// Inscrire un client
function initialiserInscriptionClient() {
  const form = document.getElementById("client-register-form");
  if (!form) return;

  const alerte = document.getElementById("client-register-alert");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    masquerAlerte(alerte);

    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    const payload = {
      role: "client",
      nom: document.getElementById("client-nom").value.trim(),
      prenom: document.getElementById("client-prenom").value.trim(),
      email: document.getElementById("client-email").value.trim(),
      motDePasse: document.getElementById("client-password").value,
      telephone: document.getElementById("client-phone").value.trim(),
      ville: document.getElementById("client-commune").value,
      adresse: document.getElementById("client-address").value.trim()
    };

    try {
      await requeteAPI("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      afficherAlerte(alerte, "Compte client créé avec succès. Vous pouvez vous connecter.", "success");
      form.reset();
      document.querySelector("[data-auth-tab='login']")?.click();
    } catch (error) {
      afficherAlerte(alerte, echapperHTML(error.message), "error");
    } finally {
      bouton.disabled = false;
    }
  });
}

// Inscrire un artisan
function initialiserInscriptionArtisan() {
  const form = document.getElementById("artisan-register-form");
  if (!form) return;

  const alerte = document.getElementById("artisan-register-alert");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    masquerAlerte(alerte);

    const experience = Number(document.getElementById("artisan-experience").value || 0);
    if (experience < 0 || experience > 50) {
      afficherAlerte(alerte, "L'expérience doit être comprise entre 0 et 50 ans.", "error");
      return;
    }

    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    const payload = {
      role: "artisan",
      nom: document.getElementById("artisan-nom").value.trim(),
      prenom: document.getElementById("artisan-prenom").value.trim(),
      email: document.getElementById("artisan-email").value.trim(),
      motDePasse: document.getElementById("artisan-password").value,
      telephone: document.getElementById("artisan-phone").value.trim(),
      serviceId: Number(document.getElementById("artisan-service").value),
      ville: document.getElementById("artisan-commune").value,
      experience,
      description: document.getElementById("artisan-description").value.trim()
    };

    try {
      await requeteAPI("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      afficherAlerte(alerte, "Compte artisan créé avec succès. Vous pouvez maintenant vous connecter.", "success");
      form.reset();
      window.setTimeout(() => {
        window.location.href = "/login.html";
      }, 1000);
    } catch (error) {
      afficherAlerte(alerte, echapperHTML(error.message), "error");
    } finally {
      bouton.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await attendreSession();
  if (window.utilisateurCourant && document.body.dataset.authPage === "true") {
    redirigerSelonRole(window.utilisateurCourant);
    return;
  }

  initialiserLocalisationAuth();
  initialiserOngletsAuth();
  initialiserConnexion();
  initialiserInscriptionClient();
  initialiserInscriptionArtisan();
  chargerServicesInscriptionArtisan();
});
