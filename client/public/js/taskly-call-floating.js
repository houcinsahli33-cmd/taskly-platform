'use strict';
/* Call controls and persistence layer for Taskly Client / Artisan.
 * Existing LiveKit signaling, security and media tracks remain untouched.
 * A dedicated same-origin iframe owns the active call across shell navigation.
 */
(() => {
  if (window.TasklyCallFloating) return;
  const params = new URLSearchParams(location.search);
  const isHost = params.get('taskly_call_host') === '1';
  const requestedMode = params.get('taskly_call_mode');
  const selectedId = Number(params.get('conversation'));
  let ui = null;
  let started = false;
  const finishing = new WeakSet();
  const shell = (() => {
    try { return window.top && window.top.location.origin === location.origin ? window.top : null; }
    catch { return null; }
  })();
  function parentHost() { return shell?.TasklyCallHost || null; }
  function role() { return window.utilisateurCourant?.role || document.body?.dataset?.requireRole || null; }
  function notify(type, extra = {}) {
    if (!isHost || !window.parent || window.parent === window) return;
    try { window.parent.postMessage({type, ...extra}, location.origin); } catch {}
  }
  if (!isHost) {
    // The shell stays mounted when switching Taskly sections. Inject once into
    // its document, never into the temporary messaging iframe.
    const doc = shell?.document || document;
    if (!doc.querySelector('script[data-taskly-persistent-call-host]')) {
      const script = doc.createElement('script');
      script.src = '/js/taskly-call-host-shell.js?v=1';
      script.defer = true;
      script.dataset.tasklyPersistentCallHost = '1';
      doc.head.append(script);
    }
  } else {
    document.documentElement.dataset.tasklyCallHost = '1';
    document.body?.setAttribute('data-taskly-call-host', '1');
    // The underlying chat page must stay alive for authentication and WebRTC,
    // but must not be visible under the green call window.
    document.addEventListener('DOMContentLoaded', () => {
      document.body?.setAttribute('data-taskly-call-host', '1');
    }, {once:true});
  }

  const proto = window.TasklyCallUI?.prototype;
  if (!proto || proto.__tasklyCallFloating) return;
  Object.defineProperty(proto, '__tasklyCallFloating', {value:true});

  const originalSelect = proto.select;
  if (typeof originalSelect === 'function') {
    proto.select = function (id, name, enabled) {
      const result = originalSelect.apply(this, arguments);
      if (isHost) {
        ui = this;
        if (!started && enabled && Number(id) === selectedId && ['audio','video'].includes(requestedMode)) {
          started = true;
          // UI selection is already validated by GET /api/demandes/:id/chat.
          Promise.resolve().then(() => this.start(requestedMode));
        }
      }
      return result;
    };
  }


  function addCallToolbar(dialog, instance) {
    if (!isHost || !dialog || dialog.querySelector('.tc-floating-tools')) return;
    const panel = dialog.querySelector('.tc-panel');
    if (!panel) return;
    const badge = document.createElement('p');
    badge.className = 'tc-floating-secure';
    badge.textContent = '● Connexion sécurisée';
    const bar = document.createElement('div');
    bar.className = 'tc-floating-tools';
    bar.setAttribute('role','group');
    bar.setAttribute('aria-label','Commandes de l’appel');
    const commands = [
      ['mic','Micro','🎙'],
      ['sound','Son','◖))'],
      ['chat','Messagerie','▤'],
      ['camera','Caméra','▣'],
      ['max','Agrandir','⤢'],
      ['end','Raccrocher','☎']
    ];
    const buttons = {};
    for (const [name,label,symbol] of commands) {
      const btn = document.createElement('button');
      btn.type='button'; btn.className='tc-floating-control';
      btn.dataset.tcFloating=name;
      btn.setAttribute('aria-label',label);
      const pictogram = document.createElement('span');
      pictogram.className='tc-floating-control-icon';
      pictogram.setAttribute('aria-hidden','true');
      pictogram.textContent=symbol;
      const nameLabel=document.createElement('small'); nameLabel.textContent=label;
      btn.append(pictogram,nameLabel); bar.append(btn); buttons[name]=btn;
    }
    buttons.mic.addEventListener('click', () => {
      if (!instance.active) return;
      instance.toggleMicrophone();
      buttons.mic.querySelector('small').textContent = instance.active?.microphone ? 'Micro' : 'Réactiver';
      buttons.mic.setAttribute('aria-pressed',String(!instance.active?.microphone));
    });
    buttons.sound.addEventListener('click', async () => {
      const remote = instance.get?.('remote');
      if (!remote || !instance.active) return;
      if (remote.paused) {
        // A real user click can unlock audio blocked by autoplay policy.
        remote.muted = false;
        try { await remote.play(); }
        catch { instance.status('Cliquez sur Son pour réactiver la lecture audio.'); return; }
      } else remote.muted = !remote.muted;
      buttons.sound.querySelector('small').textContent = remote.muted ? 'Activer son' : 'Son';
      buttons.sound.setAttribute('aria-pressed',String(remote.muted));
    });
    buttons.chat.addEventListener('click', () => notify('taskly:call-host-action',{action:'chat'}));
    buttons.max.addEventListener('click', () => notify('taskly:call-host-action',{action:'max'}));
    buttons.camera.addEventListener('click', () => {
      if (!instance.active || instance.active.mode !== 'video') return;
      instance.toggleCamera();
      buttons.camera.querySelector('small').textContent = instance.active?.camera ? 'Caméra' : 'Réactiver';
      buttons.camera.setAttribute('aria-pressed',String(!instance.active?.camera));
    });
    buttons.end.addEventListener('click', () => {
      if (instance.active) void instance.finish(instance.active.incoming && !instance.active.accepted ? 'reject' : 'end');
    });
    panel.append(badge,bar);
  }

  const originalShow = proto.show;
  if (typeof originalShow === 'function') {
    proto.show = function (context, mode, incoming, ...rest) {
      if (!isHost && incoming && !this.active) {
        const host = parentHost();
        if (host?.open(role(), context?.id, 'receive')) {
          // Existing poller sets `.id` on return; no media session is started
          // in the disposable messaging iframe.
          return {id:null};
        }
      }
      const result = originalShow.call(this, context, mode, incoming, ...rest);
      if (isHost) {
        ui = this;
        addCallToolbar(this.dialog,this);
        notify('taskly:call-host-mode', {mode});
      }
      return result;
    };
  }

  const originalPoll = proto.poll;
  if (typeof originalPoll === 'function') {
    proto.poll = function (...args) {
      if (!isHost && !this.active && parentHost()?.isActive()) return;
      return originalPoll.apply(this, args);
    };
  }

  const originalFinish = proto.finish;
  if (typeof originalFinish === 'function') {
    proto.finish = async function (...args) {
      if (isHost) finishing.add(this);
      try { return await originalFinish.apply(this, args); }
      finally {
        if (isHost) { finishing.delete(this); notify('taskly:call-host-ended'); }
      }
    };
  }
  const originalCleanup = proto.cleanup;
  if (typeof originalCleanup === 'function') {
    proto.cleanup = function (...args) {
      const wasActive = isHost && Boolean(this.active);
      const result = originalCleanup.apply(this, args);
      if (wasActive && !finishing.has(this)) {
        // Remote hangup or another-device transfer.
        notify('taskly:call-host-ended');
      }
      return result;
    };
  }

  document.addEventListener('click', event => {
    if (isHost || event.defaultPrevented) return;
    const button = event.target.closest?.('#cw-call-audio, #cw-call-video');
    if (!button || button.disabled || !event.isTrusted) return;
    const id = Number(document.body?.dataset.tasklyCallConversation);
    if (!Number.isSafeInteger(id) || id < 1) return;
    const mode = button.id === 'cw-call-video' ? 'video' : 'audio';
    const manager = parentHost();
    if (!manager) return; // Safe legacy behavior if the host is not yet loaded.
    if (manager.open(role(), id, mode)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    } else {
      event.preventDefault(); event.stopImmediatePropagation();
      const status = document.getElementById('cw-status');
      if (status) status.textContent = 'Terminez d’abord l’appel en cours.';
    }
  }, true);

  if (isHost) {
    window.addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== window.parent) return;
      if (event.data?.type !== 'taskly:call-host-command') return;
      if (event.data.action === 'close') {
        if (ui?.active) void ui.finish(ui.active.incoming && !ui.active.accepted ? 'reject' : 'end');
        else notify('taskly:call-host-ended');
      }
      if (typeof event.data.action === 'string' && event.data.action.startsWith('layout:')) {
        const layout = event.data.action.slice(7);
        if (['min','normal','max'].includes(layout)) document.documentElement.dataset.tasklyCallWindowState = layout;
      }
    });
    notify('taskly:call-host-ready');
  }
  window.TasklyCallFloating = Object.freeze({version:1, isHost});
})();
