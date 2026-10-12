const API_BASE = "";
const DEFAULT_AVATAR = "/images/defaults/avatar.png";

// Verifier si le corps est un FormData
function estFormData(valeur) {
  return typeof FormData !== "undefined" && valeur instanceof FormData;
}

let csrfEnCours=null;
async function obtenirCsrf(renouveler=false) {
  if (renouveler) csrfEnCours=null;
  if (!csrfEnCours) csrfEnCours=fetch('/api/auth/csrf',{credentials:'include'})
    .then(async r=>{if(!r.ok) throw new Error('Impossible de recuperer le jeton de securite.');return (await r.json()).csrfToken;})
    .catch(e=>{csrfEnCours=null;throw e;});
  return csrfEnCours;
}
function reinitialiserCsrf() {csrfEnCours=null;}
// Envoyer une requete API
async function requeteAPI(url, options = {}) {
  const configuration = {
    credentials: "include",
    ...options
  };

  if (!estFormData(configuration.body)) {
    configuration.headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
  } else {
    configuration.headers = options.headers || {};
  }

  const mutation = !['GET','HEAD','OPTIONS'].includes((configuration.method||'GET').toUpperCase());
  if(mutation) configuration.headers['X-CSRF-Token']=await obtenirCsrf();
  let reponse = await fetch(API_BASE + url, configuration);
  if(mutation && reponse.status===403) {
    const erreurPrecedente=await reponse.clone().json().catch(()=>({}));
    if(erreurPrecedente.message?.includes('Jeton de securite')) {
      configuration.headers['X-CSRF-Token']=await obtenirCsrf(true);
      reponse=await fetch(API_BASE + url, configuration);
    }
  }
  const data = await reponse.json().catch(() => ({}));

  if (!reponse.ok) {
    const erreur = new Error(data.message || "Une erreur est survenue.");
    erreur.status = reponse.status;
    erreur.data = data;
    throw erreur;
  }

  if (url==='/api/auth/verify-email' || url==='/api/auth/login' || /\/auth\/(login|verify)$/.test(url) || url==='/api/auth/logout') reinitialiserCsrf();
  return data;
}

// Lire un parametre dans l'URL
function obtenirParametre(nom) {
  return new URLSearchParams(window.location.search).get(nom);
}

