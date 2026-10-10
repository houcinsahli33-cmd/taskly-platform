/* Accès limité au dossier : aucun accès au tableau de bord artisan. */
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);

  async function chargerDossier() {
    try {
      const d = await requeteAPI('/api/artisan-support/context');
      $('pending-status').textContent = d.active
        ? 'Votre compte est maintenant activé. Reconnectez-vous pour ouvrir votre espace.'
        : d.message;
      $('pending-reason').textContent = d.compte.verification_commentaire || '';
      $('pending-email').textContent = 'Compte vérifié : ' + d.compte.email;
      $('pending-forms').hidden = false;
      $('pending-message-history').innerHTML = d.messages.map(m =>
        `<p><strong>Demande #${Number(m.id)} · ${echapperHTML(libelleStatut(m.statut))}</strong><br>${echapperHTML(m.message)}</p>`
      ).join('') || '<p class="muted">Aucune demande envoyée depuis ce compte.</p>';
      $('pending-doc-form').hidden = d.active || d.compte.verification_statut === 'approuve';
      $('pending-documents').textContent = 'Pièces reçues : ' + (
        d.documents.map(x => x.type_document + ' — ' + x.original_name).join(', ') || 'aucune'
      );
    } catch (err) {
      $('pending-status').textContent = err.message;
      $('pending-forms').hidden = true;
    }
  }

  async function soumettre(form, url, body, statusId) {
    const bouton = form.querySelector('button[type="submit"]');
    bouton.disabled = true;
    $(statusId).textContent = 'Envoi en cours…';
    try {
      const d = await requeteAPI(url, { method: 'POST', body });
      const message = d.message + (d.contactId ? ' Numéro de suivi : ' + d.contactId : '');
      form.reset();
      await chargerDossier();
      $(statusId).textContent = message;
    } catch (err) {
      $(statusId).textContent = err.message;
    } finally {
      bouton.disabled = false;
    }
  }

  $('pending-support-form').addEventListener('submit', event => {
    event.preventDefault();
    soumettre(event.currentTarget, '/api/artisan-support/messages',
      JSON.stringify({ message: $('pending-message').value }), 'pending-support-status');
  });
  $('pending-doc-form').addEventListener('submit', event => {
    event.preventDefault();
    soumettre(event.currentTarget, '/api/artisan-support/documents',
      new FormData(event.currentTarget), 'pending-doc-status');
  });
  $('pending-logout').addEventListener('click', async () => {
    try {
      await requeteAPI('/api/auth/logout', { method: 'POST', body: '{}' });
      location.replace('/login.html');
    } catch (err) {
      $('pending-status').textContent = err.message;
    }
  });
  // Une seule inscription au clic de suppression : jamais dans le callback d'un dépôt.
  $('pending-delete-form').addEventListener('submit', async event => {
    event.preventDefault();
    if ($('pending-delete-confirm').value !== 'SUPPRIMER') {
      $('pending-delete-status').textContent = 'Écrivez SUPPRIMER.';
      return;
    }
    if (!confirm('Supprimer définitivement votre compte et ses données liées ?')) return;
    const bouton = event.currentTarget.querySelector('button[type="submit"]');
    bouton.disabled = true;
    try {
      await requeteAPI('/api/artisan-support/account', {
        method: 'DELETE',
        body: JSON.stringify({
          motDePasse: $('pending-delete-password').value,
          confirmation: 'SUPPRIMER'
        })
      });
      location.replace('/');
    } catch (err) {
      $('pending-delete-status').textContent = err.message;
      bouton.disabled = false;
    }
  });
  chargerDossier();
});
