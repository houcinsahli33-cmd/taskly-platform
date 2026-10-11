/* Confirmation explicite : aucune requête avant le second clic. */
let confirmationSuppressionOuverte = false;
window.confirmerSuppressionCompte = function () {
  if (confirmationSuppressionOuverte) return Promise.resolve(false);
  confirmationSuppressionOuverte = true;
  return new Promise(resolve => {
    const previous = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'taskly-confirm-dialog';
    dialog.setAttribute('aria-labelledby', 'delete-confirm-title');
    dialog.setAttribute('aria-describedby', 'delete-confirm-description');
    dialog.innerHTML = `<span class="taskly-danger-label">Suppression du compte</span>
      <h2 id="delete-confirm-title">Supprimer définitivement votre compte ?</h2>
      <p id="delete-confirm-description">Votre profil, vos justificatifs et les données liées seront supprimés. Cette action est irréversible.</p>
      <div class="taskly-form-actions"><button class="btn outline" type="button" data-cancel>Annuler</button>
      <button class="btn primary" type="button" data-delete>Supprimer définitivement</button></div>`;
    document.body.appendChild(dialog);
    let finished = false;
    function finish(confirmed) {
      if (finished) return;
      finished = true;
      confirmationSuppressionOuverte = false;
      dialog.close();
      dialog.remove();
      previous?.focus();
      resolve(confirmed);
    }
    dialog.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
    dialog.querySelector('[data-delete]').addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
    dialog.addEventListener('close', () => finish(false));
    dialog.showModal();
    dialog.querySelector('[data-cancel]').focus();
  });
};