// Echaper le HTML injecte dans les templates
function echapperHTML(valeur) {
  return String(valeur ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Normaliser un texte pour la recherche
function normaliserTexte(valeur) {
  return String(valeur || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Retourner une image de profil valide
function imageProfil(chemin) {
  return chemin || DEFAULT_AVATAR;
}

// Choisir une image par defaut pour un service
function imageServiceFallback(nom) {
  const cle = normaliserTexte(nom);
  const images = {
    plomberie: "/images/services/plomberie.jpg",
    electricite: "/images/services/electricite.jpg",
    peinture: "/images/services/peinture.jpg",
    menuiserie: "/images/services/menuiserie.jpg",
    nettoyage: "/images/services/nettoyage.jpg",
    climatisation: "/images/services/climatisation.jpg",
    jardinage: "/images/services/jardinage.jpg",
    demenagement: "/images/services/demenagement.jpg",
    electromenager: "/images/services/electromenager.jpg",
    carrelage: "/images/services/carrelage.jpg",
    maconnerie: "/images/services/maconnerie.jpg",
    serrurerie: "/images/services/serrurerie.jpg"
  };

  return images[cle] || "/images/services/default.jpg";
}

// Choisir l'image affichee pour un service
function imageService(service) {
  if (service?.image && !service.image.endsWith(".svg")) {
    return service.image;
  }

  return imageServiceFallback(service?.nom);
}

// Remplacer une image de service cassee
function gererImageService(img, nom) {
  img.onerror = () => {
    img.onerror = null;
    img.src = imageServiceFallback(nom);
  };
}

// Formater une date courte
function formatDate(valeur) {
  if (!valeur) return "Non précisée";
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return "Non précisée";
  return date.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

// Formater une date avec l'heure
function formatDateHeure(valeur) {
  if (!valeur) return "Non précisée";
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return "Non précisée";
  return date.toLocaleString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Formater un nombre d'avis ou de notes
function formatNombre(valeur) {
  const nombre = Number(valeur || 0);
  return Number.isInteger(nombre) ? String(nombre) : nombre.toFixed(1);
}

// Convertir un statut technique en libelle
function libelleStatut(statut) {
  const libelles = {
    en_attente: "En attente",
    acceptee: "Acceptée",
    refusee: "Refusée",
    annulee: "Annulée",
    terminee: "Terminée",
    nouveau: "Nouveau",
    traite: "Traité",
    actif: "Actif",
    bloque: "Bloqué"
  };
  return libelles[statut] || statut || "Inconnu";
}

// Construire un badge de statut
function badgeStatut(statut) {
  return `<span class="status-pill ${echapperHTML(statut)}">${echapperHTML(libelleStatut(statut))}</span>`;
}

// Construire le nom complet d'un utilisateur
function nomComplet(objet, prefixe = "") {
  const nom = objet?.[`${prefixe}nom`] || objet?.nom || "";
  const prenom = objet?.[`${prefixe}prenom`] || objet?.prenom || "";
  return `${prenom} ${nom}`.trim() || "Utilisateur Taskly";
}

// Raccourcir un texte long
function tronquer(texte, longueur = 130) {
  const valeur = String(texte || "");
  if (valeur.length <= longueur) return valeur;
  return `${valeur.slice(0, longueur).trim()}...`;
}

// Afficher les etoiles d'une note
function afficherEtoiles(note) {
  const valeur = Math.round(Number(note || 0));
  if (!valeur) return "Nouveau";
  return "★".repeat(valeur) + "☆".repeat(5 - valeur);
}

// Construire le resume de note d'un artisan
function noteArtisan(artisan) {
  const note = artisan.moyenne_notes || artisan.moyenne_note || 0;
  const total = artisan.total_avis || 0;

  if (!Number(note) || !Number(total)) {
    return "Nouveau profil";
  }

  return `${formatNombre(note)}/5 · ${total} avis`;
}

// Afficher une alerte dans un bloc
function afficherAlerte(element, message, type = "success") {
  if (!element) return;
  element.className = `alert show ${type}`;
  element.textContent = message;
}

// Masquer une alerte
function masquerAlerte(element) {
  if (!element) return;
  element.className = "alert";
  element.innerHTML = "";
}

// Afficher une notification courte
function afficherToast(message, type = "success") {
  let conteneur = document.querySelector(".toast-container");
  if (!conteneur) {
    conteneur = document.createElement("div");
    conteneur.className = "toast-container";
    document.body.appendChild(conteneur);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  conteneur.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 4200);
}

// Afficher un etat vide
function etatVide(message) {
  return `<div class="empty-state">${echapperHTML(message)}</div>`;
}

// Afficher un etat vide avec titre et texte
function etatVideDeuxLignes(titre, texte) {
  return `
    <div class="empty-state">
      <strong>${echapperHTML(titre)}</strong><br>
      <span>${echapperHTML(texte)}</span>
    </div>
  `;
}

// Afficher un etat de chargement
function etatChargement(message = "Chargement en cours...") {
  return `<div class="loading-state">${echapperHTML(message)}</div>`;
}

// Ouvrir une modale
function ouvrirModale(id) {
  const modale = document.getElementById(id);
  if (!modale) return;
  modale.classList.add("show");
  document.body.classList.add("no-scroll");
}

// Fermer une modale
function fermerModale(id) {
  const modale = document.getElementById(id);
  if (!modale) return;
  modale.classList.remove("show");
  document.body.classList.remove("no-scroll");
}

// Fermer les modales depuis les boutons ou le fond
document.addEventListener("click", (event) => {
  const boutonFermeture = event.target.closest("[data-close-modal]");
  if (boutonFermeture) {
    fermerModale(boutonFermeture.dataset.closeModal);
  }

  if (event.target.classList.contains("modal-backdrop")) {
    event.target.classList.remove("show");
    document.body.classList.remove("no-scroll");
  }
});

/* Champs mot de passe : bouton oeil accessible, y compris dans les fenetres creees apres chargement. */
(function installerVisibiliteMotsDePasse() {
  'use strict';
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  const STYLE_ID = 'taskly-password-eye-style';
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  function installerStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style'); style.id = STYLE_ID;
    style.textContent = '.taskly-password-eye-wrap{position:relative;display:block;width:100%;min-width:0}' +
      '.taskly-password-eye-wrap>input{width:100%;box-sizing:border-box;padding-right:48px!important}' +
      '.taskly-password-eye-button{position:absolute;right:7px;top:50%;transform:translateY(-50%);' +
      'width:34px;height:34px;padding:7px;display:grid;place-items:center;background:transparent;border:0;border-radius:8px;' +
      'color:#43675d;cursor:pointer;z-index:1}' +
      '.taskly-password-eye-button:hover{background:#eaf5ef}' +
      '.taskly-password-eye-button:focus-visible{outline:2px solid #087f63;outline-offset:2px}' +
      '.taskly-password-eye-button svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round}' +
      '.taskly-password-eye-button[aria-pressed=true]{color:#087f63}';
    (document.head || document.documentElement).append(style);
  }
  function ajouterChamp(input) {
    if (input.dataset.tasklyPasswordManaged) return;
    if (input.type !== 'password') return;
    input.dataset.tasklyPasswordManaged = '1';
    // Les formulaires de connexion/inscription qui ont deja un oeil restent inchanges.
    if (input.parentElement?.querySelector('[data-password-toggle],.taskly-eye,.admin-private-toggle')) return;
    installerStyles();
    const wrap = document.createElement('span');wrap.className='taskly-password-eye-wrap';
    input.parentNode.insertBefore(wrap,input);wrap.append(input);
    const button = document.createElement('button');button.type='button';button.className='taskly-password-eye-button';
    button.setAttribute('aria-label','Afficher le mot de passe');button.setAttribute('aria-pressed','false');
    button.innerHTML=icon;
    button.addEventListener('click', () => {
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      button.setAttribute('aria-label', visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      button.setAttribute('aria-pressed',String(visible));
      input.focus({preventScroll:true});
    });
    wrap.append(button);
  }
  function inspecter(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.matches?.('input[type="password"]')) ajouterChamp(node);
    node.querySelectorAll?.('input[type="password"]:not([data-taskly-password-managed])').forEach(ajouterChamp);
  }
  function pret() {
    inspecter(document.body);
    const observer=new MutationObserver(records => {
      for (const record of records) for(const node of record.addedNodes) inspecter(node);
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',pret,{once:true});
  else pret();
})();
