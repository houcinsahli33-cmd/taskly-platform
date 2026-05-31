function definirRoleInscription(role) {
  const roleFinal = role === "artisan" ? "artisan" : "client";
  document.getElementById("register-role").value = roleFinal;

  document.querySelectorAll("[data-role-choice]").forEach((bouton) => {
    bouton.classList.toggle("active", bouton.dataset.roleChoice === roleFinal);
  });

  document.querySelectorAll("[data-role-fields]").forEach((bloc) => {
    bloc.hidden = bloc.dataset.roleFields !== roleFinal;
  });
}

async function chargerServicesInscription() {
  const select = document.getElementById("register-service");
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

function initialiserInscription() {
  const form = document.getElementById("register-form");
  if (!form) return;

  const roleDepuisUrl = obtenirParametre("role");
  definirRoleInscription(roleDepuisUrl || "client");
  chargerServicesInscription();

  document.querySelectorAll("[data-role-choice]").forEach((bouton) => {
    bouton.addEventListener("click", () => definirRoleInscription(bouton.dataset.roleChoice));
  });

  const alerte = document.getElementById("register-alert");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    masquerAlerte(alerte);

    const role = document.getElementById("register-role").value;
    const payload = {
      role,
      nom: document.getElementById("register-nom").value.trim(),
      prenom: document.getElementById("register-prenom").value.trim(),
      email: document.getElementById("register-email").value.trim(),
      motDePasse: document.getElementById("register-password").value
    };

    if (role === "client") {
      payload.telephone = document.getElementById("register-client-phone").value.trim();
      payload.ville = document.getElementById("register-client-city").value.trim();
      payload.adresse = document.getElementById("register-client-address").value.trim();
    } else {
      payload.serviceId = Number(document.getElementById("register-service").value);
      payload.ville = document.getElementById("register-artisan-city").value.trim();
      payload.telephone = document.getElementById("register-artisan-phone").value.trim();
      payload.description = document.getElementById("register-description").value.trim();
      payload.experience = Number(document.getElementById("register-experience").value || 0);
    }

    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    try {
      await requeteAPI("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      afficherAlerte(alerte, "Compte créé avec succès. Vous pouvez maintenant vous connecter.", "success");
      form.reset();
      definirRoleInscription(role);
      window.setTimeout(() => {
        window.location.href = "/login.html";
      }, 1200);
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

  initialiserConnexion();
  initialiserInscription();
});
