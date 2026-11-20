// Construire une carte artisan
function carteArtisan(artisan) {
  return `
    <article class="card artisan-card">
      <div class="card-body">
        <div class="artisan-top">
          <img class="avatar large" loading="lazy" decoding="async" src="${echapperHTML(imageProfil(artisan.photo_profil))}" alt="${echapperHTML(nomComplet(artisan))}" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}'">
          <div>
            <h3>${echapperHTML(nomComplet(artisan))}</h3>
            <p class="muted taskly-list-service"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6a5 5 0 0 0-6 6L3 17a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4Z"></path></svg> <span>${echapperHTML(artisan.service_nom || "Service")}</span></p>
            <p class="muted taskly-list-location"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0ZM12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"></path></svg> <span>${echapperHTML(artisan.ville || "Commune non précisée")}</span></p>
          </div>
        </div>
        <div class="meta-row">
          <span class="badge primary"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18v16H3zM7 2v6M17 2v6M3 11h18"></path></svg> ${Number(artisan.experience || 0)} an(s) d'expérience</span>
          <span class="badge accent">${Number(artisan.total_avis || 0) > 0 ? echapperHTML(noteArtisan(artisan)) : "Pas encore d’avis"}</span>
          <span class="badge"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18v14H3zM8 7V3h8v4M3 13h18"></path></svg> ${Number(artisan.total_demandes || 0)} demande(s)</span>
        </div>
        <div class="taskly-list-description"><span aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6a5 5 0 0 0-6 6L3 17a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4Z"></path></svg></span><p class="muted artisan-description">${echapperHTML(artisan.description || "Aucune description renseignée.")}</p></div>
        <div class="request-actions">
          <a class="btn outline" href="/artisan-profile.html?id=${artisan.id}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a7 7 0 0 0-14 0v2M13 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"></path></svg> <span>Voir le profil</span></a>
          ${window.utilisateurCourant?.role === "client" ? `<button class="btn primary" type="button" data-open-request="${artisan.id}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"></path></svg> <span>Envoyer une demande</span></button>` : ""}
        </div>
      </div>
    </article>
  `;
}

// La page ne conserve qu'une page de profils par requête, mais permet de
// parcourir tous les résultats approuvés sans plafond artificiel à 6 profils.
const TAILLE_PAGE_ARTISANS = 6;
let artisansCharges = [];
let pageArtisans = 0;
let totalArtisans = 0;
let chargementPageArtisans = false;
let versionRechercheArtisans = 0;

function obtenirBoutonAfficherPlusArtisans() {
  const grille = document.getElementById('artisans-grid');
  if (!grille) return null;
  let bouton = document.getElementById('load-more-artisans');
  if (!bouton) {
    const conteneur = document.createElement('div');
    conteneur.className = 'load-more-artisans-wrap';
    conteneur.hidden = true;
    conteneur.innerHTML = `
      <button class="btn load-more-artisans-btn" id="load-more-artisans" type="button">
        Afficher plus
      </button>
      <p class="artisans-results-count" id="artisans-results-count" role="status" aria-live="polite"></p>`;
    grille.insertAdjacentElement('afterend', conteneur);
    bouton = conteneur.querySelector('button');
    bouton.addEventListener('click', () => chargerPageArtisans());
  }
  return bouton;
}

function mettreAJourCompteurArtisans() {
  const bouton = obtenirBoutonAfficherPlusArtisans();
  if (!bouton) return;
  const conteneur = bouton.closest('.load-more-artisans-wrap');
  const compteur = document.getElementById('artisans-results-count');
  const vus = artisansCharges.length;
  const totalListe = document.getElementById("taskly-list-total");
  if (totalListe) totalListe.textContent = chargementPageArtisans && !pageArtisans ? "Recherche des artisans…" : pageArtisans > 0 ? `${totalArtisans} artisan${totalArtisans === 1 ? "" : "s"} trouvé${totalArtisans === 1 ? "" : "s"}` : "";
  compteur.innerHTML = `<strong>${vus}</strong> artisan${vus > 1 ? 's' : ''} affiché${vus > 1 ? 's' : ''} sur <strong>${totalArtisans}</strong> résultat${totalArtisans > 1 ? 's' : ''}`;
  conteneur.hidden = totalArtisans === 0;
  bouton.hidden = vus >= totalArtisans;
  bouton.disabled = chargementPageArtisans;
  bouton.textContent = chargementPageArtisans ? 'Chargement…' : 'Afficher plus';
}

