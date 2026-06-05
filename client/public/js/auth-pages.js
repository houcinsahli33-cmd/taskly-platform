// Afficher une erreur sous un champ
function afficherErreurChamp(input, message) {
  if (!input) return;
  
  input.classList.add("field-error");
  
  // Creer le message si besoin
  let errorMsg = document.getElementById(`${input.id}-error`);
  if (!errorMsg) {
    errorMsg = document.createElement("div");
    errorMsg.id = `${input.id}-error`;
    errorMsg.className = "field-error-message";
    
    // Placer le message apres le champ
    input.parentNode.appendChild(errorMsg);
  }
  errorMsg.textContent = message;
  errorMsg.style.display = "block";
}

// Nettoyer l'erreur quand le champ change
function effacerErreurChamp(input) {
  if (!input) return;
  input.classList.remove("field-error");
  const errorMsg = document.getElementById(`${input.id}-error`);
  if (errorMsg) {
    errorMsg.style.display = "none";
  }
}

// Nettoyer les erreurs a la saisie
function attacherNettoyageErreurs(form) {
  form.querySelectorAll(".form-control, .form-select, .form-textarea").forEach((input) => {
    input.addEventListener("input", () => effacerErreurChamp(input));
    input.addEventListener("change", () => effacerErreurChamp(input));
  });
}

// Verifier les champs obligatoires
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

// Verifier le format email
function validerFormatEmail(inputEmail) {
  if (!inputEmail || !inputEmail.value.trim()) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(inputEmail.value.trim())) {
    afficherErreurChamp(inputEmail, "Veuillez entrer une adresse email valide.");
    return false;
  }
  return true;
}

// Verifier la force du mot de passe
function analyserMotDePasse(motDePasse) {
  const longueur = motDePasse.length >= 8;
  const minuscule = /[a-z]/.test(motDePasse);
  const majuscule = /[A-Z]/.test(motDePasse);
  const chiffre = /[0-9]/.test(motDePasse);

  const estFort = longueur && minuscule && majuscule && chiffre;

  let niveau = "";
  let texte = "";

  if (!motDePasse) {
    niveau = "";
    texte = "";
  } else if (!longueur) {
    niveau = "vulnerable";
    texte = "Vulnérable";
  } else if (!estFort) {
    niveau = "weak";
    texte = "Faible";
  } else {
    niveau = "strong";
    texte = "Fort";
  }

  return {
    longueur,
    minuscule,
    majuscule,
    chiffre,
    estFort,
    niveau,
    texte
  };
}

// Mettre a jour les barres de force du mot de passe
function mettreAJourForceMotDePasse(inputPassword) {
  if (!inputPassword) return;

  const analyse = analyserMotDePasse(inputPassword.value);
  const texte = document.getElementById(`${inputPassword.id}-strength-text`);
  const barres = document.querySelector(`[data-password-strength="${inputPassword.id}"]`);

  if (texte) {
    texte.textContent = analyse.texte;
    texte.className = "password-strength-text";

    if (analyse.niveau) {
      texte.classList.add(analyse.niveau);
    }
  }

  if (barres) {
    barres.className = "password-strength-bars";

    if (analyse.niveau) {
      barres.classList.add(analyse.niveau);
    }
  }
}

// Valider le mot de passe avant inscription
function validerMotDePasseInscription(inputPassword) {
  if (!inputPassword || !inputPassword.value.trim()) {
    return true; // le champ obligatoire est deja gere par validerChampsObligatoires
  }

  const analyse = analyserMotDePasse(inputPassword.value);

  if (!analyse.estFort) {
    afficherErreurChamp(inputPassword, "Choisissez un mot de passe plus fort.");
    return false;
  }

  return true;
}

// Mettre a jour le petit indicateur email
function mettreAJourStatutEmail(inputEmail) {
  if (!inputEmail) return;

  const icone = document.getElementById(`${inputEmail.id}-status`);
  if (!icone) return;

  const valeur = inputEmail.value.trim();

  icone.className = "field-status-icon";

  if (!valeur) return;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (emailRegex.test(valeur)) {
    icone.classList.add("valid");
  } else {
    icone.classList.add("invalid");
  }
}


