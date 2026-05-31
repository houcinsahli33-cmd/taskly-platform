window.utilisateurCourant = null;
window.tasklyAuthReady = null;

function lienDashboard(role) {
  if (role === "admin") return "/admin-dashboard.html";
  if (role === "artisan") return "/artisan-dashboard.html";
  return "/client-dashboard.html";
}

function construireHeader() {
  const cible = document.getElementById("site-header");
  if (!cible) return;

  const pageActive = document.body.dataset.active || "";
  const utilisateur = window.utilisateurCourant;
  const actions = utilisateur
    ? `
      <a class="btn light" href="${lienDashboard(utilisateur.role)}">Mon espace</a>
      <button class="btn outline small" type="button" data-logout>Déconnexion</button>
    `
    : `
      <a class="btn ghost" href="/login.html">Connexion</a>
      <a class="btn outline" href="/register.html">Inscription</a>
    `;

  cible.innerHTML = `
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="/index.html" aria-label="Accueil Taskly">
          <span class="brand-mark">T</span>
          <span>Taskly</span>
        </a>
        <button class="mobile-menu-btn" type="button" aria-label="Ouvrir le menu" data-menu-toggle>☰</button>
        <nav class="main-nav" aria-label="Navigation principale">
          <a class="${pageActive === "home" ? "active" : ""}" href="/index.html">Accueil</a>
          <a class="${pageActive === "services" ? "active" : ""}" href="/services.html">Services</a>
          <a class="${pageActive === "artisans" ? "active" : ""}" href="/artisans.html">Artisans</a>
          <a class="${pageActive === "about" ? "active" : ""}" href="/about.html">À propos</a>
          <a class="${pageActive === "contact" ? "active" : ""}" href="/contact.html">Contact</a>
        </nav>
        <div class="header-actions">
          ${actions}
          <a class="btn primary" href="/register.html?role=artisan">Devenir artisan</a>
        </div>
      </div>
    </header>
  `;

  cible.querySelector("[data-menu-toggle]")?.addEventListener("click", () => {
    cible.querySelector(".site-header")?.classList.toggle("menu-open");
  });
}

function construireFooter() {
  const cible = document.getElementById("site-footer");
  if (!cible) return;

  cible.innerHTML = `
    <footer class="site-footer">
      <div class="container footer-grid">
        <div>
          <a class="brand footer-brand" href="/index.html">
            <span class="brand-mark">T</span>
            <span>Taskly</span>
          </a>
          <p>Taskly connecte les clients avec des artisans fiables pour les travaux du quotidien, les interventions urgentes et les projets à domicile.</p>
        </div>
        <div>
          <h3>Plateforme</h3>
          <div class="footer-links">
            <a href="/services.html">Services</a>
            <a href="/artisans.html">Artisans</a>
            <a href="/register.html">Créer un compte</a>
            <a href="/register.html?role=artisan">Devenir artisan</a>
          </div>
        </div>
        <div>
          <h3>Services</h3>
          <div class="footer-links">
            <a href="/services.html">Plomberie</a>
            <a href="/services.html">Électricité</a>
            <a href="/services.html">Peinture</a>
            <a href="/services.html">Nettoyage</a>
          </div>
        </div>
        <div>
          <h3>Aide</h3>
          <div class="footer-links">
            <a href="/help.html">Centre d'aide</a>
            <a href="/contact.html">Support</a>
            <a href="mailto:support@taskly.dz">support@taskly.dz</a>
            <a href="/contact.html">Suivre un message</a>
          </div>
        </div>
        <div>
          <h3>Légal</h3>
          <div class="footer-links">
            <a href="/privacy.html">Confidentialité</a>
            <a href="/terms.html">Conditions</a>
            <a href="/about.html">Confiance</a>
            <a href="/contact.html">Signalement</a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="container">© 2026 Taskly. Tous droits réservés.</div>
      </div>
    </footer>
  `;
}

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

async function deconnecterUtilisateur() {
  try {
    await requeteAPI("/api/auth/logout", { method: "POST" });
  } catch (error) {
    afficherToast(error.message, "error");
  } finally {
    window.location.href = "/index.html";
  }
}

async function initialiserTaskly() {
  await chargerUtilisateurConnecte();
  construireHeader();
  construireFooter();
  verifierAccesRole();

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-logout]")) {
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
