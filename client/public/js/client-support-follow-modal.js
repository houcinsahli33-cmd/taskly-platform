/* Interface de suivi client : le backend, le formulaire et les réponses restent dans contact.js. */
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    if (!['client', 'artisan'].includes(document.body.dataset.requireRole) ||
        document.body.dataset.workspacePage !== 'support') return;
    const dialog = document.getElementById('client-support-follow-dialog');
    if (!dialog || typeof dialog.showModal !== 'function') return;
    let previousFocus = null;
    document.addEventListener('click', event => {
      const open = event.target.closest('[data-open-support-follow]');
      if (open) {
        event.preventDefault();
        if (dialog.open) return;
        previousFocus = open;
        document.getElementById('follow-result').replaceChildren();
        const form = document.getElementById('follow-form');
        form.reset();
        const authenticatedEmail = window.utilisateurCourant?.email;
        if (typeof authenticatedEmail === 'string') {
          document.getElementById('follow-email').value = authenticatedEmail;
        }
        dialog.showModal();
        document.getElementById('follow-id').focus();
        return;
      }
      if (event.target.closest('[data-close-support-follow]')) {
        event.preventDefault();
        dialog.close();
      }
    });
    dialog.addEventListener('click', event => {
      // Un clic sur l'arrière-plan ferme la fenêtre, sans modifier le formulaire réel.
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (previousFocus?.isConnected) previousFocus.focus();
      previousFocus = null;
    });
  });
})();
