// Dossiers artisans : recherche et pagination serveur, sans limite de 200 dossiers.
// Ce fichier ne s'exécute que dans le tableau de bord privé après validation du rôle.
let artisansVerification = [];
let pageVerification = 1;
let pagesVerification = 0;
let versionListeVerification = 0;
const verificationLabel = s => ({
  en_attente: 'En attente', a_completer: 'Complément demandé',
  approuve: 'Approuvé', refuse: 'Refusé'
})[s] || s;

function texteSecurise(valeur) { return echapperHTML(valeur == null ? '' : valeur); }
function dateSecurisee(valeur) { return texteSecurise(formatDateHeure(valeur)); }

async function chargerArtisansVerification(page = 1) {
  const cible = document.getElementById('admin-verification-list');
  if (!cible) return;
  const version = ++versionListeVerification;
  cible.innerHTML = etatChargement('Chargement des dossiers...');
  const params = new URLSearchParams({
    page: String(page), limite: '20',
    statut: document.getElementById('admin-verification-status')?.value || 'tous',
    recherche: document.getElementById('admin-verification-search')?.value.trim() || ''
  });
  try {
    const data = await requeteAPI('/api/admin-verification/artisans?' + params.toString());
    if (version !== versionListeVerification) return;
    artisansVerification = data.artisans || [];
    pageVerification = data.page;
    pagesVerification = data.pages;
    const c = data.comptes || {};
    document.getElementById('admin-verification-counts').textContent =
      `${Number(data.total)} résultat(s) pour cette recherche — Total : ${Number(c.total || 0)} artisans ; ${Number(c.en_attente || 0)} en attente ; ${Number(c.a_completer || 0)} à compléter ; ${Number(c.approuve || 0)} approuvés ; ${Number(c.refuse || 0)} refusés ; ${Number(c.bloque || 0)} comptes bloqués.`;
    cible.innerHTML = artisansVerification.map(a => `
      <article class="card mb-16" style="padding:16px">
        <h3>${texteSecurise(nomComplet(a))}</h3>
        <p class="muted">${texteSecurise(a.service_nom)} · ${texteSecurise(a.ville)} ·
          ${texteSecurise(verificationLabel(a.verification_statut))} · ${Number(a.documents_count)} pièce(s)
          ${a.statut_compte === 'bloque' ? ' · Compte bloqué' : ''}</p>
        <button class="btn outline small" type="button" data-examine-artisan="${Number(a.id)}">Examiner le dossier</button>
      </article>`).join('') || '<p>Aucun artisan ne correspond aux filtres choisis.</p>';
    const nav = document.getElementById('admin-verification-pagination');
    nav.innerHTML = pagesVerification > 1 ? `
      <button class="btn outline small" type="button" data-page-verification="${pageVerification - 1}" ${pageVerification === 1 ? 'disabled' : ''}>Précédent</button>
      <span>Page ${pageVerification} / ${pagesVerification}</span>
      <button class="btn outline small" type="button" data-page-verification="${pageVerification + 1}" ${pageVerification >= pagesVerification ? 'disabled' : ''}>Suivant</button>` : '';
  } catch (error) {
    if (version !== versionListeVerification) return;
    cible.textContent = error.message;
    document.getElementById('admin-verification-pagination').replaceChildren();
  }
}

function ligneHistorique(h) {
  const identite = [h.admin_prenom, h.admin_nom].filter(Boolean).join(' ') || 'Administrateur';
  return `<div class="admin-review-history">
    <strong>${texteSecurise(verificationLabel(h.ancien_statut || 'Initial'))} → ${texteSecurise(verificationLabel(h.nouveau_statut))}</strong>
    <small>${texteSecurise(identite)} · ${dateSecurisee(h.created_at)}</small>
    ${h.commentaire ? `<p>${texteSecurise(h.commentaire)}</p>` : ''}
  </div>`;
}

