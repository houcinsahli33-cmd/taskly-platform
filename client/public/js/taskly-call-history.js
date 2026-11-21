"use strict";
// Metadonnees d'appels : integration chronologique dans les messages prives.
// Aucun acces aux medias, ni jetons LiveKit, ni autre conversation.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TasklyCallHistory = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const statuses = new Set(['ringing','answered','completed','missed','declined','cancelled','interrupted']);
  function merge(messages, calls) {
    const result = [];
    for (const m of Array.isArray(messages) ? messages : []) {
      if (!m || typeof m !== 'object') continue;
      const at = Date.parse(m.created_at);
      result.push({ kind:'message', at:Number.isFinite(at) ? at : 0, item:m });
    }
    for (const c of (Array.isArray(calls) ? calls : []).slice(0,50)) {
      if (!c || !['client','artisan'].includes(c.callerRole) ||
          !['audio','video'].includes(c.mode) || !statuses.has(c.status)) continue;
      const at = Date.parse(c.startedAt);
      if (!Number.isFinite(at)) continue;
      result.push({ kind:'call', at, item:c });
    }
    result.sort((a,b)=>a.at-b.at || (a.kind==='call'?-1:1));
    return result;
  }
  function presentation(call, role) {
    const outgoing = call.callerRole === role;
    const title = 'Appel '+(call.mode === 'video'?'vidéo':'audio')+' '+(outgoing?'sortant':'entrant');
    const labels = {
      ringing:'En attente', answered:'En cours', completed:'Terminé',
      missed:outgoing?'Sans réponse':'Manqué',
      declined:'Refusé', cancelled:'Annulé', interrupted:'Interrompu'
    };
    let state = labels[call.status] || 'Appel';
    if (call.status === 'completed' && Number.isFinite(Number(call.durationSeconds)) &&
        call.durationSeconds !== null && Number(call.durationSeconds)>=0) {
      const sec = Math.floor(Number(call.durationSeconds));
      const duration = sec>=3600 ? `${Math.floor(sec/3600)} h ${String(Math.floor(sec/60)%60).padStart(2,'0')} min` :
        `${Math.floor(sec/60)} min ${String(sec%60).padStart(2,'0')} s`;
      state += ' · '+duration;
    }
    return {title,state,icon:call.mode==='video'?'📹':'📞'};
  }
  return Object.freeze({merge,presentation});
});
