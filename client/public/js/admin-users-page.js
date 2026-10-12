/* Page Utilisateurs uniquement : la navigation et les autres rubriques admin ne sont pas modifiées. */
(() => {
  'use strict';
  const etat = {page: 1, limite: 10, recherche: '', statut: 'tous', role: 'tous', tri: 'recent'};
  let numeroRequete = 0;
  let minuterieRecherche;

  const element = (id) => document.getElementById(id);
  const nombre = (valeur) => Number.isFinite(Number(valeur)) ? Number(valeur) : 0;

  function initiales(utilisateur) {
    const nom = String(utilisateur.nom || '').trim();
    const prenom = String(utilisateur.prenom || '').trim();
    return echapperHTML((prenom[0] || nom[0] || '?').toUpperCase() + (nom[0] && prenom[0] ? nom[0].toUpperCase() : ''));
  }

  function informationsSupplementaires(utilisateur) {
    const libelles = [];
    if (utilisateur.role === 'artisan' && utilisateur.verification_statut === 'en_attente') {
      libelles.push('<span class="admin-users-inline-tag pending">Dossier non traité</span>');
    }
    const date = new Date(utilisateur.created_at);
    if (!Number.isNaN(date.getTime()) && date.getTime() <= Date.now() && date.getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000) {
      libelles.push('<span class="admin-users-inline-tag new">Nouveau</span>');
    }
    if (utilisateur.motif_blocage) {
      libelles.push(`<span class="admin-users-reason" title="Motif du blocage">${echapperHTML(tronquer(utilisateur.motif_blocage, 80))}</span>`);
    }
    return libelles.join(' ');
  }

  function actionsPour(utilisateur) {
    const id = echapperHTML(utilisateur.id);
    if (utilisateur.role === 'admin') return '<span class="admin-users-protected">Protégé</span>';
    if (utilisateur.role === 'artisan') {
      return `<button type="button" class="btn small outline admin-users-action" data-examine-user="${id}">Examiner le dossier</button>`;
    }
    return utilisateur.statut_compte === 'bloque'
      ? `<button type="button" class="btn small outline admin-users-action" data-unblock-user="${id}">Débloquer</button>`
      : `<button type="button" class="btn small danger admin-users-action" data-open-block="${id}">Bloquer</button>`;
  }

  function ligneUtilisateur(utilisateur) {
    const nom = echapperHTML(nomComplet(utilisateur));
    const role = String(utilisateur.role || '').toLowerCase();
    const roleIcone = role === 'artisan' ? '⚒' : role === 'admin' ? '♛' : '♙';
    const couleur = role === 'admin' ? 'admin' : role === 'client' ? 'client' : 'artisan';
    const statut = utilisateur.statut_compte === 'bloque' ? 'bloque'
      : utilisateur.role === 'artisan' && utilisateur.verification_statut === 'en_attente' ? 'non_traite' : 'actif';
    return `<tr>
      <td><div class="admin-users-person"><span class="admin-users-avatar ${couleur}" aria-hidden="true">${initiales(utilisateur)}</span><span class="admin-users-person-text"><strong>${nom}</strong>${informationsSupplementaires(utilisateur)}</span></div></td>
      <td class="admin-users-email">${echapperHTML(utilisateur.email || '—')}</td>
      <td><span class="admin-users-role"><span aria-hidden="true">${roleIcone}</span> ${echapperHTML(role || '—')}</span></td>
      <td><span class="admin-users-account-status ${statut}"><span class="admin-users-status-dot" aria-hidden="true"></span>${statut === 'bloque' ? 'Bloqué' : statut === 'non_traite' ? 'Non traité' : 'Actif'}</span></td>
      <td class="admin-users-date">${echapperHTML(formatDate(utilisateur.created_at))}</td>
      <td>${actionsPour(utilisateur)}</td>
    </tr>`;
  }

  function tableUtilisateurs(utilisateurs) {
    if (!utilisateurs.length) {
      return `<div class="admin-users-empty"><strong>Aucun utilisateur trouvé.</strong><p>Essayez d’autres critères de recherche ou de filtrage.</p><button type="button" id="admin-users-reset" class="btn small outline">Effacer les filtres</button></div>`;
    }
    return `<div class="table-wrap admin-users-table-wrap"><table class="admin-users-table">
      <thead><tr><th>Utilisateur</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Inscription</th><th>Actions</th></tr></thead>
      <tbody>${utilisateurs.map(ligneUtilisateur).join('')}</tbody>
    </table></div>`;
  }

  function majBoutonsFiltres() {
    document.querySelectorAll('[data-users-status]').forEach((bouton) => {
      const choisi = bouton.dataset.usersStatus === etat.statut;
      bouton.classList.toggle('is-selected', choisi);
      bouton.setAttribute('aria-pressed', String(choisi));
    });
  }

  async function chargerListe() {
    const cible = element('admin-users-table');
    if (!cible) return;
    const requeteCourante = ++numeroRequete;
    const pagination = element('admin-users-pagination');
    const compteur = element('admin-users-count');
    cible.setAttribute('aria-busy', 'true');
    cible.classList.add('is-loading');
    compteur.textContent = 'Chargement…';
    const params = new URLSearchParams({
      page: String(etat.page), limite: String(etat.limite), recherche: etat.recherche,
      statut: etat.statut, role: etat.role, tri: etat.tri
    });
    try {
      const reponse = await requeteAPI(`/api/admin/users?${params}`);
      if (requeteCourante !== numeroRequete) return;
      const utilisateurs = Array.isArray(reponse.utilisateurs) ? reponse.utilisateurs : [];
      adminUtilisateurs = utilisateurs; // Liste courante utilisée par la modale de blocage existante.
      const total = nombre(reponse.total);
      const pages = Math.max(1, nombre(reponse.pages));
      const page = Math.max(1, nombre(reponse.page));
      etat.page = page;
      cible.innerHTML = tableUtilisateurs(utilisateurs);
      compteur.textContent = `${total} utilisateur${total > 1 ? 's' : ''}`;
      element('admin-users-page-info').textContent = `Page ${page} sur ${pages}`;
      element('admin-users-previous').disabled = page <= 1;
      element('admin-users-next').disabled = page >= pages;
      pagination.hidden = total === 0 || pages <= 1;
      element('admin-users-reset')?.addEventListener('click', reinitialiserFiltres);
    } catch (erreur) {
      if (requeteCourante !== numeroRequete) return;
      adminUtilisateurs = [];
      cible.innerHTML = etatVide(erreur.message || 'Impossible de charger les utilisateurs.');
      compteur.textContent = 'Indisponible';
      pagination.hidden = true;
    } finally {
      if (requeteCourante === numeroRequete) {
        cible.setAttribute('aria-busy', 'false');
        cible.classList.remove('is-loading');
      }
    }
  }

  function reinitialiserFiltres() {
    etat.page = 1;
    etat.recherche = '';
    etat.role = 'tous';
    etat.statut = 'tous';
    etat.tri = 'recent';
    element('admin-users-search').value = '';
    element('admin-users-role').value = 'tous';
    element('admin-users-sort').value = 'recent';
    clearTimeout(minuterieRecherche);
    majBoutonsFiltres();
    chargerListe();
  }

  function mettreAjourFiltre(champ, valeur) {
    clearTimeout(minuterieRecherche);
    etat[champ] = valeur;
    etat.page = 1;
    majBoutonsFiltres();
    chargerListe();
  }

  // Remplace le rendu générique UNIQUEMENT sur users.html.
  // Les boutons « Examiner », « Bloquer » et « Débloquer » conservent leurs gestionnaires existants.
  chargerUtilisateursAdmin = chargerListe;

  document.querySelectorAll('[data-users-status]').forEach((bouton) => {
    bouton.addEventListener('click', () => mettreAjourFiltre('statut', bouton.dataset.usersStatus));
  });
  element('admin-users-role').addEventListener('change', (event) => mettreAjourFiltre('role', event.target.value));
  element('admin-users-sort').addEventListener('change', (event) => mettreAjourFiltre('tri', event.target.value));
  element('admin-users-search').addEventListener('input', (event) => {
    clearTimeout(minuterieRecherche);
    etat.recherche = event.target.value.trim();
    etat.page = 1;
    // Invalide immédiatement une ancienne réponse pendant que la saisie continue.
    numeroRequete++;
    minuterieRecherche = setTimeout(chargerListe, 280);
  });
  element('admin-users-previous').addEventListener('click', () => {
    if (etat.page <= 1) return;
    etat.page--;
    chargerListe();
  });
  element('admin-users-next').addEventListener('click', () => {
    if (element('admin-users-next').disabled) return;
    etat.page++;
    chargerListe();
  });
})();
