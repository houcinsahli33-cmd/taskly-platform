const sujetsSupport = [
  "Compte bloqué",
  "Problème de connexion",
  "Problème avec une demande",
  "Problème avec un artisan",
  "Problème avec un client",
  "Problème de signalement",
  "Problème avec un avis",
  "Bug sur le site",
  "Autre"
];

// Remplir les sujets du formulaire support
function remplirSujetsSupport() {
  document.querySelectorAll("[data-support-subjects]").forEach((select) => {
    select.innerHTML = `<option value="">Choisir un sujet</option>` + sujetsSupport
      .map((sujet) => `<option value="${echapperHTML(sujet)}">${echapperHTML(sujet)}</option>`)
      .join("");
  });
}

// Envoyer le message au support
function initialiserContactSupport() {
  const form = document.getElementById("contact-form");
  const alerte = document.getElementById("contact-alert");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    masquerAlerte(alerte);
    const bouton = form.querySelector("button[type='submit']");
    bouton.disabled = true;

    try {
      const data = await requeteAPI("/api/contact", {
        method: "POST",
        body: JSON.stringify({
          nom: document.getElementById("contact-name").value.trim(),
          email: document.getElementById("contact-email").value.trim(),
          sujet: document.getElementById("contact-subject").value,
          message: document.getElementById("contact-message").value.trim()
        })
      });

      afficherAlerte(
        alerte,
        `Votre message a été envoyé. Numéro de suivi : <strong>${data.contactId}</strong>`,
        "success"
      );
      form.reset();
    } catch (error) {
      afficherAlerte(alerte, echapperHTML(error.message), "error");
    } finally {
      bouton.disabled = false;
    }
  });
}

// Suivre un message support avec son numero
function initialiserSuiviSupport() {
  const form = document.getElementById("follow-form");
  const cible = document.getElementById("follow-result");
  if (!form || !cible) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    cible.innerHTML = etatChargement("Recherche du message...");

    const contactId = document.getElementById("follow-id").value.trim();
    const email = document.getElementById("follow-email").value.trim();

    try {
      const { contact } = await requeteAPI(`/api/contact/suivi?contactId=${encodeURIComponent(contactId)}&email=${encodeURIComponent(email)}`);
      cible.innerHTML = `
        <article class="card">
          <div class="card-body">
            <div class="request-head">
              <div>
                <h3>${echapperHTML(contact.sujet)}</h3>
                <p class="muted">Envoyé le ${formatDateHeure(contact.created_at)}</p>
              </div>
              ${badgeStatut(contact.statut)}
            </div>
            <p>${echapperHTML(contact.message)}</p>
            ${contact.date_traitement ? `<p class="text-small muted" style="margin-top:14px">Traité le ${formatDateHeure(contact.date_traitement)}</p>` : ""}
          </div>
        </article>
      `;
    } catch (error) {
      cible.innerHTML = etatVide(error.message);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await attendreSession();
  remplirSujetsSupport();
  initialiserContactSupport();
  initialiserSuiviSupport();
});
