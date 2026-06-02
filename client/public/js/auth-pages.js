// Affiche proprement une erreur sous un champ spécifique avec bordure rouge
function afficherErreurChamp(input, message) {
  if (!input) return;
  
  // Style rouge visuel sur le champ
  input.style.borderColor = "#dc3545";
  input.style.boxShadow = "0 0 0 0.2rem rgba(220, 53, 69, 0.25)";
  
  // Crée ou récupère le conteneur du sous-texte d'erreur
  let errorMsg = document.getElementById(`${input.id}-error`);
  if (!errorMsg) {
    errorMsg = document.createElement("div");
    errorMsg.id = `${input.id}-error`;
    errorMsg.style.color = "#dc3545";
    errorMsg.style.fontSize = "0.82rem";
    errorMsg.style.marginTop = "5px";
    
    // Insère le message juste après le champ ciblé
    input.parentNode.appendChild(errorMsg);
  }
  errorMsg.textContent = message;
  errorMsg.style.display = "block";
}

// Nettoie les styles d'erreur d'un champ dès qu'il est modifié
function effacerErreurChamp(input) {
  if (!input) return;
  input.style.borderColor = "";
  input.style.boxShadow = "";
  const errorMsg = document.getElementById(`${input.id}-error`);
  if (errorMsg) {
    errorMsg.style.display = "none";
  }
}

// Branche des écouteurs sur tous les inputs d'un formulaire pour effacer le rouge à la frappe
function attacherNettoyageErreurs(form) {
  form.querySelectorAll(".form-control, .form-select, .form-textarea").forEach((input) => {
    input.addEventListener("input", () => effacerErreurChamp(input));
    input.addEventListener("change", () => effacerErreurChamp(input));
  });
}

// Vérifie les champs obligatoires vides d'un formulaire
function validerChampsObligatoires(form) {
  let estValide = true;
  const champsRequis = form.querySelectorAll("[required]");
  champsRequis.forEach((input) => {
    if (!input.value.trim()) {
      afficherErreurChamp(input, "Ce champ est obligatoire.");
      estValide = false;
    }
  });
  return estValide;
}

// Vérifie la validité du format d'un e-mail
function validerFormatEmail(inputEmail) {
  if (!inputEmail || !inputEmail.value.trim()) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(inputEmail.value.trim())) {
    afficherErreurChamp(inputEmail, "Veuillez entrer une adresse email valide.");
    return false;
  }
  return true;
}


// =========================================================================
// LOGIQUE APPLICATIVE ET ENVOIS API
// =========================================================================

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

// 1. Envoyer le formulaire de CONNEXION
function initialiserConnexion() {
  const form = document.getElementById("login-form");
  if (!form) return;

  const alerte = document.getElementById("login-alert");
  attacherNettoyageErreurs(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    masquerAlerte(alerte);

    const inputEmail = document.getElementById("login-email");
    const inputPassword = document.getElementById("login-password");

    let valide = validerChampsObligatoires(form);
    if (valide) valide = validerFormatEmail(inputEmail);

    // Si le formulaire n'est pas valide, on arrête tout simplement (pas de popup à droite)
    if (!valide) return;

    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    try {
      const data = await requeteAPI("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: inputEmail.value.trim(),
          motDePasse: inputPassword.value
        })
      });

      afficherToast("Connexion réussie.", "success");
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
        afficherErreurChamp(inputEmail, " ");
        afficherErreurChamp(inputPassword, "Identifiants incorrects ou introuvables.");
        afficherToast(error.message, "error");
      }
    } finally {
      bouton.disabled = false;
    }
  });
}

// 2. Inscrire un CLIENT
function initialiserInscriptionClient() {
  const form = document.getElementById("client-register-form");
  if (!form) return;

  const alerte = document.getElementById("client-register-alert");
  attacherNettoyageErreurs(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    masquerAlerte(alerte);

    const inputEmail = document.getElementById("client-email");

    let valide = validerChampsObligatoires(form);
    if (valide) valide = validerFormatEmail(inputEmail);

    // Si le formulaire n'est pas valide, on arrête tout simplement (pas de popup à droite)
    if (!valide) return;

    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    const payload = {
      role: "client",
      nom: document.getElementById("client-nom").value.trim(),
      prenom: document.getElementById("client-prenom").value.trim(),
      email: inputEmail.value.trim(),
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

      afficherToast("Compte client créé avec succès !", "success");
      form.reset();
      document.querySelector("[data-auth-tab='login']")?.click();
    } catch (error) {
      if (error.message && error.message.toLowerCase().includes("email")) {
        afficherErreurChamp(inputEmail, error.message);
      } else {
        afficherToast(error.message, "error");
      }
    } finally {
      bouton.disabled = false;
    }
  });
}

// 3. Inscrire un ARTISAN
function initialiserInscriptionArtisan() {
  const form = document.getElementById("artisan-register-form");
  if (!form) return;

  const alerte = document.getElementById("artisan-register-alert");
  attacherNettoyageErreurs(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    masquerAlerte(alerte);

    const inputEmail = document.getElementById("artisan-email");
    const inputExp = document.getElementById("artisan-experience");

    let valide = validerChampsObligatoires(form);
    if (valide) valide = validerFormatEmail(inputEmail);

    const experience = Number(inputExp.value || 0);
    if (experience < 0 || experience > 50) {
      afficherErreurChamp(inputExp, "L'expérience doit être comprise entre 0 et 50 ans.");
      inputExp.value = 0;
      valide = false;
    }

    // Si le formulaire n'est pas valide, on arrête tout simplement (pas de popup à droite)
    if (!valide) return;

    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    const payload = {
      role: "artisan",
      nom: document.getElementById("artisan-nom").value.trim(),
      prenom: document.getElementById("artisan-prenom").value.trim(),
      email: inputEmail.value.trim(),
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

      afficherToast("Compte artisan créé avec succès ! Direction connexion...", "success");
      form.reset();
      window.setTimeout(() => {
        window.location.href = "/login.html";
      }, 1200);
    } catch (error) {
      if (error.message && error.message.toLowerCase().includes("email")) {
        afficherErreurChamp(inputEmail, error.message);
      } else {
        afficherToast(error.message, "error");
      }
    } finally {
      bouton.disabled = false;
    }
  });
}

// Lancement au chargement du DOM
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