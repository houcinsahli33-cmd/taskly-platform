'use strict';

document.addEventListener('DOMContentLoaded', async () => {

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

            return Boolean(data?.tasklyCallActive) ||
                data?.tasklyCallConversation ===
                    String(call.demandeId);

        } catch {
            return false;
        }
    }

    function stopRing() {

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

        if (!current || !audio ||
            audio.state !== 'running' ||
            ringTimer !== null) return;

        const beep = () => {

            if (!current || suppressed(current) ||
                document.visibilityState !== 'visible') {

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

    async function unlock() {
        if (closed) return;

        try {
            const Audio = window.AudioContext ||
                window.webkitAudioContext;

            if (!Audio) return;

            if (!audio) audio = new Audio();

            if (audio.state === 'suspended') {
                await audio.resume();
            }

            if (!closed) ring();

        } catch {}
    }

    function bindFrame() {
        try {
            const doc = frame.contentDocument;

            doc?.addEventListener('pointerdown', unlock);
            doc?.addEventListener('keydown', unlock);
        } catch {}
    }

    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);

    frame.addEventListener('load', bindFrame);

    bindFrame();

    function show(call) {

        if (current?.id !== call.id) {
            stopRing();
        }

        current = call;

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

        if (closed || busy ||
            document.visibilityState !== 'visible' ||
            Date.now() - last < 5000) return;

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
                !suppressed(c) &&
                !(c.id === snoozedId &&
                    Date.now() < snoozedUntil)
            );

            if (call &&
                document.visibilityState === 'visible') {
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

    const timer = setInterval(refresh, 6000);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            refresh();
        } else {
            hide();
        }
    });

    addEventListener('pagehide', () => {
        closed = true;
        clearInterval(timer);
        hide();
        audio?.close().catch(() => {});
    }, { once: true });

    refresh();
});