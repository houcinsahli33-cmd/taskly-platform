(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('[data-support-history]');
    if (!container || !['client', 'artisan'].includes(document.body.dataset.requireRole)) return;
    const button = container.querySelector('[data-support-history-toggle]');
    const content = container.querySelector('.taskly-history-content');
    const list = container.querySelector('[data-support-history-list]');
    const more = container.querySelector('[data-support-history-more]');
    let page = 1, hasMore = false, busy = false;
    const safeDate = value => {
      if (!value) return '';
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('fr-FR', {dateStyle:'medium',timeStyle:'short'}).format(date);
    };
    function addMessage(message) {
      const article = document.createElement('article');
      article.className = 'taskly-history-item';
      const head = document.createElement('div');
      head.className = 'taskly-history-item-head';
      const description = document.createElement('div');
      const subject = document.createElement('strong');
      subject.textContent = message.sujet || 'Message au support';
      const meta = document.createElement('small');
      meta.textContent = `N° de suivi : ${message.id}  ·  ${safeDate(message.created_at)}`;
      description.append(subject,meta);
      const status = document.createElement('span');
      status.className = 'taskly-history-status';
      status.textContent = message.statut === 'traite' ? 'Traité' : message.statut === 'en_cours' ? 'En cours' : 'Reçu';
      if (message.statut === 'traite') status.classList.add('is-closed');
      head.append(description,status);
      const detail = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Lire le message';
      const body = document.createElement('p');
      body.textContent = message.message || '';
      detail.append(summary,body);
      article.append(head,detail);
      list.append(article);
    }
    async function load(reset = false) {
      if (busy) return;
      busy = true;
      if (reset) {page=1;hasMore=false;list.replaceChildren();}
      const note = document.createElement('p');
      note.className = 'taskly-history-loading';
      note.textContent = 'Chargement des messages…';
      list.append(note);
      more.hidden = true;
      try {
        const result = await requeteAPI(`/api/contact/mes-messages?page=${page}`);
        note.remove();
        const messages = Array.isArray(result.messages) ? result.messages : [];
        if (!messages.length && page === 1) {
          const empty = document.createElement('p');
          empty.className = 'taskly-history-empty';
          empty.textContent = 'Aucun message lié à ce compte pour le moment.';
          list.append(empty);
        }
        messages.forEach(addMessage);
        hasMore = result.hasMore === true;
        more.hidden = !hasMore;
        page++;
      } catch(error) {
        note.textContent = error?.message || 'Impossible de charger les messages pour le moment.';
        note.className='taskly-history-error';
      } finally {busy=false;}
    }
    button.addEventListener('click', () => {
      const opening = content.hidden;
      content.hidden = !opening;
      button.setAttribute('aria-expanded', String(opening));
      if (opening) load(true);
    });
    more.addEventListener('click',()=> {if(hasMore) load();});
    // Un nouveau message dans ce formulaire : afficher le suivi sans recharger la page.
    document.addEventListener('taskly:support-message-sent', () => {
      if (!content.hidden) load(true);
    });
  });
})();
