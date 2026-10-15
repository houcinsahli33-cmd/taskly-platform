"use strict";

(() => {
  let dialogue = null;
  let demandeActive = null;
  let actualisation = null;
  let generation = 0;
  let chargement = false;
  let envoi = false;
  let dernierAffichage = "";
  let boutonOrigine = null;

  function creerFenetre() {
    if (dialogue) return dialogue;

    dialogue = document.createElement("dialog");
    dialogue.className = "taskly-chat-dialog";

    dialogue.innerHTML = `
      <div class="taskly-chat-header">
        <div>
          <h2 id="taskly-chat-title">Messagerie Taskly</h2>
          <p>Conversation privée liée à votre demande</p>
        </div>
        <button type="button" class="btn outline"
          data-taskly-chat-close>Fermer ×</button>
      </div>

      <div class="taskly-chat-status"
        role="status" aria-live="polite"></div>

      <div class="taskly-chat-messages"
        role="log" aria-label="Messages de la conversation">
      </div>

      <form class="taskly-chat-form">
        <label for="taskly-chat-input">Votre message</label>
        <textarea id="taskly-chat-input"
          maxlength="4000" rows="3"
          placeholder="Écrire un message..."
          required></textarea>

        <button type="submit" class="btn primary">
          Envoyer le message
        </button>
      </form>
    `;

    document.body.appendChild(dialogue);

    dialogue.querySelector("[data-taskly-chat-close]")
      .addEventListener("click", () => dialogue.close());

    dialogue.addEventListener("close", () => {
      generation++;
      demandeActive = null;
      clearInterval(actualisation);
      actualisation = null;
      boutonOrigine?.focus();
    });

    dialogue.querySelector("form")
      .addEventListener("submit", envoyerMessage);

    return dialogue;
  }

  function afficherMessages(messages) {
    const conteneur = dialogue.querySelector(
      ".taskly-chat-messages"
    );

    const empreinte = JSON.stringify(messages);
    if (empreinte === dernierAffichage) return;
    dernierAffichage = empreinte;

    const fragment = document.createDocumentFragment();
    const role = window.utilisateurCourant?.role;

    if (!messages.length) {
      const vide = document.createElement("p");
      vide.className = "taskly-chat-empty";
      vide.textContent =
        "Aucun message pour le moment. Commencez la conversation.";
      fragment.appendChild(vide);
    }

    for (const message of messages) {
      const bloc = document.createElement("div");
      bloc.className = "taskly-chat-bubble";

      if (message.auteur_type === role) {
        bloc.classList.add("taskly-chat-mine");
      }

      const auteur = document.createElement("strong");
      auteur.textContent =
        message.auteur_type === "artisan" ? "Artisan" : "Client";

      const texte = document.createElement("p");
      texte.textContent = message.contenu || "";

      const heure = document.createElement("small");
      const date = new Date(message.created_at);

      heure.textContent = Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short"
          });

      bloc.append(auteur, texte, heure);
      fragment.appendChild(bloc);
    }

    conteneur.replaceChildren(fragment);
    conteneur.scrollTop = conteneur.scrollHeight;
  }

  async function chargerMessages(version) {
    if (!demandeActive || chargement) return;

    const id = demandeActive;
    chargement = true;

    try {
      const data = await requeteAPI(
        `/api/demandes/${id}/chat`
      );

      if (version !== generation || demandeActive !== id) {
        return;
      }

      const lectureSeule = Boolean(data.lectureSeule);

      dialogue.querySelector("#taskly-chat-title")
        .textContent = `Messagerie — Demande n° ${id}`;

      const zone = dialogue.querySelector(
        ".taskly-chat-status"
      );

      zone.textContent = lectureSeule
        ? "Conversation clôturée — historique en lecture seule."
        : "";

      dialogue.querySelector("textarea").disabled = lectureSeule;
      dialogue.querySelector(
        'button[type="submit"]'
      ).disabled = lectureSeule || envoi;

      afficherMessages(
        Array.isArray(data.messages) ? data.messages : []
      );
    } catch (erreur) {
      if (version === generation && demandeActive === id) {
        dialogue.querySelector(".taskly-chat-status")
          .textContent =
            erreur.message || "Chargement des messages impossible.";
      }
    } finally {
      chargement = false;
    }
  }

  async function envoyerMessage(event) {
    event.preventDefault();

    if (envoi || !demandeActive) return;

    const champ = dialogue.querySelector("textarea");
    const contenu = champ.value.trim();

    if (!contenu || contenu.length > 4000) return;

    const id = demandeActive;
    const version = generation;
    const bouton = dialogue.querySelector(
      'button[type="submit"]'
    );

    envoi = true;
    bouton.disabled = true;

    try {
      await requeteAPI(`/api/demandes/${id}/chat`, {
        method: "POST",
        body: JSON.stringify({ contenu })
      });

      if (version === generation && demandeActive === id) {
        champ.value = "";
        await chargerMessages(version);
      }
    } catch (erreur) {
      if (version === generation && demandeActive === id) {
        dialogue.querySelector(".taskly-chat-status")
          .textContent =
            erreur.message || "Envoi du message impossible.";
      }
    } finally {
      envoi = false;
      if (version === generation && !champ.disabled) {
        bouton.disabled = false;
      }
    }
  }

  function ouvrirChat(id, origine) {
    if (!/^[1-9]\d*$/.test(String(id))) return;

    creerFenetre();

    clearInterval(actualisation);
    generation++;

    demandeActive = Number(id);
    boutonOrigine = origine;
    dernierAffichage = "";

    dialogue.querySelector(".taskly-chat-messages")
      .replaceChildren();

    dialogue.querySelector("#taskly-chat-title")
      .textContent = `Messagerie — Demande n° ${demandeActive}`;

    dialogue.querySelector(".taskly-chat-status")
      .textContent = "Chargement de la conversation...";

    dialogue.querySelector("textarea").value = "";
    dialogue.querySelector("textarea").disabled = true;
    dialogue.querySelector('button[type="submit"]').disabled = true;

    if (!dialogue.open) dialogue.showModal();

    const version = generation;
    chargerMessages(version);

    actualisation = setInterval(() => {
      if (dialogue.open &&
          document.visibilityState === "visible") {
        chargerMessages(version);
      }
    }, 10000);
  }

  document.addEventListener("click", event => {
    const bouton = event.target.closest?.(
      "[data-open-taskly-chat]"
    );

    if (!bouton) return;

    event.preventDefault();
    ouvrirChat(bouton.dataset.openTasklyChat, bouton);
  });
})();