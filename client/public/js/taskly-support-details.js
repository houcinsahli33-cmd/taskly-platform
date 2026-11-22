/* Fenetre commune de details Support - client & artisan */
(() => {
  'use strict';
  function ready() {
    const dialog = document.getElementById('ts-support-details-dialog');
    if (!dialog) return;
    const $ = (name) => dialog.querySelector(`[data-support-detail="${name}"]`);
    const fields = ['number','subject','status','date','message','replies','error'];
    const els = Object.fromEntries(fields.map(n => [n,$(n)]));
    let requestId = 0;
    let opener = null;
    const date = (value) => {
      if (!value) return '—';
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'}).format(d);
    };
    const statuses = {traite:'Traité',en_cours:'En cours',nouveau:'Nouveau'};
    function clear() {
      for (const n of ['number','subject','status','date','message','error']) els[n].textContent = '';
      els.replies.replaceChildren();
      els.error.hidden = true;
    }
    function close() { if (dialog.open) dialog.close(); }
    dialog.querySelectorAll('[data-support-detail-close]').forEach(button => button.addEventListener('click',close));
    dialog.addEventListener('close',() => { requestId++; if (opener?.isConnected) opener.focus(); });
    dialog.addEventListener('click',(ev) => {
      if (ev.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) close();
    });
    async function openDetails(id,button) {
      const current = ++requestId;
      opener = button;
      clear();
      els.number.textContent = `Demande #${id}`;
      els.subject.textContent = 'Chargement de la demande…';
      if (!dialog.open) dialog.showModal();
      try {
        if (typeof requeteAPI !== 'function') throw new Error('Service indisponible.');
        const data = await requeteAPI(`/api/contact/mes-messages/${encodeURIComponent(id)}`);
        if (current !== requestId || !dialog.open) return;
        const m = data.message;
        if (!m || String(m.id) !== String(id)) throw new Error('Réponse du serveur invalide.');
        els.subject.textContent = m.sujet || 'Message au support';
        els.status.textContent = statuses[m.statut] || 'Reçu';
        els.date.textContent = date(m.created_at);
        els.message.textContent = m.message || '—';
        const replies = Array.isArray(data.reponses) ? data.reponses : [];
        if (!replies.length) {
          const note = document.createElement('p');
          note.className = 'ts-detail-pending';
          note.textContent = 'En attente de réponse de notre équipe.';
          els.replies.appendChild(note);
        }
        for (const reply of replies) {
          const article = document.createElement('article');
          article.className = 'ts-detail-reply';
          const head = document.createElement('strong');
          head.textContent = 'Équipe Support Taskly';
          const body = document.createElement('p');
          body.textContent = reply.corps || '';
          const time = document.createElement('small');
          time.textContent = date(reply.envoyee_at);
          article.append(head,body,time);
          els.replies.appendChild(article);
        }
      } catch (error) {
        if (current !== requestId || !dialog.open) return;
        els.subject.textContent = 'Impossible de consulter cette demande';
        els.error.textContent = error?.message || 'Veuillez réessayer.';
        els.error.hidden = false;
      }
    }
    document.addEventListener('click',(event) => {
      const button = event.target.closest('[data-support-view]');
      if (!button) return;
      const id = button.dataset.supportView;
      if (!/^[1-9][0-9]*$/.test(id || '')) return;
      event.preventDefault();
      openDetails(id,button);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',ready,{once:true});
  else ready();
})();
