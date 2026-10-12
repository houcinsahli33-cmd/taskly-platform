function iconeValidation() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 13 4 4L19 7"></path></svg>';
}

function iconeErreur() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10"></path><path d="m17 7-10 10"></path></svg>';
}

function afficherErreurChamp(input, message) {
  if (!input) return;
  input.classList.add("field-error");

  const container = input.closest("label") || input.parentNode;
  let errorMsg = document.getElementById(`${input.id}-error`);

  if (!errorMsg) {
    errorMsg = document.createElement("div");
    errorMsg.id = `${input.id}-error`;
    errorMsg.className = "field-error-message taskly-form-error";
    container.appendChild(errorMsg);
  }

  errorMsg.textContent = message;
  errorMsg.style.display = "block";
}

function effacerErreurChamp(input) {
  if (!input) return;
  input.classList.remove("field-error");
  const errorMsg = document.getElementById(`${input.id}-error`);
  if (errorMsg) errorMsg.style.display = "none";
}

function attacherNettoyageErreurs(form) {
  form.querySelectorAll(".form-control, .form-select, .form-textarea").forEach((input) => {
    input.addEventListener("input", () => effacerErreurChamp(input));
    input.addEventListener("change", () => effacerErreurChamp(input));
  });
}

function validerChampsObligatoires(form) {
  let estValide = true;
  form.querySelectorAll("[required]").forEach((input) => {
    if (!String(input.value || "").trim()) {
      afficherErreurChamp(input, "Ce champ est obligatoire.");
      estValide = false;
    }
  });
  return estValide;
}

function estEmailGmail(valeur) {
  return /^[A-Za-z0-9._%+-]+@gmail\.com$/i.test(String(valeur || "").trim());
}

function validerFormatEmail(inputEmail, { gmailOnly = false } = {}) {
  if (!inputEmail || !inputEmail.value.trim()) return true;
  const valeur = inputEmail.value.trim();
  const regexGeneral = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!regexGeneral.test(valeur)) {
    afficherErreurChamp(inputEmail, "Veuillez entrer une adresse e-mail valide.");
    return false;
  }

  if (gmailOnly && !estEmailGmail(valeur)) {
    afficherErreurChamp(inputEmail, "Veuillez utiliser une adresse @gmail.com.");
    return false;
  }

  return true;
}

function estTelephoneAlgerien(valeur) {
  return /^0[567]\d{8}$/.test(String(valeur || "").trim());
}

function validerTelephoneAlgerien(inputPhone) {
  if (!inputPhone || !String(inputPhone.value || "").trim()) return true;
  if (!estTelephoneAlgerien(inputPhone.value)) {
    afficherErreurChamp(inputPhone, "Entrez un numéro algérien valide de 10 chiffres (05, 06 ou 07). ");
    return false;
  }
  return true;
}

function normaliserChampTelephone(input) {
  if (!input) return;
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 10);
  });
}

function analyserMotDePasse(motDePasse) {
  const longueur = motDePasse.length >= 8;
  const minuscule = /[a-z]/.test(motDePasse);
  const majuscule = /[A-Z]/.test(motDePasse);
  const chiffre = /\d/.test(motDePasse);
  const symbole = /[^A-Za-z0-9]/.test(motDePasse);

  const estFort = longueur && minuscule && majuscule && chiffre && symbole;
  let niveau = "";
  let texte = "";

  if (!motDePasse) {
    niveau = "";
    texte = "";
  } else if (!longueur || (!minuscule && !majuscule && !chiffre && !symbole)) {
    niveau = "vulnerable";
    texte = "Faible";
  } else if (estFort) {
    niveau = "strong";
    texte = "Fort";
  } else {
    niveau = "weak";
    texte = "Moyen";
  }

  return { longueur, minuscule, majuscule, chiffre, symbole, estFort, niveau, texte };
}

function mettreAJourForceMotDePasse(inputPassword) {
  if (!inputPassword) return;
  const analyse = analyserMotDePasse(inputPassword.value);
  const texte = document.getElementById(`${inputPassword.id}-strength-text`);
  const barres = document.querySelector(`[data-password-strength="${inputPassword.id}"]`);

  if (texte) {
    texte.textContent = analyse.texte;
    texte.className = "taskly-password-strength password-strength-text";
    if (analyse.niveau) texte.classList.add(analyse.niveau);
  }

  if (barres) {
    barres.className = "taskly-password-strength-bars password-strength-bars";
    if (analyse.niveau) barres.classList.add(analyse.niveau);
  }
}

