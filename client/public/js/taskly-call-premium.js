'use strict';

/* Taskly calls: presentation, phone-style ringing, and optional device controls.
   Existing signaling, authentication, LiveKit and Krisp are never replaced. */
(function () {
    if (window.TasklyCallPremium) return;

    const $ = (root, selector) => root?.querySelector(selector);
    const text = (element, value) => {
        if (element && element.textContent !== value) element.textContent = value;
    };
    const setAttr = (element, name, value) => {
        if (element && element.getAttribute(name) !== value) element.setAttribute(name, value);
    };

    // Original, locally generated analogue telephone motif; no audio file or API key.
    // A browser cannot override system volume or its user-gesture/autoplay policy.
    const phone = (() => {
        let ctx = null;
        let owner = null;
        let interval = null;
        let valid = null;
        let mode = 'incoming';
        const nodes = new Set();
        const Audio = window.AudioContext || window.webkitAudioContext;

        async function unlock() {
            if (!Audio) return false;
            try {
                if (!ctx || ctx.state === 'closed') ctx = new Audio();
                if (ctx.state !== 'running') await ctx.resume();
                return ctx.state === 'running';
            } catch { return false; }
        }
        function playBurst(at, duration, outgoing) {
            if (!ctx || ctx.state !== 'running') return;
            // Two-tone cadence close to an ordinary phone ring, capped to avoid clipping.
            const master = ctx.createGain();
            const peak = outgoing ? 0.12 : 0.30;
            master.gain.setValueAtTime(0.0001, at);
            master.gain.linearRampToValueAtTime(peak, at + 0.035);
            master.gain.setValueAtTime(peak, at + duration - 0.07);
            master.gain.linearRampToValueAtTime(0.0001, at + duration);
            master.connect(ctx.destination);
            nodes.add(master);
            const frequencies = outgoing ? [440, 480] : [425, 540];
            for (const frequency of frequencies) {
                const osc = ctx.createOscillator();
                const weight = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(frequency, at);
                weight.gain.value = 0.46;
                osc.connect(weight);
                weight.connect(master);
                nodes.add(osc);
                nodes.add(weight);
                osc.addEventListener('ended', () => {
                    try { osc.disconnect(); weight.disconnect(); } catch {}
                    nodes.delete(osc);
                    nodes.delete(weight);
                }, { once: true });
                osc.start(at);
                osc.stop(at + duration + 0.02);
            }
        }
        function stop(requester) {
            if (requester && requester !== owner) return;
            if (interval !== null) clearInterval(interval);
            interval = null;
            owner = null;
            valid = null;
            for (const node of nodes) {
                try { if (typeof node.stop === 'function') node.stop(); } catch {}
                try { node.disconnect(); } catch {}
            }
            nodes.clear();
        }
        function pulse() {
            if (typeof valid === 'function' && !valid()) { stop(); return; }
            if (!ctx || ctx.state !== 'running') { stop(); return; }
            const t = ctx.currentTime + 0.025;
            const outgoing = mode === 'outgoing';
            playBurst(t, outgoing ? 0.32 : 0.72, outgoing);
            playBurst(t + (outgoing ? 0.65 : 0.92), outgoing ? 0.32 : 0.72, outgoing);
        }
        function start(requester, predicate, requestedMode) {
            if (!ctx || ctx.state !== 'running') return false;
            if (owner === requester && interval !== null) return true;
            stop();
            owner = requester;
            valid = predicate;
            mode = requestedMode === 'outgoing' ? 'outgoing' : 'incoming';
            interval = setInterval(pulse, mode === 'incoming' ? 3600 : 3100);
            pulse();
            return true;
        }
        async function preview() {
            if (!await unlock()) return false;
            start('preview', () => owner === 'preview', 'incoming');
            setTimeout(() => stop('preview'), 1700);
            return true;
        }
        window.addEventListener('pagehide', () => {
            stop();
            if (ctx?.state !== 'closed') ctx?.close().catch(() => {});
        }, { once: true });
        return { unlock, start, stop, preview, get unlocked() { return ctx?.state === 'running'; } };
    })();

    window.TasklyPhoneRing = phone;

    // Unlock only from an actual user's interaction. This improves reliability
    // when an incoming call arrives after the user has navigated on Taskly.
    function tryUnlock() { void phone.unlock(); }
    document.addEventListener('pointerdown', tryUnlock, { passive: true });
    document.addEventListener('keydown', tryUnlock);

    const decorated = new WeakSet();
    const states = new WeakMap();

    function make(tag, className, contents) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (contents !== undefined) element.textContent = contents;
        return element;
    }

    function getCallUI(dialog) { return dialog.__tasklyCallPremiumUI || null; }

    function startClock(dialog) {
        const state = states.get(dialog);
        if (!state || state.startedAt !== null) return;
        state.startedAt = Date.now();
        state.clock = setInterval(() => update(dialog), 1000);
    }
    function stopClock(dialog) {
        const state = states.get(dialog);
        if (!state) return;
        if (state.clock !== null) clearInterval(state.clock);
        state.clock = null;
        state.startedAt = null;
    }

    function renderConversation(dialog) {
        const list = $(dialog, '.tc-premium-chat-history');
        if (!list) return;
        list.replaceChildren();
        const items = [...document.querySelectorAll('#cw-messages > *')].slice(-8);
        if (!items.length) {
            list.append(make('p', 'tc-premium-empty', 'Aucun message dans cette conversation.'));
            return;
        }
        for (const item of items) {
            const line = make('p', 'tc-premium-chat-line', (item.textContent || '').trim().slice(0, 500));
            list.append(line);
        }
    }

    async function updateDevices(dialog) {
        const ui = getCallUI(dialog);
        const room = ui?.active?.media?.room;
        const panel = $(dialog, '.tc-premium-device-panel');
        if (!panel) return;
        const hint = $(panel, '.tc-premium-device-hint');
        const supported = Boolean(room && typeof room.switchActiveDevice === 'function');
        if (!navigator.mediaDevices?.enumerateDevices) {
            text(hint, 'La sélection des appareils n’est pas disponible sur ce navigateur.');
            return;
        }
        let devices;
        try { devices = await navigator.mediaDevices.enumerateDevices(); }
        catch { text(hint, 'Accès aux appareils indisponible.'); return; }
        if (!panel.isConnected) return;
        const kinds = [
            ['audioinput', 'Microphone'],
            ['videoinput', 'Caméra'],
            ['audiooutput', 'Haut-parleur']
        ];
        const host = $(panel, '.tc-premium-device-options');
        host.replaceChildren();
        for (const [kind, label] of kinds) {
            const available = devices.filter(d => d.kind === kind && d.deviceId);
            if (!available.length) continue;
            const row = make('label', 'tc-premium-device-row');
            row.append(make('span', '', label));
            const select = make('select', 'tc-premium-device-select');
            select.setAttribute('aria-label', label);
            select.append(new Option('Choisir…', ''));
            available.forEach((device, index) => select.append(
                new Option(device.label || label + ' ' + (index + 1), device.deviceId)
            ));
            select.disabled = !supported && !(kind === 'audiooutput' && typeof $(dialog, '[data-tc="remote"]')?.setSinkId === 'function');
            select.addEventListener('change', async () => {
                if (!select.value) return;
                select.disabled = true;
                try {
                    if (kind === 'audiooutput' && typeof $(dialog, '[data-tc="remote"]')?.setSinkId === 'function') {
                        await $(dialog, '[data-tc="remote"]').setSinkId(select.value);
                    } else if (room?.switchActiveDevice) {
                        await room.switchActiveDevice(kind, select.value);
                    } else throw new Error('Changement non pris en charge');
                    text(hint, label + ' sélectionné.');
                } catch {
                    text(hint, 'Impossible de changer cet appareil pendant l’appel.');
                } finally { select.disabled = false; }
            });
            row.append(select);
            host.append(row);
        }
        text(hint, supported ? 'Choisissez un appareil pour cet appel.' : 'Certains changements ne sont pas disponibles sur ce navigateur.');
    }

    function update(dialog) {
        const state = states.get(dialog);
        if (!state) return;
        const isOpen = dialog.open;
        if (!isOpen) {
            stopClock(dialog);
            state.drawer.hidden = true;
            state.devices.hidden = true;
            return;
        }
        const mode = dialog.dataset.mode === 'video' ? 'video' : 'audio';
        const accept = $(dialog, '[data-tc="accept"]');
        const status = $(dialog, '[data-tc="status"]')?.textContent || '';
        const person = $(dialog, '[data-tc="name"]')?.textContent || 'Votre correspondant';
        const incoming = Boolean(accept && !accept.hidden);
        const connected = /appel en cours|connecté|connected/i.test(status);
        const reconnecting = /reconnexion|déconnecté|connexion perdue/i.test(status);
        setAttr(dialog, 'data-premium-stage', incoming ? 'incoming' : connected ? 'connected' : reconnecting ? 'reconnecting' : 'connecting');
        text(state.contact, person);
        const first = [...person.trim()][0] || '?';
        text(state.avatar, first.toLocaleUpperCase('fr'));
        text(state.heroAvatar, first.toLocaleUpperCase('fr'));
        text(state.kind, incoming ? 'Appel ' + (mode === 'video' ? 'vidéo' : 'audio') + ' entrant' : 'Appel ' + (mode === 'video' ? 'vidéo' : 'audio'));
        text(state.quality, reconnecting ? 'Reconnexion…' : connected ? 'Connecté via Taskly' : incoming ? 'Appel entrant' : 'Connexion…');
        text(state.qualityIcon, reconnecting ? '!' : connected ? '●' : '◌');
        if (connected) startClock(dialog);
        if (state.startedAt !== null) {
            const seconds = Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
            text(state.duration, String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'));
        } else text(state.duration, '00:00');
        setAttr(state.duration, 'aria-label', 'Durée de l’appel ' + state.duration.textContent);
        state.active = true;
    }

    function decorate(dialog) {
        if (decorated.has(dialog)) return;
        const panel = $(dialog, '.tc-panel');
        if (!panel) return;
        decorated.add(dialog);
        dialog.classList.add('taskly-call-premium');
        const contact = make('section', 'tc-premium-contact');
        const avatar = make('span', 'tc-premium-avatar', '?');
        avatar.setAttribute('aria-hidden', 'true');
        const person = make('strong', 'tc-premium-contact-name', 'Votre correspondant');
        contact.append(avatar, person);
        const callKind = make('span', 'tc-premium-kind', 'Appel Taskly');
        const duration = make('span', 'tc-premium-duration', '00:00');
        const quality = make('span', 'tc-premium-quality-label', 'Connexion…');
        const qualityIcon = make('span', 'tc-premium-quality-icon', '◌');
        const top = make('div', 'tc-premium-top');
        const right = make('div', 'tc-premium-stats');
        right.append(duration, qualityIcon, quality);
        top.append(callKind, right);
        const hero = make('div', 'tc-premium-hero');
        const largeAvatar = make('span', 'tc-premium-avatar-large', '?');
        largeAvatar.setAttribute('aria-hidden', 'true');
        hero.append(largeAvatar);
        const message = make('p', 'tc-premium-note', 'Connexion sécurisée au service d’appels Taskly');
        hero.append(message);
        const bar = make('div', 'tc-premium-extras');
        const devicesButton = make('button', 'tc-premium-extra', '⚙ Appareils');
        const screenButton = make('button', 'tc-premium-extra', '⛶ Plein écran');
        const chatButton = make('button', 'tc-premium-extra', '▤ Conversation');
        for (const button of [devicesButton, screenButton, chatButton]) button.type = 'button';
        bar.append(devicesButton, screenButton, chatButton);
        const devices = make('section', 'tc-premium-device-panel');
        devices.hidden = true;
        devices.append(make('h3', '', 'Appareils audio et vidéo'));
        const deviceOptions = make('div', 'tc-premium-device-options');
        const hint = make('p', 'tc-premium-device-hint', 'Chargement…');
        devices.append(deviceOptions, hint);
        const drawer = make('section', 'tc-premium-chat-drawer');
        drawer.hidden = true;
        drawer.append(make('h3', '', 'Conversation récente'));
        drawer.append(make('div', 'tc-premium-chat-history'));
        const currentHeading = $(panel, 'h2');
        if (currentHeading) currentHeading.textContent = 'Appel Taskly';
        panel.insertBefore(contact, panel.firstChild);
        panel.insertBefore(top, $(panel, '.tc-videos') || null);
        panel.insertBefore(hero, $(panel, '.tc-videos') || null);
        $(panel, '.tc-actions')?.after(bar, devices, drawer);
        states.set(dialog, {
            avatar, heroAvatar: largeAvatar, contact: person, kind: callKind, duration, quality,
            qualityIcon, devices, drawer, startedAt: null, clock: null,
            active: false, scheduled: false
        });
        devicesButton.addEventListener('click', () => {
            devices.hidden = !devices.hidden;
            if (!devices.hidden) {
                drawer.hidden = true;
                void updateDevices(dialog);
            }
        });
        screenButton.addEventListener('click', async () => {
            try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await dialog.requestFullscreen();
            } catch { /* Browser or platform may disallow fullscreen */ }
        });
        chatButton.addEventListener('click', () => {
            drawer.hidden = !drawer.hidden;
            if (!drawer.hidden) {
                devices.hidden = true;
                renderConversation(dialog);
            }
        });
        const observer = new MutationObserver(() => {
            const s = states.get(dialog);
            if (!s || s.scheduled) return;
            s.scheduled = true;
            requestAnimationFrame(() => {
                s.scheduled = false;
                update(dialog);
            });
        });
        observer.observe(dialog, {
            attributes: true, attributeFilter: ['open', 'data-mode'],
            childList: true, characterData: true, subtree: true
        });
        dialog.addEventListener('close', () => { stopClock(dialog); phone.stop('dialog'); });
        update(dialog);
    }

    function patchCallPrototype() {
        const proto = window.TasklyCallUI?.prototype;
        if (!proto || proto.__tasklyPremiumPatched) return;
        proto.__tasklyPremiumPatched = true;
        const originalShow = proto.show;
        const originalStop = proto.stopRing;
        if (typeof originalShow === 'function') {
            proto.show = function (...args) {
                const result = originalShow.apply(this, args);
                if (this.dialog) {
                    this.dialog.__tasklyCallPremiumUI = this;
                    decorate(this.dialog);
                    update(this.dialog);
                }
                return result;
            };
        }
        if (typeof proto.startRing === 'function') {
            proto.startRing = function () {
                const call = this.active;
                if (!call || call.accepted || call.pending || (!call.incoming && !call.id)) {
                    this.stopRing();
                    return;
                }
                const valid = () => this.active === call && !call.accepted && !call.pending && this.dialog?.open;
                const ready = phone.start('dialog', valid, call.incoming ? 'incoming' : 'outgoing');
                if (this.get?.('ring')) this.get('ring').hidden = ready;
            };
        }
        if (typeof proto.unlockRing === 'function') {
            proto.unlockRing = async function () {
                if (await phone.unlock()) this.startRing();
            };
        }
        if (typeof originalStop === 'function') {
            proto.stopRing = function (...args) {
                phone.stop('dialog');
                return originalStop.apply(this, args);
            };
        }
    }

    function addSoundButton() {
        const actions = document.querySelector('.cw-thread-actions');
        if (!actions || actions.querySelector('.tc-premium-bell')) return;
        const button = make('button', 'cw-icon-btn tc-premium-bell', '🔔');
        button.type = 'button';
        button.title = 'Activer et écouter la sonnerie Taskly';
        button.setAttribute('aria-label', 'Tester et activer la sonnerie');
        button.addEventListener('click', async () => {
            const success = await phone.preview();
            button.title = success ? 'Sonnerie activée sur cet appareil' : 'Vérifiez l’autorisation de lecture audio';
        });
        actions.append(button);
    }

    function addGlobalFeatures(panel) {
        if (panel.dataset.tasklyPremium === '1') return;
        panel.dataset.tasklyPremium = '1';
        const header = $(panel, 'strong');
        if (header) text(header, '📞 Appel entrant · Taskly');
        const button = make('button', 'tc-premium-global-open', '💬 Voir la conversation');
        button.type = 'button';
        button.addEventListener('click', () => {
            $(panel, '[data-call="open"]')?.click();
        });
        panel.append(button);
    }

    function ensureStyles() {
        // The dedicated messaging page already loads both styles in its HEAD.
        // The parent Client/Artisan shell also shows incoming-call banners.
        if (!document.querySelector('link[href*="taskly-call-premium.css"]')) {
            const base = document.createElement('link');
            base.rel = 'stylesheet';
            base.href = '/css/taskly-call-premium.css?v=1';
            document.head.append(base);
        }
        if (!document.querySelector('link[href*="taskly-call-maquette-v4.css"]')) {
            const theme = document.createElement('link');
            theme.rel = 'stylesheet';
            theme.href = '/css/taskly-call-maquette-v4.css?v=1';
            document.head.append(theme);
        }
    }

    function setup() {
        ensureStyles();
        patchCallPrototype();
        document.querySelectorAll('.taskly-call-dialog').forEach(decorate);
        document.querySelectorAll('.taskly-global-call').forEach(addGlobalFeatures);
        addSoundButton();
    }
    window.TasklyCallPremium = { setup, unlockSound: phone.unlock, testRingtone: phone.preview, version: 1 };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
    else setup();
    const watcher = new MutationObserver((mutations) => {
        if (mutations.some(m => [...m.addedNodes].some(n => n.nodeType === 1 &&
            (n.matches?.('.taskly-call-dialog, .taskly-global-call') || n.querySelector?.('.taskly-call-dialog, .taskly-global-call'))))) setup();
    });
    watcher.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('pagehide', () => watcher.disconnect(), { once: true });
})();