async function ouvrirDossierArtisan(id) {
  const zone = document.getElementById('admin-verification-details');
  const a = artisansVerification.find(x => Number(x.id) === Number(id));
  if (!zone || !a) return;
  zone.textContent = 'Chargement du dossier...';
  try {
    const data = await requeteAPI(`/api/admin-verification/artisans/${Number(id)}/documents`);
    const documents = data.documents || [];
    const support = data.support || [];
    const notifications = data.notifications || [];
    const historique = data.historique || [];
    zone.innerHTML = `<section class="panel">
      <div class="panel-header"><h3>Dossier de ${texteSecurise(nomComplet(a))}</h3></div>
      <div class="panel-body">
        <div class="admin-review-layout">
          <div class="admin-review-evidence">
            <p>${texteSecurise(a.email)} · ${texteSecurise(a.telephone)} · ${texteSecurise(a.ville)}</p>
            <p>${texteSecurise(a.service_nom)} · ${Number(a.experience || 0)} an(s) d'expérience</p>
            <p>${texteSecurise(a.description || '')}</p>
            <p>Compte : ${texteSecurise(a.statut_compte)} · Dossier : ${texteSecurise(verificationLabel(a.verification_statut))}</p>
            ${a.verification_commentaire ? `<p>Dernier motif : ${texteSecurise(a.verification_commentaire)}</p>` : ''}
            <h4>Diplômes et certificats</h4>
            ${documents.map(d => `<div class="review-document"><span>${texteSecurise(d.type_document)} — ${texteSecurise(d.original_name)}</span><a class="btn outline small" href="/api/admin-verification/documents/${Number(d.id)}">Télécharger</a></div>`).join('') || '<p>Aucun document. Activation impossible sans diplôme ou certificat.</p>'}
            <h4>Messages au support liés à ce compte</h4>
            ${support.map(m => `<article class="mb-16 review-support"><strong>Demande #${Number(m.id)} · ${dateSecurisee(m.created_at)}</strong><p style="white-space:pre-wrap">${texteSecurise(m.message)}</p><small>${texteSecurise(m.statut)}</small></article>`).join('') || '<p>Aucun message associé.</p>'}
            <h4>Historique des décisions</h4>
            ${historique.map(ligneHistorique).join('') || '<p>Aucune décision enregistrée.</p>'}
          </div>
          <div class="admin-review-decision">
            <h4>Décision administrative</h4>
            <form id="admin-decision-form" class="grid">
              <label><span class="field-label">Décision</span><select class="form-select" name="statut" required>
                <option value="a_completer">Demander un complément</option>
                <option value="approuve">Approuver le compte</option>
                <option value="refuse">Refuser / bloquer le compte</option>
              </select></label>
              <label><span class="field-label">Motif (obligatoire pour un refus ou un complément)</span><textarea class="form-textarea" name="commentaire" maxlength="500"></textarea></label>
              <button class="btn primary" type="submit">Confirmer la décision</button>
            </form>
            <p id="admin-decision-info" role="status" aria-live="polite"></p>
            <h4>Notifications e-mail</h4>
            ${notifications.map(n => `<p>${dateSecurisee(n.created_at)} — ${texteSecurise(({sent:'Envoyé',pending:'En attente',sending:'En cours',failed:'Échec à réessayer'})[n.statut] || n.statut)}
              ${['pending','failed'].includes(n.statut) ? `<button class="btn outline small" type="button" data-notification-retry="${Number(n.id)}">Réessayer</button>` : ''}</p>`).join('') || '<p>Aucune notification.</p>'}
          </div>
        </div>
      </div></section>`;
    zone.querySelector('#admin-decision-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const info = document.getElementById('admin-decision-info');
      const b = form.querySelector('button[type=submit]');
      const f = new FormData(form);
      const statut = String(f.get('statut'));
      const commentaire = String(f.get('commentaire') || '').trim();
      if (statut !== 'approuve' && commentaire.length < 5) {
        info.textContent = 'Un motif d’au moins cinq caractères est obligatoire.';
        return;
      }
      if (!window.confirm(`Confirmer la décision « ${verificationLabel(statut)} » pour ${nomComplet(a)} ?`)) return;
      b.disabled = true;
      try {
        const result = await requeteAPI(`/api/admin-verification/artisans/${Number(id)}/decision`, {
          method:'PUT', body:JSON.stringify({statut,commentaire})
        });
        afficherToast(result.message);
        await chargerArtisansVerification(pageVerification);
        if (artisansVerification.some(x => Number(x.id) === Number(id))) await ouvrirDossierArtisan(id);
        else zone.textContent = 'Décision enregistrée. Le dossier ne correspond plus aux filtres actuels.';
        if (typeof chargerStatsAdmin === 'function') chargerStatsAdmin();
      } catch(e) {info.textContent = e.message;}
      finally {b.disabled = false;}
    });
    zone.querySelectorAll('[data-notification-retry]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const result = await requeteAPI(`/api/admin-verification/notifications/${button.dataset.notificationRetry}/retry`, {method:'POST',body:'{}'});
        afficherToast(result.message);
        await ouvrirDossierArtisan(id);
      } catch(e) { afficherToast(e.message,'error');button.disabled=false; }
    }));
  } catch (error) { zone.textContent = error.message; }
}

// Export local de la page courante : ne télécharge aucune pièce confidentielle.
function exporterPageArtisansCSV() {
  const columns = [
    ['ID', a => a.id], ['Nom', a => a.nom], ['Prénom', a => a.prenom],
    ['E-mail', a => a.email], ['Métier', a => a.service_nom],
    ['Ville', a => a.ville], ['Statut dossier', a => a.verification_statut],
    ['Statut compte', a => a.statut_compte], ['Justificatifs', a => a.documents_count]
  ];
  const cellule = valeur => {
    let texte = String(valeur ?? '').replaceAll('\r',' ').replaceAll('\n',' ');
    if (/^[\s]*[=+@-]/.test(texte)) texte = "'" + texte; // Pas de formule Excel.
    return '"' + texte.replaceAll('"','""') + '"';
  };
  const lignes = [columns.map(c => cellule(c[0])).join(';')];
  for (const a of artisansVerification) lignes.push(columns.map(c => cellule(c[1](a))).join(';'));
  const csv = '\ufeff' + lignes.join('\r\n');
  const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const lien = document.createElement('a');
  lien.href = url; lien.download = `taskly-artisans-page-${pageVerification}.csv`;
  document.body.appendChild(lien);lien.click();lien.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

document.addEventListener('DOMContentLoaded',async()=>{
  await attendreSession();
  if (window.utilisateurCourant?.role !== 'admin') return;
  await chargerArtisansVerification();
  document.getElementById('admin-verification-export')?.addEventListener('click',exporterPageArtisansCSV);
  document.getElementById('admin-verification-filters')?.addEventListener('submit', e => {
    e.preventDefault();
    document.getElementById('admin-verification-details').replaceChildren();
    chargerArtisansVerification(1);
  });
  document.getElementById('admin-verification-list')?.addEventListener('click',e => {
    const button = e.target.closest('[data-examine-artisan]');
    if (button) ouvrirDossierArtisan(button.dataset.examineArtisan);
  });
  document.getElementById('admin-verification-pagination')?.addEventListener('click', e => {
    const button = e.target.closest('[data-page-verification]');
    if (!button) return;
    document.getElementById('admin-verification-details').replaceChildren();
    chargerArtisansVerification(Number(button.dataset.pageVerification));
  });
});