function validerMotDePasseInscription(inputPassword) {
  if (!inputPassword || !inputPassword.value.trim()) return true;
  const analyse = analyserMotDePasse(inputPassword.value);
  if (!analyse.estFort) {
    afficherErreurChamp(inputPassword, "Choisissez un mot de passe fort : 8 caractères minimum avec majuscule, minuscule, chiffre et symbole.");
    return false;
  }
  return true;
}

function mettreAJourStatutEmail(inputEmail, { gmailOnly = false } = {}) {
  if (!inputEmail) return;
  const icone = document.getElementById(`${inputEmail.id}-status`);
  if (!icone) return;

  const valeur = inputEmail.value.trim();
  icone.className = "taskly-field-status field-status-icon";
  icone.innerHTML = "";

  if (!valeur) return;
  const estValide = gmailOnly ? estEmailGmail(valeur) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur);
  if (estValide) {
    icone.classList.add("valid");
    icone.innerHTML = iconeValidation();
  } else {
    icone.classList.add("invalid");
    icone.innerHTML = iconeErreur();
  }
}

function iconeOeil() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
}

function iconeOeilBarre() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="3"></circle><line x1="4" y1="20" x2="20" y2="4"></line></svg>`;
}

function initialiserIndicateursAuth() {
  [document.getElementById("client-email"), document.getElementById("artisan-email")].forEach((inputEmail) => {
    if (!inputEmail) return;
    inputEmail.addEventListener("input", () => mettreAJourStatutEmail(inputEmail));
    inputEmail.addEventListener("blur", () => mettreAJourStatutEmail(inputEmail));
  });

  [document.getElementById("client-password"), document.getElementById("artisan-password")].forEach((inputPassword) => {
    if (!inputPassword) return;
    mettreAJourForceMotDePasse(inputPassword);
    inputPassword.addEventListener("input", () => mettreAJourForceMotDePasse(inputPassword));
  });

  [document.getElementById("client-phone"), document.getElementById("artisan-phone")].forEach(normaliserChampTelephone);

  document.querySelectorAll("[data-password-toggle]").forEach((bouton) => {
    bouton.innerHTML = iconeOeil();
    bouton.addEventListener("click", () => {
      const input = document.getElementById(bouton.dataset.passwordToggle);
      if (!input) return;
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      bouton.innerHTML = visible ? iconeOeilBarre() : iconeOeil();
      bouton.classList.toggle("is-visible", visible);
      bouton.setAttribute("aria-pressed", String(visible));
      bouton.setAttribute("aria-label", visible ? "Masquer le mot de passe" : "Afficher le mot de passe");
    });
  });
}

function initialiserLocalisationAuth() {
  const clientWilaya = document.getElementById("client-wilaya");
  const clientCommune = document.getElementById("client-commune");
  const artisanWilaya = document.getElementById("artisan-wilaya");
  const artisanCommune = document.getElementById("artisan-commune");
  if (typeof remplirWilayas !== "function") return;
  remplirWilayas(clientWilaya, clientCommune);
  remplirWilayas(artisanWilaya, artisanCommune);
}

async function chargerServicesInscriptionArtisan() {
  const select = document.getElementById("artisan-service");
  if (!select) return;

  try {
    const { services } = await requeteAPI("/api/services");
    select.innerHTML = `<option value="">Choisir un service</option>` + services.map((service) => `<option value="${service.id}">${echapperHTML(service.nom)}</option>`).join("");
  } catch (error) {
    select.innerHTML = `<option value="">Services indisponibles</option>`;
    afficherToast(error.message, "error");
  }
}

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
  if (mode === "register") afficherOngletAuth("register");
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
    if (valide) valide = validerFormatEmail(inputEmail, { gmailOnly: false });
    if (!valide) return;

    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    try {
      const data = await requeteAPI("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: inputEmail.value.trim(), motDePasse: inputPassword.value })
      });
      if (data.codeRequis) {
        window.location.href = '/verify-email.html';
      } else {
        // Fallback uniquement pour compatibilité avec une ancienne version serveur.
        afficherToast("Connexion réussie.", "success");
        window.location.href = lienDashboard(data.utilisateur.role);
      }
    } catch (error) {
      if(error.status===403){
        afficherAlerte(alerte,error.message,'error');
        const link=document.createElement('a');link.href='/contact.html';link.className='btn outline small mt-12';link.textContent='Contacter le support';alerte.appendChild(document.createElement('br'));alerte.appendChild(link);
      }else{afficherAlerte(alerte,error.message,'error');}

    } finally {
      bouton.disabled = false;
    }
  });
}

function initialiserInscriptionClient() {
  const form = document.getElementById("client-register-form");
  if (!form) return;

  const alerte = document.getElementById("client-register-alert");
  attacherNettoyageErreurs(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    masquerAlerte(alerte);

    const inputEmail = document.getElementById("client-email");
    const inputPassword = document.getElementById("client-password");
    const inputPhone = document.getElementById("client-phone");

    let valide = validerChampsObligatoires(form);
    const emailValide = validerFormatEmail(inputEmail);
    const motDePasseValide = validerMotDePasseInscription(inputPassword);
    const telephoneValide = validerTelephoneAlgerien(inputPhone);
    valide = valide && emailValide && motDePasseValide && telephoneValide;
    if (!valide) return;

    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    const payload = {
      role: "client",
      nom: document.getElementById("client-nom").value.trim(),
      prenom: document.getElementById("client-prenom").value.trim(),
      email: inputEmail.value.trim(),
      motDePasse: inputPassword.value,
      telephone: inputPhone.value.trim(),
      ville: document.getElementById("client-commune").value,
      adresse: document.getElementById("client-address").value.trim()
    };

    try {
      await requeteAPI("/api/auth/register", { method: "POST", body: JSON.stringify(payload) });
      afficherToast("Un code de validation vous a été envoyé par e-mail.", "success");
      window.location.href = `/verify-email.html`;
    } catch (error) {
      if (/email/i.test(error.message || "")) afficherErreurChamp(inputEmail, error.message);
      else if (/téléphone|telephone/i.test(error.message || "")) afficherErreurChamp(inputPhone, error.message);
      else if (/mot de passe/i.test(error.message || "")) afficherErreurChamp(inputPassword, error.message);
      else afficherToast(error.message, "error");
    } finally {
      bouton.disabled = false;
    }
  });
}

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
    const inputPhone = document.getElementById("artisan-phone");
    const inputExp = document.getElementById("artisan-experience");

    let valide = validerChampsObligatoires(form);
    const emailValide = validerFormatEmail(inputEmail);
    const motDePasseValide = validerMotDePasseInscription(inputPassword);
    const telephoneValide = validerTelephoneAlgerien(inputPhone);
    valide = valide && emailValide && motDePasseValide && telephoneValide;

    const experience = Number(inputExp.value || 0);
    if (experience < 0 || experience > 50) {
      afficherErreurChamp(inputExp, "L'expérience doit être comprise entre 0 et 50 ans.");
      valide = false;
    }

    if (!valide) return;

    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    const payload = {
      role: "artisan",
      nom: document.getElementById("artisan-nom").value.trim(),
      prenom: document.getElementById("artisan-prenom").value.trim(),
      email: inputEmail.value.trim(),
      motDePasse: inputPassword.value,
      telephone: inputPhone.value.trim(),
      serviceId: Number(document.getElementById("artisan-service").value),
      ville: document.getElementById("artisan-commune").value,
      experience,
      description: document.getElementById("artisan-description").value.trim()
    };

    try {
      await requeteAPI("/api/auth/register", { method: "POST", body: (()=>{const data=new FormData();Object.entries(payload).forEach(([k,v])=>data.append(k,v));const file=document.getElementById('artisan-document').files[0];if(!file)throw new Error('Diplôme ou certificat obligatoire.');data.append('document',file);data.append('type_document',document.getElementById('artisan-document-type').value);return data;})() });
      afficherToast("Un code de validation vous a été envoyé par e-mail.", "success");
      window.location.href = `/verify-email.html`;
    } catch (error) {
      if (/email/i.test(error.message || "")) afficherErreurChamp(inputEmail, error.message);
      else if (/téléphone|telephone/i.test(error.message || "")) afficherErreurChamp(inputPhone, error.message);
      else if (/mot de passe/i.test(error.message || "")) afficherErreurChamp(inputPassword, error.message);
      else afficherToast(error.message, "error");
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
  initialiserIndicateursAuth();
  initialiserConnexion();
  initialiserInscriptionClient();
  initialiserInscriptionArtisan();
  chargerServicesInscriptionArtisan();
});