async function chargerPageArtisans() {
  if (chargementPageArtisans) return;
  const grille = document.getElementById('artisans-grid');
  if (!grille) return;
  const version = versionRechercheArtisans;
  const prochainePage = pageArtisans + 1;
  chargementPageArtisans = true;
  mettreAJourCompteurArtisans();
  try {
    const params = new URLSearchParams(construireQueryArtisans());
    params.set('page', prochainePage);
    params.set('limit', TAILLE_PAGE_ARTISANS);
    const resultat = await requeteAPI(`/api/artisans?${params}`);
    if (version !== versionRechercheArtisans) return;
    const nouveaux = Array.isArray(resultat.artisans) ? resultat.artisans : [];
    artisansCharges.push(...nouveaux);
    pageArtisans = prochainePage;
    totalArtisans = Number(resultat.total || 0);
    if (pageArtisans === 1 && !nouveaux.length) {
      grille.innerHTML = etatVideDeuxLignes(
        'Aucun artisan ne correspond à vos critères.',
        'Essayez de changer le service, la wilaya ou la recherche.'
      );
    } else {
      grille.insertAdjacentHTML('beforeend', nouveaux.map(carteArtisan).join(''));
    }
  } catch (error) {
    if (version !== versionRechercheArtisans) return;
    if (!artisansCharges.length) grille.innerHTML = etatVide(error.message);
    else afficherToast('Impossible de charger la suite : ' + error.message, 'error');
  } finally {
    if (version === versionRechercheArtisans) {
      chargementPageArtisans = false;
      mettreAJourCompteurArtisans();
    }
  }
}

// Charger les services pour les filtres
async function chargerFiltresArtisans() {
  const serviceSelect = document.getElementById("filter-service");
  if (!serviceSelect) return;

  try {
    const { services } = await requeteAPI("/api/services");
    serviceSelect.innerHTML = `<option value="">Tous les services</option>` + services
      .map((service) => `<option value="${service.id}">${echapperHTML(service.nom)}</option>`)
      .join("");

    const serviceId = obtenirParametre("serviceId");
    if (serviceId) serviceSelect.value = serviceId;
  } catch (error) {
    afficherToast(error.message, "error");
  }
}

// Remplir les filtres de localisation
function initialiserLocalisationArtisans() {
  const wilaya = document.getElementById("filter-wilaya");
  if (typeof remplirWilayas === "function") {
    remplirWilayas(wilaya);
  }
}

// Construire les parametres de recherche artisans
function construireQueryArtisans() {
  const params = new URLSearchParams();
  const serviceId = document.getElementById("filter-service")?.value;
  const wilaya = document.getElementById("filter-wilaya")?.value;
  const recherche = document.getElementById("filter-search")?.value.trim();

  if (serviceId) params.set("serviceId", serviceId);
  if (wilaya) params.set("wilaya", wilaya);
  if (recherche) params.set("recherche", recherche);
  return params.toString();
}

// Relancer la recherche avec la première page et ignorer les réponses obsolètes.
function chargerArtisans() {
  const grille = document.getElementById('artisans-grid');
  if (!grille) return;
  versionRechercheArtisans += 1;
  artisansCharges = [];
  pageArtisans = 0;
  totalArtisans = 0;
  chargementPageArtisans = false;
  grille.innerHTML = etatChargement('Chargement des artisans...');
  const bouton = obtenirBoutonAfficherPlusArtisans();
  if (bouton) bouton.closest('.load-more-artisans-wrap').hidden = true;
  // Efface uniquement le message de chargement avant l'insertion de cartes.
  grille.innerHTML = '';
  return chargerPageArtisans();
}

// Initialiser les filtres de la page artisans
function initialiserFiltresArtisans() {
  const form = document.getElementById("artisans-filter-form");
  if (!form) return;

  const recherche = obtenirParametre("recherche");
  if (recherche) document.getElementById("filter-search").value = recherche;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    chargerArtisans();
  });

  document.getElementById("reset-filters")?.addEventListener("click", () => {
    form.reset();
    chargerArtisans();
  });
}

