'use strict';
/* Persistent same-origin in-app call host. No signaling, media or credential duplication.
   The call's owning iframe remains mounted while the dashboard navigates. */
(() => {
  if (window.TasklyCallHost) return;
  const ROLE = document.body?.dataset?.tasklyClientShell === '1' ? 'client'
    : document.body?.dataset?.tasklyArtisanShell === '1' ? 'artisan'
    : null;
  // A standalone messaging document is also allowed; the authenticated API
  // remains the only authority for the conversation/call.
  const validRole = role => role === 'client' || role === 'artisan';
  const validId = id => Number.isSafeInteger(Number(id)) && Number(id) > 0 && Number(id) <= 2147483647;
  let host = null;
  let frame = null;
  let activeConversation = 0;
  let state = 'normal';
  let priorState = 'normal';
  let normalBounds = null;
  let dragging = null;
  let cleanupTimer = null;

  const CSS = '/css/taskly-call-floating.css?v=7';
  if (!document.querySelector('link[data-taskly-floating-style]')) {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = CSS;
    css.dataset.tasklyFloatingStyle = '1'; document.head.append(css);
  }

  function send(type) {
    try { frame?.contentWindow?.postMessage({type: 'taskly:call-host-command', action: type}, location.origin); } catch {}
  }
  function center() {
    if (!host) return;
    host.style.left = Math.max(8, Math.round((innerWidth - host.offsetWidth) / 2)) + 'px';
    host.style.top = Math.max(8, Math.min(128, Math.round(innerHeight * 0.13))) + 'px';
  }
  function clampPosition() {
    if (!host || state === 'max') return;
    const r = host.getBoundingClientRect();
    const left = Math.max(6, Math.min(r.left, innerWidth - Math.min(74, r.width)));
    const top = Math.max(6, Math.min(r.top, innerHeight - 42));
    host.style.left = Math.round(left) + 'px';
    host.style.top = Math.round(top) + 'px';
  }
  function setState(next) {
    if (!host) return;
    const previous = state;
    if (next === 'min') { priorState = state === 'min' ? priorState : state; state = 'min'; }
    else if (next === 'restore') state = priorState === 'min' ? 'normal' : priorState;
    else state = next;
    if (previous === 'normal' && state === 'max') {
      const rect = host.getBoundingClientRect();
      normalBounds = {left:rect.left, top:rect.top, width:rect.width, height:rect.height};
    }
    host.dataset.callWindowState = state;
    const max = host.querySelector('[data-call-host="max"]');
    const min = host.querySelector('[data-call-host="min"]');
    if (max) {
      max.textContent = state === 'max' ? '❐' : '□';
      max.title = state === 'max' ? 'Restaurer la fenêtre' : 'Plein écran';
      max.setAttribute('aria-label', max.title);
      max.setAttribute('aria-pressed', String(state === 'max'));
    }
    if (min) {
      min.title = state === 'min' ? 'Restaurer l’appel' : 'Réduire l’appel';
      min.setAttribute('aria-label', min.title);
    }
    if (previous === 'max' && state === 'normal' && normalBounds) {
      host.style.left = Math.max(6, Math.round(normalBounds.left)) + 'px';
      host.style.top = Math.max(6, Math.round(normalBounds.top)) + 'px';
      host.style.width = Math.round(normalBounds.width) + 'px';
      host.style.height = Math.round(normalBounds.height) + 'px';
    }
    if (state !== 'max') clampPosition();
    send('layout:' + state);
  }
  function toggleFullscreen() {
    if (!host) return;
    if (state === 'min') setState('restore');
    if (state === 'max') {
      setState('normal');
      if (document.fullscreenElement === host) {
        void document.exitFullscreen?.().catch(() => {});
      }
    } else {
      setState('max');
      // Native fullscreen when permitted; CSS fullscreen fills the browser
      // viewport if the platform disallows requestFullscreen.
      try { void host.requestFullscreen?.().catch(() => {}); } catch {}
    }
  }
  function clear() {
    if (cleanupTimer) {clearTimeout(cleanupTimer);cleanupTimer=null;}
    if (document.fullscreenElement === host) {
      try { void document.exitFullscreen?.().catch(() => {}); } catch {}
    }
    host?.remove(); host=null;frame=null;activeConversation=0;state='normal';dragging=null;normalBounds=null;
  }
  function close() {
    if (!host) return;
    send('close');
    const x = host.querySelector('[data-call-host="close"]');
    if (x) x.disabled = true;
    // UI controller handles the real hangup, including the server request.
    if (cleanupTimer) clearTimeout(cleanupTimer);
    cleanupTimer = setTimeout(clear, 10000);
  }
  function create() {
    const el = document.createElement('section');
    el.className = 'taskly-floating-host'; el.dataset.callWindowState = 'normal';
    el.setAttribute('aria-label', 'Fenêtre d’appel Taskly');
    el.innerHTML = '<header class="taskly-floating-titlebar"><span class="taskly-floating-brand" aria-hidden="true">☎</span><strong>Appel Taskly</strong><div class="taskly-floating-commands"><button type="button" data-call-host="min" title="Réduire l’appel" aria-label="Réduire l’appel">−</button><button type="button" data-call-host="max" title="Agrandir" aria-label="Agrandir">□</button><button type="button" data-call-host="close" title="Raccrocher et fermer" aria-label="Raccrocher et fermer">×</button></div></header>';
    const inner = document.createElement('iframe');
    inner.className = 'taskly-floating-call-frame';
    inner.title = 'Appel Taskly en cours';
    inner.setAttribute('allow', 'microphone; camera; autoplay; display-capture');
    inner.setAttribute('referrerpolicy', 'same-origin');
    el.append(inner);
    const hint = document.createElement('p');
    hint.className = 'taskly-floating-loading';
    hint.textContent = 'Connexion à votre appel…';
    el.append(hint);
    el.querySelector('[data-call-host="close"]').addEventListener('click', close);
    el.querySelector('[data-call-host="min"]').addEventListener('click', () => setState(state === 'min' ? 'restore' : 'min'));
    el.querySelector('[data-call-host="max"]').addEventListener('click', toggleFullscreen);
    const title = el.querySelector('.taskly-floating-titlebar');
    title.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button') || state === 'max') return;
      const rect = el.getBoundingClientRect();
      dragging = {x:event.clientX, y:event.clientY, left:rect.left, top:rect.top};
      title.setPointerCapture?.(event.pointerId);
    });
    title.addEventListener('pointermove', event => {
      if (!dragging) return;
      el.style.left = Math.round(Math.max(6, Math.min(dragging.left + event.clientX - dragging.x, innerWidth - 74))) + 'px';
      el.style.top = Math.round(Math.max(6, Math.min(dragging.top + event.clientY - dragging.y, innerHeight - 42))) + 'px';
    });
    const finishDrag = () => { dragging = null; };
    title.addEventListener('pointerup', finishDrag);
    title.addEventListener('pointercancel', finishDrag);
    window.addEventListener('resize', clampPosition, {passive:true});
    // Escape from native fullscreen restores the compact call without hanging up.
    document.addEventListener('fullscreenchange', () => {
      if (host === el && state === 'max' && document.fullscreenElement !== el) setState('normal');
    });
    document.body.append(el);
    host = el; frame = inner; center();
    return el;
  }
  function open(role, id, mode='receive') {
    id = Number(id);
    if (!validRole(role) || !validId(id) || !['audio','video','receive'].includes(mode)) return false;
    if (ROLE && role !== ROLE) return false;
    if (host) {
      if (activeConversation !== id) return false;
      if (state === 'min') setState('restore');
      host.focus?.(); return true;
    }
    create();
    activeConversation = id;
    const url = new URL('/espace/' + role + '/messagerie', location.origin);
    url.searchParams.set('conversation', String(id));
    url.searchParams.set('taskly_call_host', '1');
    url.searchParams.set('taskly_call_mode', mode);
    url.searchParams.set(role === 'client' ? 'taskly_client_embed' : 'taskly_artisan_embed', '1');
    frame.src = url.pathname + url.search;
    setTimeout(() => {
      if (host?.querySelector('.taskly-floating-loading') && activeConversation === id) {
        host.querySelector('.taskly-floating-loading').textContent = 'Appel indisponible. Vérifiez la conversation ou fermez la fenêtre.';
      }
    }, 18000);
    frame.addEventListener('load', () => {
      try { frame?.contentWindow?.postMessage({type:'taskly:call-host-command', action:'layout:' + state}, location.origin); } catch {}
    });
    return true;
  }
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || !frame || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'taskly:call-host-ready') return;
    if (event.data?.type === 'taskly:call-host-ended') clear();
    if (event.data?.type === 'taskly:call-host-action') {
      if (event.data.action === 'max') toggleFullscreen();
      if (event.data.action === 'chat') {
        if (state !== 'min') setState('min');
        window.dispatchEvent(new CustomEvent('taskly:open-call', {detail:{demandeId:activeConversation}}));
      }
    }
    if (event.data?.type === 'taskly:call-host-mode') {
      host?.querySelector('.taskly-floating-loading')?.remove();
      // Audio and video both start compact; the user chooses fullscreen.
      const title=host?.querySelector('.taskly-floating-titlebar strong');
      if(title) title.textContent=event.data.mode==='video'?'Appel vidéo Taskly':'Appel Taskly';
    }
  });
  // Incoming banner on any dashboard section: use the persistent call host
  // rather than opening a second tab or replacing the active content iframe.
  document.addEventListener('click', event => {
    const button = event.target.closest?.('.taskly-global-call [data-call="open"]');
    if (!button || !event.isTrusted || !ROLE) return;
    if (typeof window.requeteAPI !== 'function') return;
    event.preventDefault(); event.stopImmediatePropagation();
    button.disabled = true;
    window.requeteAPI('/api/demandes/chat/calls/incoming').then(data => {
      const call = Array.isArray(data?.appels) ? data.appels.find(c => validId(c.demandeId) && ['audio','video'].includes(c.mode)) : null;
      if (call) open(ROLE, call.demandeId, 'receive');
    }).catch(() => { /* The existing incoming banner will refresh. */ })
      .finally(() => { button.disabled = false; });
  }, true);
  window.TasklyCallHost = Object.freeze({open, isActive:()=>Boolean(host), currentConversation:()=>activeConversation});
})();
