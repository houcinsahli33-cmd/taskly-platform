const API_BASE = "";
const DEFAULT_AVATAR = "/images/uploads/avatar.png";

function estFormData(valeur) {
  return typeof FormData !== "undefined" && valeur instanceof FormData;
}

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

  const reponse = await fetch(API_BASE + url, configuration);
  const data = await reponse.json().catch(() => ({}));

  if (!reponse.ok) {
    const erreur = new Error(data.message || "Une erreur est survenue.");
    erreur.status = reponse.status;
    erreur.data = data;
    throw erreur;
  }

  return data;
}

function obtenirParametre(nom) {
  return new URLSearchParams(window.location.search).get(nom);
}

function echapperHTML(valeur) {
  return String(valeur ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normaliserTexte(valeur) {
  return String(valeur || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function imageProfil(chemin) {
  return chemin || DEFAULT_AVATAR;
}

function imageServiceFallback(nom) {
  const cle = normaliserTexte(nom);
  const images = {
    plomberie: "/images/services/plomberie.svg",
    electricite: "/images/services/electricite.svg",
    peinture: "/images/services/peinture.svg",
    menuiserie: "/images/services/menuiserie.svg",
    nettoyage: "/images/services/nettoyage.svg",
    climatisation: "/images/services/climatisation.svg"
  };

  return images[cle] || "/images/services/default.svg";
}

function imageService(service) {
  return service?.image || imageServiceFallback(service?.nom);
}

function gererImageService(img, nom) {
  img.onerror = () => {
    img.onerror = null;
    img.src = imageServiceFallback(nom);
  };
}

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

function badgeStatut(statut) {
  return `<span class="status-pill ${echapperHTML(statut)}">${echapperHTML(libelleStatut(statut))}</span>`;
}

function nomComplet(objet, prefixe = "") {
  const nom = objet?.[`${prefixe}nom`] || objet?.nom || "";
  const prenom = objet?.[`${prefixe}prenom`] || objet?.prenom || "";
  return `${prenom} ${nom}`.trim() || "Utilisateur Taskly";
}

function tronquer(texte, longueur = 130) {
  const valeur = String(texte || "");
  if (valeur.length <= longueur) return valeur;
  return `${valeur.slice(0, longueur).trim()}...`;
}

function afficherAlerte(element, message, type = "success") {
  if (!element) return;
  element.className = `alert show ${type}`;
  element.innerHTML = message;
}

function masquerAlerte(element) {
  if (!element) return;
  element.className = "alert";
  element.innerHTML = "";
}

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

function etatVide(message) {
  return `<div class="empty-state">${echapperHTML(message)}</div>`;
}

function etatChargement(message = "Chargement en cours...") {
  return `<div class="loading-state">${echapperHTML(message)}</div>`;
}

function ouvrirModale(id) {
  const modale = document.getElementById(id);
  if (!modale) return;
  modale.classList.add("show");
  document.body.classList.add("no-scroll");
}

function fermerModale(id) {
  const modale = document.getElementById(id);
  if (!modale) return;
  modale.classList.remove("show");
  document.body.classList.remove("no-scroll");
}

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