// Le bouton « Nouvelle demande » mène au parcours EXISTANT :
// choisir un artisan, puis utiliser le vrai formulaire de l'annuaire.
function afficherGuideNouvelleDemande() {
  if (obtenirParametre('nouvelleDemande') !== '1') return;
  const formulaire = document.getElementById('artisans-filter-form');
  if (!formulaire) return;
  const guide = document.createElement('p');
  guide.className = 'alert show success';
  guide.setAttribute('role', 'status');
  guide.textContent = 'Nouvelle demande : choisissez un artisan, puis cliquez sur « Envoyer une demande » pour décrire votre projet.';
  formulaire.insertAdjacentElement('beforebegin', guide);
}

// Ouvrir la modale de demande
let demandeOuvertureEnCours=false;
async function ouvrirDemandeArtisan(id) {
  if (!window.utilisateurCourant) {
    window.location.href = `/login.html?redirect=${encodeURIComponent(`/artisan-profile.html?id=${id}`)}`;
    return;
  }

  if (window.utilisateurCourant.role !== "client") {
    afficherToast("Seuls les clients peuvent envoyer une demande.", "error");
    return;
  }

  if(demandeOuvertureEnCours)return;
  demandeOuvertureEnCours=true;
  try {
    const { artisan } = await requeteAPI(`/api/artisans/${encodeURIComponent(id)}`);
    if(!artisan||Number(artisan.id)!==Number(id))throw new Error("Artisan introuvable.");
    window.tasklyRequestWizard.open(artisan);
  } catch (error) {
    afficherToast(error.message, "error");
  } finally {demandeOuvertureEnCours=false;}
}

// Envoyer la demande au backend
function initialiserDemandeArtisan() {
  document.addEventListener("click", (event) => {
    const bouton = event.target.closest("[data-open-request]");
    if (bouton) {
      ouvrirDemandeArtisan(bouton.dataset.openRequest);
    }
  });

  window.tasklyRequestWizard?.init();
}

