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
      <header class="taskly-chat-top">
        <div>
          <p class="taskly-chat-eyebrow">TASKLY · MESSAGERIE PRIVÉE</p>
          <h2 id="taskly-chat-title">Messagerie</h2>
          <span class="taskly-chat-pill">Conversation privée</span>
        </div>
        <button type="button" class="btn outline"
          data-taskly-chat-close>Fermer ×</button>
      </header>

      <div class="taskly-chat-overview">
        <section class="taskly-chat-info-card">
          <h3>👤 <span id="taskly-chat-person-title">Interlocuteur</span></h3>
          <dl>
            <div>
              <dt>Nom</dt>
              <dd id="taskly-chat-person-name">—</dd>
            </div>
            <div>
              <dt>Localisation / contact</dt>
              <dd id="taskly-chat-person-detail">—</dd>
            </div>
          </dl>
        </section>

        <section class="taskly-chat-info-card">
          <h3>◈ La prestation</h3>
          <dl>
            <div>
              <dt>Service</dt>
              <dd id="taskly-chat-service">—</dd>
            </div>
            <div>
              <dt>Date souhaitée</dt>
              <dd id="taskly-chat-date">—</dd>
            </div>
            <div>
              <dt>Adresse</dt>
              <dd id="taskly-chat-address">—</dd>
            </div>
          </dl>
        </section>
      </div>

      <div class="taskly-chat-notice">
        <span>ⓘ Conversation privée liée à cette demande.</span>
        <button type="button" class="btn outline"
          data-taskly-chat-view>Voir la demande</button>
      </div>

      <section class="taskly-chat-conversation"
        aria-label="Conversation client artisan">
        <div class="taskly-chat-participants">
          <div class="taskly-chat-avatar">C</div>
          <div class="taskly-chat-participant">
            <strong id="taskly-chat-client-name">Client</strong>
            <small>Client</small>
          </div>

          <span class="taskly-chat-exchange">⇄</span>

          <div class="taskly-chat-avatar artisan">A</div>
          <div class="taskly-chat-participant">
            <strong id="taskly-chat-artisan-name">Artisan</strong>
            <small>Artisan</small>
          </div>
        </div>

        <div class="taskly-chat-status"
          role="status" aria-live="polite"></div>

        <div class="taskly-chat-messages"
          role="log" aria-label="Messages de la conversation">
        </div>
      </section>

      <form class="taskly-chat-form">
        <label for="taskly-chat-input">Votre message</label>
        <div class="taskly-chat-composer">
          <textarea id="taskly-chat-input"
            maxlength="4000" rows="1"
            placeholder="Écrire votre message..."
            required></textarea>

          <button type="submit" class="btn primary">
            ➤ Envoyer
          </button>
        </div>
      </form>

      <p class="taskly-chat-footnote">
        ⓘ Historique conservé avec cette demande.
      </p>
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

    dialogue.querySelector("[data-taskly-chat-view]")
      .addEventListener("click", () => {
        const carte = boutonOrigine?.closest(".request-card");
        dialogue.close();
        carte?.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      });
    dialogue.querySelector("form")
      .addEventListener("submit", envoyerMessage);

    return dialogue;
  }

  function remplirResume(origine) {
    const carte = origine?.closest(".request-card");
    const role = window.utilisateurCourant?.role;

    const lire = selecteur =>
      carte?.querySelector(selecteur)?.textContent?.trim() || "";

    const titre = lire(".request-head h3");
    const sousTitre = lire(".request-head .muted");

    const badges = Array.from(
      carte?.querySelectorAll(".meta-row .badge") || []
    ).map(element => element.textContent.trim());

    const valeur = prefixe => {
      const ligne = badges.find(texte =>
        texte.startsWith(prefixe)
      );

      return ligne
        ? ligne.slice(prefixe.length).trim()
        : "Non précisé";
    };

    const interlocuteur = role === "artisan"
      ? titre
      : sousTitre.replace(/^Avec\s+/i, "").split("·")[0].trim();

    const complement = sousTitre.includes("·")
      ? sousTitre.split("·").slice(1).join("·").trim()
      : sousTitre;

    const remplir = (id, texte) => {
      dialogue.querySelector(`#${id}`).textContent =
        texte || "Non précisé";
    };

    remplir(
      "taskly-chat-person-title",
      role === "artisan"
        ? "Informations du client"
        : "Informations de l'artisan"
    );

    remplir("taskly-chat-person-name", interlocuteur);
    remplir("taskly-chat-person-detail", complement);

    remplir(
      "taskly-chat-service",
      role === "client" ? titre : "Intervention Taskly"
    );

    remplir("taskly-chat-date", valeur("Date souhaitée :"));
    remplir("taskly-chat-address", valeur("Adresse :"));

    remplir(
      "taskly-chat-client-name",
      role === "client" ? "Vous" : interlocuteur
    );

    remplir(
      "taskly-chat-artisan-name",
      role === "artisan" ? "Vous" : interlocuteur
    );
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
      bloc.dataset.chatAuteur = message.auteur_type;

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
    remplirResume(origine);

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