function iconeOeil() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `;
}

function iconeOeilBarre() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
      <circle cx="12" cy="12" r="3"></circle>
      <line x1="4" y1="20" x2="20" y2="4"></line>
    </svg>
  `;
}

// Initialiser les indicateurs email + mot de passe
function initialiserIndicateursAuth() {
  const emails = [
    document.getElementById("client-email"),
    document.getElementById("artisan-email")
  ];

  emails.forEach((inputEmail) => {
    if (!inputEmail) return;

    inputEmail.addEventListener("input", () => {
      mettreAJourStatutEmail(inputEmail);
    });

    inputEmail.addEventListener("blur", () => {
      mettreAJourStatutEmail(inputEmail);
    });
  });

  const motsDePasse = [
    document.getElementById("client-password"),
    document.getElementById("artisan-password")
  ];

  motsDePasse.forEach((inputPassword) => {
    if (!inputPassword) return;

    mettreAJourForceMotDePasse(inputPassword);

    inputPassword.addEventListener("input", () => {
      mettreAJourForceMotDePasse(inputPassword);
    });
  });

  document.querySelectorAll("[data-password-toggle]").forEach((bouton) => {
    bouton.innerHTML = iconeOeil();

    bouton.addEventListener("click", () => {
      const input = document.getElementById(bouton.dataset.passwordToggle);
      if (!input) return;

      if (input.type === "password") {
        input.type = "text";
        bouton.innerHTML = iconeOeilBarre();
        bouton.classList.add("is-visible");
        bouton.setAttribute("aria-label", "Masquer le mot de passe");
      } else {
        input.type = "password";
        bouton.innerHTML = iconeOeil();
        bouton.classList.remove("is-visible");
        bouton.setAttribute("aria-label", "Afficher le mot de passe");
      }
    });
  });
}


// Logique applicative et envois API

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

// Afficher le panneau auth demande
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
  attacherNettoyageErreurs(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    masquerAlerte(alerte);

    const inputEmail = document.getElementById("login-email");
    const inputPassword = document.getElementById("login-password");

    let valide = validerChampsObligatoires(form);
    if (valide) valide = validerFormatEmail(inputEmail);

    // Arreter si le formulaire n'est pas valide
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
          `<strong>Votre compte a été bloqué.</strong><br>${echapperHTML(error.data.motif)}<br><a class="btn outline small mt-12" href="/contact.html">Contacter le support</a>`,
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

// Inscrire un client
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

    // Arreter si le formulaire n'est pas valide
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

// Inscrire un artisan
function initialiserInscriptionArtisan() {
  const form = document.getElementById("artisan-register-form");
  if (!form) return;

  const alerte = document.getElementById("artisan-register-alert");
  attacherNettoyageErreurs(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    masquerAlerte(alerte);

    const inputEmail = document.getElementById("artisan-email");
    const inputPassword = document.getElementById("artisan-password");
    const inputExp = document.getElementById("artisan-experience");

    let valide = validerChampsObligatoires(form);
    const emailValide = validerFormatEmail(inputEmail);
    const motDePasseValide = validerMotDePasseInscription(inputPassword);

    valide = valide && emailValide && motDePasseValide;

    const experience = Number(inputExp.value || 0);
    if (experience < 0 || experience > 50) {
      afficherErreurChamp(inputExp, "L'expérience doit être comprise entre 0 et 50 ans.");
      inputExp.value = 0;
      valide = false;
    }

    // Arreter si le formulaire n'est pas valide
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

// Lancer au chargement du DOM
document.addEventListener("DOMContentLoaded", async () => {
  await attendreSession();
  if (window.utilisateurCourant && document.body.dataset.authPage === "true") {
    redirigerSelonRole(window.utilisateurCourant);
    return;
  }

  initialiserLocalisationAuth();
  initialiserOngletsAuth();
  initialiserIndicateursAuth();
  initialiserConnexion();
  initialiserInscriptionClient();
  initialiserInscriptionArtisan();
  chargerServicesInscriptionArtisan();
});
