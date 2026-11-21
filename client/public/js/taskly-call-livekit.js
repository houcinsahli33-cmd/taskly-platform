'use strict';

(function () {
    class TasklyCallLiveKit {
        constructor(onRemote, onState, onLocal) {
            this.room = null;
            this.stream = null;
            this.remoteStream = null;
            this.onRemote = onRemote;
            this.onState = onState;
            this.onLocal = onLocal;
            this.generation = 0;
            this.mode = null;
        }

        async connect({ url, token, mode }) {
            if (!['audio', 'video'].includes(mode)) {
                throw new Error('Mode LiveKit invalide.');
            }

            if (typeof url !== 'string' ||
                !url.startsWith('wss://') ||
                typeof token !== 'string' ||
                token.length < 20) {
                throw new Error('Connexion LiveKit invalide.');
            }

            const sdk = window.LivekitClient;

            if (!sdk?.Room || !sdk.RoomEvent) {
                throw new Error('SDK LiveKit indisponible.');
            }

            this.close();

            const generation = this.generation;
            const audioCaptureOptions = {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1
            };

            const room = new sdk.Room({
                adaptiveStream: true,
                dynacast: true,
                audioCaptureDefaults: audioCaptureOptions
            });

            this.room = room;
            this.mode = mode;

            const remote = new MediaStream();
            this.remoteStream = remote;

            room.on(sdk.RoomEvent.TrackSubscribed, track => {
                if (this.room !== room) return;

                const mediaTrack = track.mediaStreamTrack;

                if (mediaTrack &&
                    !remote.getTracks().some(t => t.id === mediaTrack.id)) {
                    remote.addTrack(mediaTrack);
                    this.onRemote?.(remote);
                }
            });

            room.on(sdk.RoomEvent.TrackUnsubscribed, track => {
                if (this.room !== room) return;

                const mediaTrack = track.mediaStreamTrack;

                if (mediaTrack) {
                    const old = remote.getTracks().find(
                        t => t.id === mediaTrack.id
                    );

                    if (old) remote.removeTrack(old);
                    this.onRemote?.(remote);
                }
            });

            room.on(sdk.RoomEvent.Reconnecting, () => {
                if (this.room === room) {
                    this.onState?.('disconnected');
                }
            });

            room.on(sdk.RoomEvent.Reconnected, () => {
                if (this.room === room) {
                    this.onState?.('connected');
                }
            });

            room.on(sdk.RoomEvent.Disconnected, () => {
                if (this.room === room) {
                    this.onState?.('disconnected');
                }
            });

            try {
                await room.connect(url, token);

                if (this.room !== room ||
                    generation !== this.generation) {
                    throw new Error('Appel annule.');
                }

                await room.localParticipant.setMicrophoneEnabled(
                    true,
                    audioCaptureOptions
                );

                if (mode === 'video') {
                    await room.localParticipant.setCameraEnabled(true);
                }

                if (this.room !== room ||
                    generation !== this.generation) {
                    throw new Error('Appel annule.');
                }

                const stream = this.refreshLocal();
                this.onState?.('connected');

                // Ne jamais bloquer la connexion audio.
                void this.enableKrisp(room);

                return stream;

            } catch (error) {
                if (this.room === room) {
                    this.close();
                } else {
                    try {
                        await room.disconnect();
                    } catch {}
                }

                throw error;
            }
        }


        async enableKrisp(room) {
            let audioTrack = null;
            let attached = false;

            try {
                if (this.room !== room) return;

                // Chargement uniquement pendant un appel.
                if (!window.TasklyKrisp) {
                    if (typeof document === 'undefined') return;

                    if (!TasklyCallLiveKit.krispLoading) {
                        const loading = new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src =
                                '/js/vendor/taskly-krisp.bundle.js?v=1';
                            script.async = true;
                            script.onload = resolve;
                            script.onerror = () => reject(
                                new Error('Chargement Krisp impossible')
                            );
                            document.head.appendChild(script);
                        });

                        TasklyCallLiveKit.krispLoading =
                            loading.catch(error => {
                                TasklyCallLiveKit.krispLoading = null;
                                throw error;
                            });
                    }

                    await TasklyCallLiveKit.krispLoading;
                }

                if (this.room !== room) return;

                const plugin = window.TasklyKrisp;

                if (!plugin ||
                    typeof plugin.KrispNoiseFilter !== 'function' ||
                    typeof plugin.isKrispNoiseFilterSupported !==
                        'function' ||
                    !plugin.isKrispNoiseFilterSupported()) {
                    return;
                }

                const publication = [
                    ...room.localParticipant.trackPublications.values()
                ].find(item =>
                    item.track?.mediaStreamTrack?.kind === 'audio'
                );

                audioTrack = publication?.track;

                if (typeof audioTrack?.setProcessor !== 'function') {
                    return;
                }

                const processor = plugin.KrispNoiseFilter();

                await audioTrack.setProcessor(processor);
                attached = true;

                if (this.room !== room) {
                    await audioTrack.stopProcessor?.();
                    return;
                }

                await processor.setEnabled(true);

                if (this.room === room) {
                    this.refreshLocal();
                    console.info('[Taskly] Filtre Krisp actif');
                }
            } catch (error) {
                if (attached &&
                    typeof audioTrack?.stopProcessor === 'function') {
                    try {
                        await audioTrack.stopProcessor();
                    } catch {}
                }

                console.warn(
                    '[Taskly] Krisp indisponible : audio standard',
                    error
                );
            }
        }

        refreshLocal() {
            if (!this.room) return null;

            const tracks = [
                ...this.room.localParticipant.trackPublications.values()
            ]
                .map(publication =>
                    publication.track?.mediaStreamTrack
                )
                .filter(Boolean);

            this.stream = new MediaStream(tracks);
            this.onLocal?.(this.stream);

            return this.stream;
        }

        async setMicrophone(enabled) {
            if (!this.room) return;

            await this.room.localParticipant
                .setMicrophoneEnabled(Boolean(enabled));

            if (this.room) this.refreshLocal();
        }

        async setCamera(enabled) {
            if (!this.room || this.mode !== 'video') return;

            await this.room.localParticipant
                .setCameraEnabled(Boolean(enabled));

            if (this.room) this.refreshLocal();
        }

        close() {
            this.generation++;

            const room = this.room;

            this.room = null;
            this.stream = null;
            this.remoteStream = null;
            this.mode = null;

            if (room) {
                try {
                    Promise.resolve(room.disconnect())
                        .catch(() => {});
                } catch {}
            }
        }
    }

    window.TasklyCallLiveKit = TasklyCallLiveKit;
})();
