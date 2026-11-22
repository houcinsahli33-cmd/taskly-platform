'use strict';
// Premium calling UI + phone-style ring: self-hosted, no external service.
(function loadTasklyPremium() {
    if (document.querySelector('script[data-taskly-premium-loader]')) return;
    const script = document.createElement('script');
    script.setAttribute('data-taskly-premium-loader', '1');
    script.src = '/js/taskly-call-premium.js?v=1';
    document.head.appendChild(script);
})();


document.addEventListener('DOMContentLoaded', async () => {
    if (!document.querySelector('script[data-taskly-persistent-call-host]')) {
        const persistent = document.createElement('script');
        persistent.dataset.tasklyPersistentCallHost = '1';
        persistent.src = '/js/taskly-call-host-shell.js?v=11';
        document.head.appendChild(persistent);
    }

    await attendreSession();

    const role = window.utilisateurCourant?.role;

    if (!['client', 'artisan'].includes(role)) return;



    const frame = document.querySelector(
        'iframe[id$="content-frame"]'
    );

    if (!frame) return;

    let current = null;
    let busy = false;
    let closed = false;
    let last = 0;
    let audio = null;
    let ringTimer = null;
    let oscillator = null;
    let snoozedId = null;
    let snoozedUntil = 0;

    const panel = document.createElement('section');

    panel.className = 'taskly-global-call';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Appel entrant');

    panel.innerHTML = `
        <strong>Taskly - Appel entrant</strong>
        <p data-call="name"></p>
        <p data-call="type" role="status"></p>
        <div class="tgc-actions">
            <button type="button" data-call="ring" hidden aria-label="Autoriser le son sur cet appareil">Son</button>
            <button type="button" data-call="reject">
                Refuser
            </button>
            <button type="button" data-call="open">
                Ouvrir l'appel
            </button>
        </div>
    `;

    document.body.append(panel);

    const get = name => panel.querySelector(
        '[data-call="' + name + '"]'
    );

    function suppressed(call) {
        try {
            const data = frame.contentDocument?.body?.dataset;

            return Boolean(window.TasklyCallHost?.isActive()) || Boolean(data?.tasklyCallActive) ||
                data?.tasklyCallConversation ===
                    String(call.demandeId);

        } catch {
            return false;
        }
    }

    function stopRing() {
        window.TasklyPhoneRing?.stop('global');

        clearInterval(ringTimer);
        ringTimer = null;

        if (oscillator) {
            try { oscillator.stop(); } catch {}
            oscillator = null;
        }
    }

    function hide() {
        current = null;
        panel.hidden = true;
        stopRing();
    }

    function ring() {
        if (window.TasklyPhoneRing) {
            if (!current || suppressed(current)) {
                window.TasklyPhoneRing.stop('global');
                return;
            }
            const call = current;
            const playing = window.TasklyPhoneRing.start('global',
                () => current?.id === call.id && !suppressed(current),
                'incoming');
            get('ring').hidden = playing;
            return;
        }

        if (!current) return;

        if (!audio || audio.state !== 'running') {
            stopRing();
            get('ring').hidden = false;
            return;
        }

        get('ring').hidden = true;

        if (ringTimer !== null) return;

        const beep = () => {

            if (!current || suppressed(current)) {

                hide();
                return;
            }

            const osc = audio.createOscillator();
            const gain = audio.createGain();

            oscillator = osc;

            osc.type = 'sine';

            osc.frequency.setValueAtTime(
                660, audio.currentTime
            );

            osc.frequency.setValueAtTime(
                880, audio.currentTime + 0.15
            );

            gain.gain.setValueAtTime(
                0.10, audio.currentTime
            );

            gain.gain.exponentialRampToValueAtTime(
                0.001, audio.currentTime + 0.35
            );

            osc.connect(gain);
            gain.connect(audio.destination);

            osc.onended = () => {
                osc.disconnect();
                gain.disconnect();

                if (oscillator === osc) oscillator = null;
            };

            osc.start();
            osc.stop(audio.currentTime + 0.36);
        };

        ringTimer = setInterval(beep, 2000);
        beep();
    }

    // Une interaction utilisateur peut debloquer le son alors que la fenetre
    // d'appel persistante est deja ouverte. Ne pas appeler ring() dans ce cas :
    // ring() ignore volontairement l'overlay et arreterait la sonnerie globale.
    function reprendreSonnerieEntrante() {
        if (closed || !current) return;
        if (window.TasklyCallHost?.isActive()) {
            const id = current.id;
            window.TasklyPhoneRing?.start('global',
                () => current?.id === id && Boolean(window.TasklyCallHost?.isActive()),
                'incoming');
            return;
        }
        ring();
    }

    async function unlock() {
        if (window.TasklyPhoneRing) {
            if (!closed) {
                if (await window.TasklyPhoneRing.unlock()) {
                    reprendreSonnerieEntrante();
                }
            }
            return;
        }
        if (closed) return;

        try {
            const Audio = window.AudioContext ||
                window.webkitAudioContext;

            if (!Audio) return;

            if (!audio) audio = new Audio();

            if (audio.state !== 'running' && audio.state !== 'closed') {
                await audio.resume();
            }

            if (!closed) ring();

        } catch {}
    }

    function bindFrame() {
        try {
            const doc = frame.contentDocument;

            doc?.addEventListener('pointerdown', unlock);
            doc?.addEventListener('click', unlock);
            doc?.addEventListener('keydown', unlock);
        } catch {}
    }

    document.addEventListener('pointerdown', unlock);
    document.addEventListener('click', unlock);
    get('ring').onclick = unlock;
    document.addEventListener('keydown', unlock);

    frame.addEventListener('load', bindFrame);
    window.addEventListener('taskly:persistent-call-connected', () => {
        current = null;
        stopRing();
        panel.hidden = true;
    });
    window.addEventListener('taskly:persistent-call-ended', () => {
        hide();
    });

    bindFrame();

    function show(call) {

        if (current?.id !== call.id) {
            stopRing();
        }

        current = call;

        // Use the existing persistent authenticated call window directly.
        // Never overlay a second acceptance banner on top of it.
        if (window.TasklyCallHost?.open?.(role, call.demandeId, 'receive')) {
            panel.hidden = true;
            // Audio plays only if the browser has already allowed sound.
            window.TasklyPhoneRing?.start('global',
                () => current?.id === call.id && Boolean(window.TasklyCallHost?.isActive()),
                'incoming');
            return;
        }

        get('name').textContent =
            call.nom || 'Interlocuteur';

        get('type').textContent =
            call.mode === 'video'
            ? 'Appel video entrant...'
            : 'Appel audio entrant...';

        panel.hidden = false;

        ring();
    }

    async function refresh() {

        if (closed || busy || Date.now() - last < 5000) return;

        busy = true;
        last = Date.now();

        try {
            const data = await requeteAPI(
                '/api/demandes/chat/calls/incoming'
            );

            if (closed) return;

            const calls = Array.isArray(data.appels)
                ? data.appels : [];

            const call = calls.find(c =>
                Number.isSafeInteger(c.demandeId) &&
                c.demandeId > 0 &&
                c.demandeId <= 2147483647 &&
                typeof c.id === 'string' &&
                ['audio', 'video'].includes(c.mode) &&
                (!suppressed(c) || (current?.id === c.id && window.TasklyCallHost?.isActive())) &&
                !(c.id === snoozedId &&
                    Date.now() < snoozedUntil)
            );

            if (call) {
                show(call);
            } else {
                hide();
            }

        } catch (error) {
            hide();

            if ([401, 403, 404].includes(error.status)) {
                clearInterval(timer);
            }
        } finally {
            busy = false;
        }
    }

    get('open').onclick = () => {

        const call = current;

        if (!call || suppressed(call)) {
            hide();
            return;
        }

        snoozedId = call.id;
        snoozedUntil = Date.now() + 15000;

        hide();

        // Prefer the persistent authenticated call window, preserve the existing fallback.
        if (window.TasklyCallHost?.open?.(role, call.demandeId, 'receive')) return;
        dispatchEvent(new CustomEvent('taskly:open-call', {
            detail: { demandeId: call.demandeId }
        }));
    };

    get('reject').onclick = async () => {

        const call = current;

        if (!call) return;

        snoozedId = call.id;
        snoozedUntil = Date.now() + 10000;

        hide();

        try {
            await requeteAPI(
                '/api/demandes/' +
                call.demandeId + '/chat/call',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'reject',
                        id: call.id
                    })
                }
            );

        } catch {
            // Une invitation encore active pourra reapparaitre.
        }
    };

    const timer = setInterval(refresh, 15000);

    // Background tabs may be timer-throttled; preserve an already-authorized
    // incoming call rather than silently muting it on tab switch.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') refresh();
    });

    addEventListener('pagehide', () => {
        closed = true;
        clearInterval(timer);
        hide();
        audio?.close().catch(() => {});
    }, { once: true });

    refresh();
});