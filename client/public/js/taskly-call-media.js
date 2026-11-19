'use strict';

(function () {

    class TasklyCallMedia {

        constructor(onRemote, onState) {
            this.peer = null;
            this.stream = null;
            this.onRemote = onRemote;
            this.onState = onState;
            this.generation = 0;
        }

        async prepare(mode) {

            if (!['audio', 'video'].includes(mode)) {
                throw new Error('Mode invalide.');
            }

            if (!window.isSecureContext ||
                !navigator.mediaDevices?.getUserMedia ||
                !window.RTCPeerConnection) {
                throw new Error('Navigateur incompatible avec les appels.');
            }

            this.close();
            const generation = this.generation;

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                },
                video: mode === 'video'
                    ? {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'user'
                    }
                    : false
            });

            if (generation !== this.generation) {
                stream.getTracks().forEach(track => track.stop());
                throw new Error('Appel annule.');
            }

            this.stream = stream;

            try {
                const peer = new RTCPeerConnection({
                    iceServers: [
                        {
                            urls: 'stun:stun.l.google.com:19302'
                        }
                    ]
                });

                this.peer = peer;

                for (const track of stream.getTracks()) {
                    peer.addTrack(track, stream);
                }

                const remoteStream = new MediaStream();

                peer.ontrack = event => {
                    if (this.peer !== peer) return;

                    if (!remoteStream.getTracks().some(
                        track => track.id === event.track.id
                    )) {
                        remoteStream.addTrack(event.track);
                    }

                    this.onRemote?.(remoteStream);
                };

                peer.onconnectionstatechange = () => {
                    if (this.peer === peer) {
                        this.onState?.(peer.connectionState);
                    }
                };

                return stream;

            } catch (error) {
                this.close();
                throw error;
            }
        }

        async waitIce() {

            const peer = this.peer;

            if (!peer) {
                throw new Error('Connexion non preparee.');
            }

            if (peer.iceGatheringState === 'complete') {
                return;
            }

            await new Promise((resolve, reject) => {

                const cleanup = () => {
                    clearTimeout(timer);
                    peer.removeEventListener(
                        'icegatheringstatechange', changed
                    );
                };

                const changed = () => {
                    if (this.peer !== peer ||
                        peer.signalingState === 'closed') {
                        cleanup();
                        reject(new Error('Appel annule.'));
                    } else if (
                        peer.iceGatheringState === 'complete'
                    ) {
                        cleanup();
                        resolve();
                    }
                };

                const timer = setTimeout(() => {
                    cleanup();
                    reject(new Error('Preparation reseau trop longue.'));
                }, 15000);

                peer.addEventListener(
                    'icegatheringstatechange', changed
                );

                changed();
            });
        }

        async createOffer() {
            const peer = this.peer;

            if (!peer) {
                throw new Error('Connexion non preparee.');
            }

            const offer = await peer.createOffer();

            await peer.setLocalDescription(offer);
            await this.waitIce();

            if (this.peer !== peer) {
                throw new Error('Appel annule.');
            }

            return peer.localDescription.sdp;
        }

        async createAnswer(offer) {
            const peer = this.peer;

            if (!peer) {
                throw new Error('Connexion non preparee.');
            }

            await peer.setRemoteDescription({
                type: 'offer',
                sdp: offer
            });

            const answer = await peer.createAnswer();

            await peer.setLocalDescription(answer);
            await this.waitIce();

            if (this.peer !== peer) {
                throw new Error('Appel annule.');
            }

            return peer.localDescription.sdp;
        }

        async applyAnswer(answer) {
            if (!this.peer) {
                throw new Error('Connexion non preparee.');
            }

            await this.peer.setRemoteDescription({
                type: 'answer',
                sdp: answer
            });
        }

        setMicrophone(enabled) {
            this.stream?.getAudioTracks().forEach(track => {
                track.enabled = Boolean(enabled);
            });
        }

        setCamera(enabled) {
            this.stream?.getVideoTracks().forEach(track => {
                track.enabled = Boolean(enabled);
            });
        }

        close() {
            this.generation++;

            if (this.peer) {
                this.peer.ontrack = null;
                this.peer.onconnectionstatechange = null;
                this.peer.close();
                this.peer = null;
            }

            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }
        }
    }

    window.TasklyCallMedia = TasklyCallMedia;

})();