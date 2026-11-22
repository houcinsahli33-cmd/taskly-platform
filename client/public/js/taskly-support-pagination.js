
/*
 * TASKLY - Pagination Support
 * 3 messages par page.
 * Utilise l'API existante /api/contact/mes-messages
 * Sans modification du serveur, du header ou de la sidebar.
 */

(() => {
  "use strict";

  function initSupportPagination() {
    const container = document.querySelector(
      '.taskly-support-paginated [data-support-history]'
    );

    if (!container) return;

    const toggle = container.querySelector(
      "[data-support-history-toggle]"
    );
    const content = container.querySelector(
      ".taskly-history-content"
    );
    const list = container.querySelector(
      "[data-support-history-list]"
    );
    const pager = container.querySelector(
      "[data-support-pagination]"
    );

    if (!toggle || !content || !list || !pager) return;

    // Évite une double initialisation
    if (container.dataset.paginationReady === "true") return;
    container.dataset.paginationReady = "true";

    const PER_PAGE = 3;
    const API_LIMIT = 20;

    let currentPage = 1;
    let messages = [];
    let hasMore = false;
    let busy = false;
    let generation = 0;

    function formatDate(value) {
      if (!value) return "—";

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) return "—";

      return new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short"
      }).format(date);
    }

    function addCell(row, value, className = "") {
      const cell = document.createElement("td");

      cell.textContent = String(value ?? "");

      if (className) cell.className = className;

      row.appendChild(cell);
      return cell;
    }

    function statusLabel(status) {
      if (status === "traite") return "Traité";
      if (status === "en_cours") return "En cours";
      return "Reçu";
    }

    function statusClass(status) {
      if (status === "traite") return " is-done";
      if (status === "en_cours") return " is-progress";
      return "";
    }

    function renderMessage(message) {
      const row = document.createElement("tr");

      addCell(row, "#" + message.id, "ts-number");

      addCell(
        row,
        message.sujet || "Message au support"
      );

      const statusCell = document.createElement("td");
      statusCell.className = "ts-status-cell";

      const badge = document.createElement("span");
      badge.className =
        "ts-status" + statusClass(message.statut);
      badge.textContent = statusLabel(message.statut);

      statusCell.appendChild(badge);
      row.appendChild(statusCell);

      addCell(row, formatDate(message.created_at));

      const actionsCell = document.createElement("td");

      const view = document.createElement("button");
      view.type = "button";
      view.textContent = "◉ Voir";
      view.dataset.supportView = String(message.id);
      view.setAttribute("aria-label", "Voir les détails de la demande " + message.id);
      actionsCell.appendChild(view);
      row.appendChild(actionsCell);

      list.appendChild(row);
    }

    function createButton(label, target, disabled, current) {
      const button = document.createElement("button");

      button.type = "button";
      button.className =
        "ts-page-btn" + (current ? " is-current" : "");

      button.textContent = label;
      button.disabled = disabled;

      if (current) {
        button.setAttribute("aria-current", "page");
      }

      button.addEventListener("click", () => {
        navigate(target);
      });

      pager.appendChild(button);
    }

    function renderPagination() {
      pager.replaceChildren();

      const totalPages = Math.max(
        1,
        Math.ceil(messages.length / PER_PAGE)
      );

      createButton(
        "‹ Précédent",
        currentPage - 1,
        busy || currentPage === 1,
        false
      );

      const firstPage = Math.max(
        1,
        Math.min(currentPage - 2, totalPages - 4)
      );

      const lastPage = Math.min(
        totalPages,
        firstPage + 4
      );

      for (let page = firstPage; page <= lastPage; page++) {
        createButton(
          String(page),
          page,
          busy,
          page === currentPage
        );
      }

      createButton(
        "Suivant ›",
        currentPage + 1,
        busy || (currentPage >= totalPages && !hasMore),
        false
      );
    }

    function render() {
      list.replaceChildren();

      const start = (currentPage - 1) * PER_PAGE;
      const visible = messages.slice(start, start + PER_PAGE);

      if (visible.length === 0) {
        const row = document.createElement("tr");
        const cell = addCell(
          row,
          busy
            ? "Chargement des messages…"
            : "Aucun message lié à ce compte pour le moment.",
          "ts-empty-row"
        );

        cell.colSpan = 5;
        list.appendChild(row);
      } else {
        visible.forEach(renderMessage);
      }

      renderPagination();
    }

    function showError(error) {
      let note = content.querySelector(".ts-history-error");

      if (!note) {
        note = document.createElement("p");
        note.className = "ts-history-error";
        content.appendChild(note);
      }

      note.textContent =
        error?.message ||
        "Impossible de charger les messages.";
    }

    async function fetchMessages(apiPage, token) {
      if (typeof requeteAPI !== "function") {
        throw new Error("Service de support indisponible.");
      }

      const response = await requeteAPI(
        `/api/contact/mes-messages?page=${apiPage}`
      );

      if (token !== generation) return false;

      const batch = Array.isArray(response.messages)
        ? response.messages
        : [];

      messages.push(...batch);
      hasMore = response.hasMore === true && batch.length > 0;

      return true;
    }

    async function navigate(targetPage) {
      if (busy || targetPage < 1) return;

      busy = true;
      const token = generation;
      render();

      try {
        const requiredCount =
          (targetPage - 1) * PER_PAGE + 1;

        while (
          messages.length < requiredCount &&
          hasMore
        ) {
          const apiPage =
            Math.floor(messages.length / API_LIMIT) + 1;

          const completed = await fetchMessages(
            apiPage,
            token
          );

          if (!completed) return;
        }

        if (
          targetPage === 1 ||
          messages.length >= requiredCount
        ) {
          currentPage = targetPage;
        }
      } catch (error) {
        showError(error);
      } finally {
        busy = false;
        render();
      }
    }

    async function loadHistory() {
      if (busy) return;

      generation++;
      const token = generation;

      currentPage = 1;
      messages = [];
      hasMore = false;
      busy = true;

      content.querySelector(".ts-history-error")?.remove();
      render();

      try {
        await fetchMessages(1, token);
      } catch (error) {
        showError(error);
      } finally {
        busy = false;
        render();
      }
    }

    toggle.addEventListener("click", () => {
      const opening = content.hidden;

      content.hidden = !opening;
      toggle.setAttribute(
        "aria-expanded",
        String(opening)
      );

      if (opening) {
        loadHistory();
      }
    });

    // Actualiser après l'envoi d'un message.
    document.addEventListener(
      "taskly:support-message-sent",
      () => {
        if (!content.hidden) loadHistory();
      }
    );

    // Historique visible au chargement,
    // comme dans la maquette validée.
    if (content.hidden) {
      toggle.click();
    } else {
      loadHistory();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initSupportPagination,
      { once: true }
    );
  } else {
    initSupportPagination();
  }
})();