// Charger le profil public d'un artisan
async function chargerProfilArtisan() {
  const cible = document.getElementById("artisan-profile");
  const avisCible = document.getElementById("artisan-reviews");
  if (!cible || !avisCible) return;
  const contact = document.getElementById("taskly-contact-open");
  const reserve = document.getElementById("taskly-pp-contact-reserve");
  const compteur = document.getElementById("taskly-pp-review-count");
  if (contact && reserve) reserve.append(contact);
  if (compteur) compteur.hidden = true;
  const id = obtenirParametre("id");
  if (!id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    cible.innerHTML = etatVide("Artisan introuvable.");
    avisCible.innerHTML = "";
    return;
  }
  const pictos = {
    pin:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M7 3v4M17 3v4M3 10h18"></path>',
    star:'<path d="m12 3 2.8 5.9 6.5.9-4.7 4.6 1.1 6.5-5.7-3.1-5.7 3.1 1.1-6.5L2.7 9.8l6.5-.9z"></path>',
    chat:'<path d="M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z"></path>',
    tool:'<path d="M14 6a5 5 0 0 0-6 6L3 17a2.8 2.8 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4z"></path>',
    bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7z"></path>',
    document:'<rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M8 8h8M8 12h8M8 16h5"></path>',
    send:'<path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"></path>',
    phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2A18 18 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3l2 5-3 2a15 15 0 0 0 9 9l2-3z"></path>',
    info:'<circle cx="12" cy="12" r="9"></circle><path d="M12 11v6M12 7h.01"></path>'
  };
  const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${pictos[n]}</svg>`;
  cible.innerHTML = etatChargement("Chargement du profil...");
  avisCible.innerHTML = etatChargement("Chargement des avis...");
  try {
    const [{ artisan }, avisData] = await Promise.all([
      requeteAPI(`/api/artisans/${encodeURIComponent(id)}`),
      requeteAPI(`/api/avis/artisan/${encodeURIComponent(id)}`).catch(() => null)
    ]);
    if (!artisan || Number(artisan.id) !== Number(id)) throw Error("Artisan introuvable.");
    const count = avisData?.statistiques?.total_avis ?? artisan.total_avis;
    const total = count !== null && count !== undefined && Number.isSafeInteger(Number(count)) && Number(count)>=0 ? Number(count) : null;
    const rawRating = avisData?.statistiques?.moyenne_note ?? artisan.moyenne_notes;
    const moyenne = Number(rawRating);
    const note = total > 0 && rawRating != null && moyenne >= 1 && moyenne <= 5 ? formatNombre(moyenne) + " / 5" : "Pas encore noté";
    const countLabel = total === null ? "Avis non renseignés" : `${total} avis`;
    const experience = artisan.experience != null && Number.isFinite(Number(artisan.experience)) && Number(artisan.experience)>=0 ? `${Number(artisan.experience)} an(s) d'expérience` : "Expérience non renseignée";
    const metier = String(artisan.service_nom || "Service");
    const symbol = /électri|electri/i.test(metier) ? 'bolt' : 'tool';
    cible.innerHTML = `
      <div class="profile-hero taskly-pp-hero">
        <img class="avatar large" src="${echapperHTML(imageProfil(artisan.photo_profil))}" alt="${echapperHTML(nomComplet(artisan))}" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}'">
        <div class="taskly-pp-identity">
          <h1>${echapperHTML(nomComplet(artisan))}</h1>
          <p class="taskly-pp-service"><span>${icon(symbol)}</span>${echapperHTML(metier)}</p>
          <div class="taskly-pp-meta"><span>${icon('pin')}${echapperHTML(artisan.ville || "Commune non renseignée")}</span><span>${icon('calendar')}${echapperHTML(experience)}</span><span class="taskly-pp-note">${icon('star')}${echapperHTML(note)}</span><span>${icon('chat')}${countLabel}</span></div>
        </div>
        <div class="taskly-pp-art" aria-hidden="true">${icon(symbol)}<i></i><b></b></div>
      </div>
      <div class="taskly-pp-columns">
        <section class="taskly-pp-card taskly-pp-about"><h2><span>${icon('document')}</span>À propos de l'artisan</h2><p>${echapperHTML(artisan.description || "Cet artisan n'a pas encore ajouté de description détaillée.")}</p></section>
        <section class="taskly-pp-card taskly-pp-contact"><h2><span>${icon('send')}</span>Contacter cet artisan</h2>
          ${window.utilisateurCourant?.role === "client" ? `<button class="btn primary" type="button" data-open-request="${Number(id)}">${icon('send')} Envoyer une demande</button>` : `<a class="btn outline" href="/login.html">Se connecter pour demander</a>`}
          <div id="taskly-pp-contact-slot"></div>
          <div class="taskly-pp-tip">${icon('info')}<p>Seules les coordonnées autorisées par l'artisan sont accessibles aux clients connectés.</p></div>
        </section>
      </div>`;
    if (contact) {
      document.getElementById('taskly-pp-contact-slot').append(contact);
      if (!contact.querySelector('svg')) contact.insertAdjacentHTML('afterbegin',icon('phone'));
    }
    if (compteur) { compteur.textContent = countLabel; compteur.hidden = false; }
    if (!Array.isArray(avisData?.avis)) {
      avisCible.innerHTML = `<div class="taskly-pp-empty">${icon('info')}<strong>Avis temporairement indisponibles</strong><p>Réessayez en actualisant la page.</p></div>`;
      return;
    }
    if (!avisData.avis.length) {
      avisCible.innerHTML = `<div class="taskly-pp-empty">${icon('star')}<strong>Aucun avis pour le moment</strong><p>Les avis des clients apparaîtront ici lorsqu'ils seront publiés.</p></div>`;
      return;
    }
    avisCible.innerHTML = avisData.avis.map((avis) => {
      const nomClient = nomComplet(avis, "client_");
      const initiale = nomClient.trim().charAt(0).toUpperCase() || "C";
      return `<article class="profile-testimonial-card">
        <div class="profile-testimonial-header"><div class="profile-testimonial-avatar">${echapperHTML(initiale)}</div><div><h3>${echapperHTML(nomClient)}</h3><p>Client Taskly</p></div></div>
        <div class="profile-testimonial-stars">${afficherEtoiles(avis.note)}</div>
        <p class="profile-testimonial-text">“${echapperHTML(avis.commentaire || "Avis sans commentaire.")}”</p>
        <div class="profile-testimonial-footer"><span class="profile-testimonial-tag">${echapperHTML(metier)}</span><span class="profile-testimonial-date">${echapperHTML(formatDate(avis.created_at))}</span></div>
      </article>`;
    }).join("");
  } catch (error) {
    if (contact && reserve) reserve.append(contact);
    if (compteur) compteur.hidden = true;
    cible.innerHTML = etatVide(error.message);
    avisCible.innerHTML = "";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await attendreSession();
  initialiserLocalisationArtisans();
  await chargerFiltresArtisans();
  initialiserFiltresArtisans();
  initialiserDemandeArtisan();
  afficherGuideNouvelleDemande();
  chargerArtisans();
  chargerProfilArtisan();
});
