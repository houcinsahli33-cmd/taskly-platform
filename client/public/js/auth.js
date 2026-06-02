window.utilisateurCourant = null;
window.tasklyAuthReady = null;

function lienDashboard(role) {
  if (role === "admin") return "/admin-dashboard.html";
  if (role === "artisan") return "/artisan-dashboard.html";
  return "/client-dashboard.html";
}

function logoTaskly() {
  return `<img src="/images/taskly-logo.svg" alt="Taskly">`;
}

// Construire le header public ou connecte
function construireHeader() {
  const cible = document.getElementById("site-header");
  if (!cible) return;

  const pageActive = document.body.dataset.active || "";
  const utilisateur = window.utilisateurCourant;
  const estDashboard = document.body.classList.contains("dashboard-page");

  const navigationPublique = `
    <nav class="main-nav" aria-label="Navigation principale">
      <a class="${pageActive === "home" ? "active" : ""}" href="/index.html">Accueil</a>
      <a class="${pageActive === "services" ? "active" : ""}" href="/services.html">Services</a>
      <a class="${pageActive === "artisans" ? "active" : ""}" href="/artisans.html">Artisans</a>
      <a class="${pageActive === "about" ? "active" : ""}" href="/about.html">À propos</a>
    </nav>
  `;

  const actionsPubliques = `
    <a class="btn outline" href="/login.html">Connexion / Inscription</a>
    <a class="btn primary" href="/become-artisan.html">Devenir artisan</a>
  `;

  const actionsConnectees = utilisateur ? `
    ${estDashboard ? "" : `<a class="btn outline small" href="${lienDashboard(utilisateur.role)}">Mon espace</a>`}
    <span class="header-profile"><img src="${echapperHTML(imageProfil(utilisateur.photo_profil))}" alt="Photo de profil" onerror="this.src='${DEFAULT_AVATAR}'"></span>
    <button class="btn outline small" type="button" data-logout>Déconnexion</button>
  ` : "";

  cible.innerHTML = `
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="/index.html" aria-label="Accueil Taskly">${logoTaskly()}</a>
        <button class="mobile-menu-btn" type="button" aria-label="Ouvrir le menu" data-menu-toggle>☰</button>
        ${estDashboard ? `<nav class="main-nav" aria-label="Navigation secondaire"><a href="/index.html">Retour au site</a></nav>` : navigationPublique}
        <div class="header-actions">
          ${utilisateur ? actionsConnectees : actionsPubliques}
        </div>
      </div>
    </header>
  `;

  cible.querySelector("[data-menu-toggle]")?.addEventListener("click", () => {
    cible.querySelector(".site-header")?.classList.toggle("menu-open");
  });
}

// Construire le footer global
function construireFooter() {
  const cible = document.getElementById("site-footer");
  if (!cible) return;

  cible.innerHTML = `
    <footer class="site-footer">
      <div class="container footer-grid">
        <div>
          <a class="brand footer-brand" href="/index.html">${logoTaskly()}</a>
          <p>Taskly connecte les clients avec des artisans fiables pour les travaux du quotidien, les interventions urgentes et les projets à domicile.</p>
        </div>
        <div>
          <h3>Plateforme</h3>
          <div class="footer-links">
            <a href="/services.html">Services</a>
            <a href="/artisans.html">Artisans</a>
            <a href="/login.html">Créer un compte</a>
            <a href="/become-artisan.html">Devenir artisan</a>
          </div>
        </div>
        <div>
          <h3>Aide</h3>
          <div class="footer-links">
            <a href="/help.html">Centre d'aide</a>
            <a href="/contact.html">Support</a>
            <a href="/contact.html#suivi-message">Suivre un message</a>
            <a href="mailto:support@taskly.dz">support@taskly.dz</a>
          </div>
        </div>
        <div>
          <h3>Légal</h3>
          <div class="footer-links">
            <a href="/privacy.html">Confidentialité</a>
            <a href="/terms.html">Conditions</a>
            <a href="/about.html">À propos</a>
          </div>
        </div>
        <div>
          <h3>Nous suivre</h3>
          <div class="social-links" aria-label="Réseaux sociaux">
            <a href="#" aria-label="Facebook">
              <img src="/images/icons/facebook.png" alt="">
              <span>Facebook</span>
            </a>

            <a href="#" aria-label="Instagram">
              <img src="/images/icons/instagram.png" alt="">
              <span>Instagram</span>
            </a>

            <a href="#" aria-label="X / Twitter">
              <img src="/images/icons/twitter.png" alt="">
              <span>Twitter</span>
            </a>

            <a href="#" aria-label="LinkedIn">
              <img src="/images/icons/linkedin.png" alt="">
              <span>LinkedIn</span>
            </a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="container">© 2026 Taskly. Tous droits réservés.</div>
      </div>
    </footer>
  `;
}

// Charger la session de l'utilisateur
async function chargerUtilisateurConnecte() {
  try {
    const data = await requeteAPI("/api/auth/me");
    window.utilisateurCourant = data.utilisateur;
  } catch (error) {
    window.utilisateurCourant = null;
  }

  return window.utilisateurCourant;
}

function redirigerSelonRole(utilisateur) {
  window.location.href = lienDashboard(utilisateur.role);
}

// Verifier que le role a le droit d'ouvrir la page
function verifierAccesRole() {
  const roleRequis = document.body.dataset.requireRole;
  if (!roleRequis) return;

  const utilisateur = window.utilisateurCourant;
  if (!utilisateur) {
    const retour = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login.html?redirect=${retour}`;
    return;
  }

  if (utilisateur.role !== roleRequis) {
    window.location.href = lienDashboard(utilisateur.role);
  }
}

// Afficher la modale de deconnexion
function afficherModaleDeconnexion() {
  if (!document.getElementById("logout-modal")) {
    const modale = document.createElement("div");
    modale.id = "logout-modal";
    modale.className = "modal-backdrop";
    modale.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2>Déconnexion</h2>
          <button class="modal-close" type="button" data-close-modal="logout-modal">×</button>
        </div>
        <div class="modal-body">
          <p>Voulez-vous vraiment vous déconnecter ?</p>
          <div class="request-actions" style="margin-top:22px;justify-content:flex-end">
            <button class="btn outline" type="button" data-close-modal="logout-modal">Annuler</button>
            <button class="btn primary" type="button" data-confirm-logout>Se déconnecter</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modale);
  }

  ouvrirModale("logout-modal");
}

// Deconnecter seulement apres confirmation
async function deconnecterUtilisateur() {
  try {
    await requeteAPI("/api/auth/logout", { method: "POST" });
  } catch (error) {
    afficherToast(error.message, "error");
  } finally {
    window.location.href = "/index.html";
  }
}

// Initialiser le header, footer et la session
async function initialiserTaskly() {
  await chargerUtilisateurConnecte();
  construireHeader();
  construireFooter();
  verifierAccesRole();

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-logout]")) {
      afficherModaleDeconnexion();
    }

    if (event.target.closest("[data-confirm-logout]")) {
      deconnecterUtilisateur();
    }
  });

  document.dispatchEvent(new CustomEvent("taskly:auth-ready", {
    detail: { utilisateur: window.utilisateurCourant }
  }));

  return window.utilisateurCourant;
}

document.addEventListener("DOMContentLoaded", () => {
  window.tasklyAuthReady = initialiserTaskly();
});

function attendreSession() {
  return window.tasklyAuthReady || Promise.resolve(window.utilisateurCourant);
}
