'use strict';

(function () {

    class TasklyCallUI {

        constructor(api, role) {

            this.api = api;
            this.role = role;
            this.context = null;
            this.active = null;
            this.polling = false;

            this.audio = document.getElementById('cw-call-audio');
            this.video = document.getElementById('cw-call-video');

            this.dialog = document.createElement('dialog');
            this.dialog.className = 'taskly-call-dialog';

            this.dialog.innerHTML = `
                <div class="tc-panel">
                    <h2>Appel Taskly</h2>
                    <p data-tc="name"></p>
                    <p data-tc="status" role="status"></p>
                    <div class="tc-videos">
                        <video data-tc="remote" autoplay playsinline></video>
                        <video data-tc="local" autoplay muted playsinline></video>
                    </div>
                    <div class="tc-actions">
                        <button type="button" data-tc="ring" hidden>Activer la sonnerie</button>
                        <button type="button" data-tc="accept" hidden>Accepter</button>
                        <button type="button" data-tc="reject" hidden>Refuser</button>
                        <button type="button" data-tc="mic" hidden>Micro</button>
                        <button type="button" data-tc="camera" hidden>Camera</button>
                        <button type="button" data-tc="sound" hidden>Activer le son</button>
                        <button type="button" data-tc="end">Raccrocher</button>
                    </div>
                </div>
            `;

            document.body.append(this.dialog);

            this.audio?.addEventListener('click', () => this.start('audio'));
            this.video?.addEventListener('click', () => this.start('video'));

            this.get('accept').onclick = () => this.accept();
            this.get('reject').onclick = () => this.finish('reject');
            this.get('end').onclick = () => this.finish('end');

            this.get('mic').onclick = () => this.toggleMicrophone();
            this.get('camera').onclick = () => this.toggleCamera();

            this.get('sound').onclick = async () => {
                try {
                    await this.get('remote').play();
                    this.get('sound').hidden = true;
                } catch {
                    this.status('Lecture audio indisponible.');
                }
            };

            this.dialog.addEventListener('cancel', e => {
                e.preventDefault();
                this.finish(
                    this.active?.incoming && !this.active?.accepted
                    ? 'reject' : 'end'
                );
            });

            this.ringTimer = null;
            this.ringOsc = null;
            this.audioContext = null;

            this.unlockHandler = () => this.unlockRing();

            document.addEventListener('pointerdown', this.unlockHandler);
            document.addEventListener('click', this.unlockHandler);
            document.addEventListener('keydown', this.unlockHandler);

            this.get('ring').onclick = () => this.unlockRing();

            this.timer = setInterval(() => this.poll(), 2500);

            window.addEventListener('pagehide', () => {
                clearInterval(this.timer);
                document.removeEventListener('click', this.unlockHandler);
                this.stopRing();

                document.removeEventListener(
                    'pointerdown', this.unlockHandler
                );

                document.removeEventListener(
                    'keydown', this.unlockHandler
                );

                this.audioContext?.close().catch(() => {});

                if (this.active) {
                    this.cleanup(this.active);
                }
            }, { once: true });

            this.updateButtons();
        }

        async unlockRing() {
            try {
                const Audio = window.AudioContext ||
                    window.webkitAudioContext;

                if (!Audio) return;

                if (!this.audioContext) {
                    this.audioContext = new Audio();
                }

                if (this.audioContext.state !== 'running' && this.audioContext.state !== 'closed') {
                    await this.audioContext.resume();
                }

                this.startRing();

            } catch {
                // La notification visuelle reste disponible.
            }
        }

        startRing() {

            const call = this.active;

            if (!call || call.accepted || call.pending || (!call.incoming && !call.id)) {
                return;
            }

            const ctx = this.audioContext;

            if (!ctx || ctx.state !== 'running') {
                this.get('ring').hidden = false;
                return;
            }

            this.get('ring').hidden = true;

            if (this.ringTimer !== null) return;

            const beep = () => {

                if (this.active !== call ||
                    call.accepted || call.pending) {
                    this.stopRing();
                    return;
                }

                if (ctx.state !== 'running') {
                    this.stopRing();
                    this.get('ring').hidden = false;
                    return;
                }

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                this.ringOsc = osc;

                osc.type = 'sine';
                osc.frequency.setValueAtTime(
                    call.incoming ? 660 : 440, ctx.currentTime
                );

                osc.frequency.setValueAtTime(
                    call.incoming ? 880 : 480, ctx.currentTime + 0.15
                );

                gain.gain.setValueAtTime(
                    0.0001, ctx.currentTime
                );

                gain.gain.exponentialRampToValueAtTime(
                    0.12, ctx.currentTime + 0.03
                );

                gain.gain.exponentialRampToValueAtTime(
                    0.0001, ctx.currentTime + 0.35
                );

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.onended = () => {
                    osc.disconnect();
                    gain.disconnect();
                    if (this.ringOsc === osc) {
                        this.ringOsc = null;
                    }
                };

                osc.start();
                osc.stop(ctx.currentTime + 0.36);
            };

            this.ringTimer = setInterval(beep, 2000);
            beep();
        }

        stopRing() {

            clearInterval(this.ringTimer);
            this.ringTimer = null;

            if (this.ringOsc) {
                try { this.ringOsc.stop(); } catch {}
                this.ringOsc = null;
            }

            this.get('ring').hidden = true;
        }

        get(name) {
            return this.dialog.querySelector('[data-tc="' + name + '"]');
        }

        select(id, name, enabled) {

            this.context = enabled && Number.isSafeInteger(id) && id > 0
                ? { id, name }
                : null;

            document.body.dataset.tasklyCallConversation =
                this.context ? String(this.context.id) : '';

            this.updateButtons();
        }

        updateButtons() {
            const disabled = !this.context || Boolean(this.active);

            if (this.audio) this.audio.disabled = disabled;
            if (this.video) this.video.disabled = disabled;
        }

        status(message) {
            this.get('status').textContent = message;
        }

        notify(message) {
            const status = document.getElementById('cw-status');
            if (status) status.textContent = message;
        }

        async request(id, body) {
            const url = '/api/demandes/' + id + '/chat/call';

            return body
                ? this.api(url, {
                    method: 'POST',
                    body: JSON.stringify(body)
                })
                : this.api(url);
        }

        show(context, mode, incoming, transport = 'webrtc', e2eeRequired = false) {

            const call = {
                context,
                mode,
                incoming,
                transport,
                e2eeRequired: e2eeRequired === true,
                e2eeSession: null,
                e2eeKey: null,
                e2eePeerPublicKey: null,
                accepted: false,
                pending: false,
                microphone: true,
                camera: true,
                answerApplied: false,
                lastSignalAt: Date.now(),
                lastHeartbeatAt: 0,
                disconnectedAt: null,
                createdAt: Date.now(),
                id: null
            };

            call.media = new (
                call.e2eeRequired
                    ? window.TasklyCallLiveKitE2EE
                    : transport === 'livekit'
                        ? window.TasklyCallLiveKit
                        : window.TasklyCallMedia
            )(
                stream => {
                    if (this.active !== call) return;

                    const remote = this.get('remote');
                    remote.srcObject = stream;

                    remote.play().catch(() => {
                        if (this.active === call) {
                            this.get('sound').hidden = false;
                        }
                    });
                },
                state => {
                    if (this.active !== call) return;

                    if (state === 'connected') {
                        call.disconnectedAt = null;
                        this.status('Appel en cours');
                    } else if (state === 'disconnected') {
                        call.disconnectedAt = Date.now();
                        this.status('Reconnexion en cours...');
                    } else if (state === 'failed') {
                        this.finish('end', 'Connexion impossible.');
                    }
                },
                stream => {
                    if (this.active === call) {
                        this.get('local').srcObject = stream;
                    }
                },
                () => this.get('remote')
            );

            this.active = call;
            document.body.dataset.tasklyCallActive = '1';
            this.get('name').textContent = context.name;
            this.dialog.dataset.mode = mode;

            this.get('accept').hidden = !incoming;
            this.get('reject').hidden = !incoming;
            this.get('end').hidden = incoming;
            this.get('mic').hidden = true;
            this.get('camera').hidden = true;
            this.get('sound').hidden = true;

            this.status(incoming
                ? 'Appel ' + (mode === 'video' ? 'video' : 'audio') + ' entrant'
                : 'Preparation de votre appel...');

            if (!this.dialog.open) this.dialog.showModal();

            if (incoming) this.startRing();

            this.updateButtons();

            return call;
        }


        async connectLiveKit(call) {
            if (this.active !== call ||
                call.transport !== 'livekit') {
                throw new Error('Appel annule.');
            }

            // Fail closed : la cle n'est derivée qu'apres un accord ECDH confirme.
            if (call.e2eeRequired &&
                (!(call.e2eeKey instanceof ArrayBuffer) || call.e2eeKey.byteLength !== 32)) {
                throw new Error('Echange de cles E2EE non confirme.');
            }

            const data = await this.api(
                '/api/demandes/' +
                call.context.id +
                '/chat/call/livekit-token',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        id: call.id,
                        ...(call.e2eeRequired ? { e2eeRequired: true } : {})
                    })
                }
            );

            if ((data?.e2eeRequired === true) !== call.e2eeRequired) {
                throw new Error('Chiffrement non confirme par le serveur.');
            }

            if (this.active !== call) {
                throw new Error('Appel annule.');
            }

            const url = data?.url || data?.livekitUrl;
            const token = data?.token || data?.jeton;

            if (!url || !token) {
                throw new Error('Jeton LiveKit indisponible.');
            }

            const key = call.e2eeRequired
                ? call.e2eeKey.slice(0)
                : null;

            let stream;
            try {
                stream = await call.media.connect({
                    url,
                    token,
                    mode: call.mode,
                    ...(call.e2eeRequired ? {
                        e2eeRequired: true,
                        e2eeKey: key
                    } : {})
                });
            } finally {
                // La cle copiee est effacee apres importation par le SDK.
                if (key) new Uint8Array(key).fill(0);
            }

            if (this.active !== call) {
                throw new Error('Appel annule.');
            }

            if (stream) this.get('local').srcObject = stream;
        }


        async start(mode) {
            if (!this.context || this.active || this.starting) return;

            this.starting = true;
            const context = this.context;
            let call = null;

            try {
                const configuration = await this.request(context.id);

                if (!this.context ||
                    this.context.id !== context.id ||
                    this.active) return;

                const livekit = configuration.livekitEnabled === true &&
                    typeof window.TasklyCallLiveKit === 'function' &&
                    Boolean(window.LivekitClient?.Room);

                const e2eeRequired = configuration.e2eeRequired === true;

                if (e2eeRequired) {
                    if (!livekit) {
                        throw new Error('LiveKit requis pour un appel chiffre.');
                    }
                    if (!window.TasklyE2EEAutoKeys?.create) {
                        throw new Error('Echange automatique E2EE indisponible.');
                    }
                    await window.TasklyE2EESdk?.load();
                    if (typeof window.TasklyCallLiveKitE2EE !== 'function') {
                        throw new Error('Pilote E2EE V20 indisponible.');
                    }
                    if (!this.context || this.context.id !== context.id || this.active) return;
                }

                const transport = e2eeRequired
                    ? 'livekit' : (livekit ? 'livekit' : 'webrtc');

                call = this.show(context, mode, false, transport, e2eeRequired);
                call.pending = true;
                if (e2eeRequired) {
                    call.e2eeSession = await window.TasklyE2EEAutoKeys.create();
                    if (this.active !== call) return;
                }

                let sdp;

                if (transport === 'webrtc') {
                    const stream = await call.media.prepare(mode);

                    if (this.active !== call) return;
                    this.get('local').srcObject = stream;

                    sdp = await call.media.createOffer();

                    if (this.active !== call) return;
                }

                const demande = {
                    action: 'start',
                    mode,
                    transport,
                    ...(call.e2eeRequired ? {
                        e2eeRequired: true,
                        e2eePublicKey: call.e2eeSession.publicKey
                    } : {})
                };

                if (sdp) demande.sdp = sdp;

                const data = await this.request(context.id, demande);

                if (!data.call?.id) {
                    throw new Error('Invitation non confirmee.');
                }

                call.id = data.call.id;
                call.lastSignalAt = Date.now();

                if (this.active !== call) {
                    await this.request(context.id, {
                        action: 'end',
                        id: call.id
                    }).catch(() => {});
                    return;
                }

                this.status('En attente de votre interlocuteur...');

                this.get('mic').hidden = transport === 'livekit';
                this.get('camera').hidden =
                    transport === 'livekit' || mode !== 'video';

            } catch (error) {
                if (call && this.active === call) {
                    this.cleanup(call);
                }
                this.notify(error.message || 'Appel impossible.');

            } finally {
                this.starting = false;

                if (call) {
                    call.pending = false;

                    if (this.active === call && call.id) {
                        this.startRing();
                    }
                }
            }
        }


        async waitForE2EEConfirmation(call) {
            // Le serveur transporte une preuve HMAC, jamais la cle secrete.
            for (let i = 0; i < 30; i++) {
                if (this.active !== call) throw new Error('Appel annule.');
                const result = await this.request(call.context.id);
                const remote = result.call;
                if (!remote || remote.id !== call.id || remote.state !== 'accepted') {
                    throw new Error('Appel E2EE termine ou modifie.');
                }
                if (remote.e2eeCallerProof) {
                    const valid = await window.TasklyE2EEAutoKeys.verify(
                        call.e2eeKey,call.id,'caller',remote.e2eeCallerProof
                    );
                    if (!valid) throw new Error('Confirmation E2EE incorrecte.');
                    return;
                }
                await new Promise(resolve => setTimeout(resolve,400));
            }
            throw new Error('Confirmation E2EE expiree.');
        }

        async accept() {
            const call = this.active;

            if (!call?.incoming ||
                call.pending || call.accepted) return;

            if (call.e2eeRequired &&
                (!window.TasklyE2EEAutoKeys?.create || !call.e2eePeerPublicKey)) {
                this.status('Echange E2EE non disponible.');
                return;
            }

            call.pending = true;
            this.get('accept').hidden = true;
            this.get('reject').hidden = true;
            this.get('end').hidden = false;
            this.stopRing();
            this.status('Connexion en cours...');

            try {
                let sdp;
                let e2eeAnswer = null;
                if (call.e2eeRequired) {
                    call.e2eeSession = await window.TasklyE2EEAutoKeys.create();
                    call.e2eeKey = await window.TasklyE2EEAutoKeys.derive(
                        call.e2eeSession, call.e2eePeerPublicKey,
                        call.id, call.context.id
                    );
                    e2eeAnswer = {
                        e2eePublicKey: call.e2eeSession.publicKey,
                        e2eeProof: await window.TasklyE2EEAutoKeys.proof(
                            call.e2eeKey,call.id,'accept'
                        )
                    };
                }

                if (call.transport === 'webrtc') {
                    const stream = await call.media.prepare(call.mode);

                    if (this.active !== call) return;
                    this.get('local').srcObject = stream;

                    sdp = await call.media.createAnswer(call.offer);

                    if (this.active !== call) return;
                }

                const demande = {
                    action: 'accept',
                    id: call.id,
                    transport: call.transport,
                    ...(call.e2eeRequired ? {
                        e2eeRequired: true,
                        ...e2eeAnswer
                    } : {})
                };

                if (sdp) demande.sdp = sdp;

                await this.request(call.context.id, demande);

                if (this.active !== call) return;

                call.accepted = true;
                call.lastSignalAt = Date.now();

                if (call.transport === 'livekit') {
                    if (call.e2eeRequired) await this.waitForE2EEConfirmation(call);
                    await this.connectLiveKit(call);
                }

                if (this.active !== call) return;

                this.get('mic').hidden = false;
                this.get('camera').hidden = call.mode !== 'video';

            } catch (error) {
                if (this.active === call) {
                    await this.finish(
                        'end',
                        error.message || 'Connexion impossible.'
                    );
                }

            } finally {
                call.pending = false;
            }
        }

        async poll() {

            const current = this.active;
            const now = Date.now();

            if (current) {

                if (current.pending &&
                    now - current.createdAt > 120000) {

                    this.finish('end', 'Preparation expiree.');
                    return;
                }

                if (!current.pending &&
                    current.disconnectedAt !== null &&
                    now - current.disconnectedAt > 20000) {

                    this.finish('end', 'Connexion perdue.');
                    return;
                }

                if (!current.pending && current.id &&
                    now - current.lastSignalAt > 45000) {

                    this.finish('end', 'Signalisation perdue.');
                    return;
                }
            }

            if (this.polling || this.active?.pending) return;

            const active = this.active;
            const context = active?.context || this.context;

            if (!context) return;

            if (!active) {

                if (document.visibilityState !== 'visible')
                    return;

                if (Date.now() - (this.lastIdlePoll || 0) < 10000)
                    return;

                this.lastIdlePoll = Date.now();
            }

            this.polling = true;

            try {

                const heartbeatDue = active?.accepted &&
                    active.id &&
                    Date.now() - active.lastHeartbeatAt >= 15000;

                if (heartbeatDue) {
                    active.lastHeartbeatAt = Date.now();
                }

                const data = heartbeatDue
                    ? await this.request(context.id, {
                        action: 'heartbeat',
                        id: active.id
                    })
                    : await this.request(context.id);

                if (active && this.active === active) {
                    active.lastSignalAt = Date.now();

                    if (heartbeatDue) {
                        active.lastHeartbeatAt = Date.now();
                    }
                }
                const remote = data.call;

                if (this.active !== active) return;

                if (!active && this.context?.id !== context.id) return;

                if (!active) {

                    if (remote?.state === 'ringing' &&
                        remote.callerRole !== this.role) {

                        if (remote.transport === 'livekit' &&
                            (!window.TasklyCallLiveKit ||
                             !window.LivekitClient?.Room)) {
                            this.notify('LiveKit indisponible sur ce navigateur.');
                            return;
                        }

                        const e2eeRequired = remote.e2eeRequired === true;
                        if (e2eeRequired) {
                            if (remote.transport !== 'livekit' ||
                                typeof window.TasklyCallLiveKitE2EE !== 'function') {
                                this.notify('Appel chiffre incompatible.');
                                return;
                            }
                            try {
                                await window.TasklyE2EESdk?.load();
                            } catch {
                                this.notify('Chiffrement non disponible sur cet appareil.');
                                return;
                            }
                            if (this.active || this.context?.id !== context.id) return;
                        }

                        const incoming = this.show(
                            context,
                            remote.mode,
                            true,
                            remote.transport === 'livekit'
                                ? 'livekit' : 'webrtc',
                            e2eeRequired
                        );

                        incoming.id = remote.id;
                        incoming.offer = remote.offer;
                        if (e2eeRequired) incoming.e2eePeerPublicKey = remote.e2eeOfferKey;
                    }

                    return;
                }

                if (active.pending || !active.id) return;

                if (remote && active.e2eeRequired !==
                    (remote.e2eeRequired === true)) {
                    await this.finish('end', 'Mode E2EE modifie : appel interrompu.');
                    return;
                }

                if (!remote || remote.id !== active.id ||
                    ['ended', 'rejected'].includes(remote.state)) {

                    this.cleanup(active);

                    this.notify(remote?.state === 'rejected'
                        ? 'Appel refuse.'
                        : 'Appel termine.');

                    return;
                }

                if (active.incoming &&
                    remote.state === 'accepted' && !active.accepted) {

                    this.cleanup(active);
                    this.notify('Appel pris sur un autre appareil.');
                    return;
                }

                if (!active.incoming &&
                    remote.state === 'accepted' &&
                    !active.answerApplied) {

                    active.answerApplied = true;
                    active.accepted = true;

                    this.stopRing();
            this.status('Connexion en cours...');

                    try {
                        if (active.e2eeRequired) {
                            if (!active.e2eeSession || !remote.e2eeAnswerKey ||
                                !remote.e2eeAcceptProof) {
                                throw new Error('Echange E2EE incomplet.');
                            }
                            active.e2eeKey = await window.TasklyE2EEAutoKeys.derive(
                                active.e2eeSession,remote.e2eeAnswerKey,
                                active.id,active.context.id
                            );
                            const ok = await window.TasklyE2EEAutoKeys.verify(
                                active.e2eeKey,active.id,'accept',remote.e2eeAcceptProof
                            );
                            if (!ok) throw new Error('Verification E2EE impossible.');
                            await this.request(active.context.id, {
                                action:'e2ee-confirm',id:active.id,
                                e2eeRequired:true,
                                e2eeProof:await window.TasklyE2EEAutoKeys.proof(
                                    active.e2eeKey,active.id,'caller'
                                )
                            });
                        }
                        if (active.transport === 'livekit') {
                            await this.connectLiveKit(active);

                            if (this.active === active) {
                                this.get('mic').hidden = false;
                                this.get('camera').hidden =
                                    active.mode !== 'video';
                            }
                        } else {
                            await active.media.applyAnswer(remote.answer);
                        }
                    } catch {
                        await this.finish('end', 'Connexion impossible.');
                    }
                }

            } catch (error) {

                if (active && this.active === active) {

                    if ([401, 403, 404, 409].includes(error.status)) {
                        this.cleanup(active);
                        this.notify('Appel indisponible.');
                    } else {
                        this.status('Signalisation indisponible...');
                    }
                }

            } finally {
                this.polling = false;
            }
        }

        toggleMicrophone() {
            const call = this.active;
            if (!call) return;

            call.microphone = !call.microphone;
            Promise.resolve(
                call.media.setMicrophone(call.microphone)
            ).catch(() => {
                if (this.active === call) {
                    this.status('Microphone indisponible.');
                }
            });

            this.get('mic').textContent = call.microphone
                ? 'Micro' : 'Reactiver le micro';
        }

        toggleCamera() {
            const call = this.active;
            if (!call || call.mode !== 'video') return;

            call.camera = !call.camera;
            Promise.resolve(
                call.media.setCamera(call.camera)
            ).catch(() => {
                if (this.active === call) {
                    this.status('Camera indisponible.');
                }
            });

            this.get('camera').textContent = call.camera
                ? 'Camera' : 'Reactiver la camera';
        }

        async finish(action, message) {

            const call = this.active;
            if (!call) return;

            this.cleanup(call);

            this.notify(message || 'Appel termine.');

            if (call.id) {
                try {
                    await this.request(call.context.id, {
                        action,
                        id: call.id
                    });
                } catch {
                    this.notify(
                        'Appel local termine, confirmation serveur indisponible.'
                    );
                }
            }
        }

        cleanup(call) {

            call.media.close();

            if (this.active !== call) return;

            this.stopRing();
            if (call.e2eeKey) new Uint8Array(call.e2eeKey).fill(0);
            call.e2eeKey = null;
            call.e2eeSession = null;
            delete document.body.dataset.tasklyCallActive;
            this.active = null;
            this.get('local').srcObject = null;
            this.get('remote').srcObject = null;

            this.get('mic').textContent = 'Micro';
            this.get('camera').textContent = 'Camera';

            if (this.dialog.open) this.dialog.close();

            this.updateButtons();
        }
    }

    window.TasklyCallUI = TasklyCallUI;

})();