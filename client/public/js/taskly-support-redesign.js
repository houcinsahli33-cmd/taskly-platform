
/*
 * TASKLY - Support Redesign
 * Gestion des fenêtres Nouvelle demande et FAQ.
 *
 * Ne modifie pas :
 * - le header
 * - la sidebar
 * - l'envoi des messages
 * - le suivi existant
 * - l'historique
 */

(() => {
  "use strict";

  function initializeSupportDialogs() {
    const supportPage = document.querySelector(
      'body[data-workspace-page="support"]'
    );

    if (!supportPage) return;

    const dialogs = {
      contact: document.getElementById("ts-contact-dialog"),
      faq: document.getElementById("ts-faq-dialog")
    };

    function closeDialog(dialog) {
      if (!dialog || !dialog.open) return;
      dialog.close();
    }

    function openDialog(name) {
      const dialog = dialogs[name];

      if (!dialog) return;

      Object.values(dialogs).forEach((other) => {
        if (other !== dialog) {
          closeDialog(other);
        }
      });

      const followDialog = document.getElementById(
        "client-support-follow-dialog"
      );

      if (followDialog?.open) {
        followDialog.close();
      }

      if (!dialog.open) {
        dialog.showModal();
      }
    }

    // Boutons Nouvelle demande et FAQ
    document.querySelectorAll("[data-ts-open]").forEach(
      (button) => {
        button.addEventListener("click", () => {
          const name = button.dataset.tsOpen;

          if (Object.prototype.hasOwnProperty.call(dialogs, name)) {
            openDialog(name);
          }
        });
      }
    );

    // Boutons de fermeture
    document.querySelectorAll("[data-ts-close]").forEach(
      (button) => {
        button.addEventListener("click", () => {
          const dialog = button.closest("dialog");

          if (dialog) {
            closeDialog(dialog);
          }
        });
      }
    );

    // Fermeture par clic sur le fond sombre
    Object.values(dialogs).forEach((dialog) => {
      if (!dialog) return;

      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
          const bounds = dialog.getBoundingClientRect();

          const inside =
            event.clientX >= bounds.left &&
            event.clientX <= bounds.right &&
            event.clientY >= bounds.top &&
            event.clientY <= bounds.bottom;

          if (!inside) {
            closeDialog(dialog);
          }
        }
      });
    });

    // Lorsque l'utilisateur veut suivre un message
    // depuis la fenêtre Nouvelle demande,
    // on ferme uniquement notre fenêtre.
    document.querySelectorAll(
      "#ts-contact-dialog [data-open-support-follow]"
    ).forEach((button) => {
      button.addEventListener("click", () => {
        closeDialog(dialogs.contact);
      });
    });

    // Ne pas réinitialiser le formulaire après l'envoi.
    // contact.js conserve la gestion métier existante.

    console.info(
      "[Taskly Support] Fenêtres initialisées."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeSupportDialogs,
      { once: true }
    );
  } else {
    initializeSupportDialogs();
  }
})();
