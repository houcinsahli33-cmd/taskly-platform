'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(
    'client/public/js/taskly-call-livekit.js', 'utf8'
);

const URL = 'wss://test.livekit.invalid';
const TOKEN = 'x'.repeat(40);

function environnement(sdkPresent = true) {
    let room;
    const states = [];
    const remote = [];
    const local = [];

    class MediaStream {
        constructor(tracks = []) {
            this.tracks = [...tracks];
        }
        getTracks() { return [...this.tracks]; }
        addTrack(track) { this.tracks.push(track); }
        removeTrack(track) {
            this.tracks = this.tracks.filter(t => t !== track);
        }
    }

    class Room {
        constructor() {
            room = this;
            this.events = {};
            this.actions = [];
            this.localParticipant = {
                trackPublications: new Map(),
                setMicrophoneEnabled: async enabled => {
                    this.actions.push(['mic', enabled]);
                    if (enabled) {
                        this.localParticipant.trackPublications.set(
                            'audio', {
                                track: {
                                    mediaStreamTrack: {
                                        id: 'local-audio', kind: 'audio'
                                    }
                                }
                            }
                        );
                    }
                },
                setCameraEnabled: async enabled => {
                    this.actions.push(['camera', enabled]);
                    if (enabled) {
                        this.localParticipant.trackPublications.set(
                            'video', {
                                track: {
                                    mediaStreamTrack: {
                                        id: 'local-video', kind: 'video'
                                    }
                                }
                            }
                        );
                    }
                }
            };
        }

        on(name, handler) {
            this.events[name] = handler;
            return this;
        }

        async connect(url, token) {
            this.actions.push(['connect', url, token]);
        }

        async disconnect() {
            this.actions.push(['disconnect']);
        }
    }

    const window = {};

    if (sdkPresent) {
        window.LivekitClient = {
            Room,
            RoomEvent: {
                TrackSubscribed: 'subscribed',
                TrackUnsubscribed: 'unsubscribed',
                Reconnecting: 'reconnecting',
                Reconnected: 'reconnected',
                Disconnected: 'disconnected'
            }
        };
    }

    vm.runInNewContext(source, {
        window,
        MediaStream,
        Promise
    });

    const adapter = new window.TasklyCallLiveKit(
        stream => remote.push(stream.getTracks()),
        state => states.push(state),
        stream => local.push(stream.getTracks())
    );

    return {
        adapter, states, remote, local,
        room: () => room
    };
}

test('Navigateur : SDK absent refuse', async () => {
    const e = environnement(false);
    await assert.rejects(
        e.adapter.connect({ url: URL, token: TOKEN, mode: 'audio' }),
        /SDK LiveKit indisponible/
    );
});

test('Navigateur : mode invalide refuse', async () => {
    const e = environnement();
    await assert.rejects(
        e.adapter.connect({ url: URL, token: TOKEN, mode: 'texte' }),
        /Mode LiveKit invalide/
    );
});

test('Navigateur : appel audio connecte', async () => {
    const e = environnement();

    const stream = await e.adapter.connect({
        url: URL, token: TOKEN, mode: 'audio'
    });

    assert.equal(stream.getTracks().length, 1);
    assert.deepEqual(e.states, ['connected']);
    assert.equal(
        e.room().actions.some(a =>
            a[0] === 'mic' && a[1] === true
        ),
        true
    );
});

test('Navigateur : video et commandes media', async () => {
    const e = environnement();

    await e.adapter.connect({
        url: URL, token: TOKEN, mode: 'video'
    });

    assert.equal(e.local.at(-1).length, 2);

    await e.adapter.setMicrophone(false);
    await e.adapter.setCamera(false);

    assert.equal(
        e.room().actions.some(a =>
            a[0] === 'mic' && a[1] === false
        ),
        true
    );

    assert.equal(
        e.room().actions.some(a =>
            a[0] === 'camera' && a[1] === false
        ),
        true
    );
});

test('Navigateur : reception et retrait du flux distant', async () => {
    const e = environnement();

    await e.adapter.connect({
        url: URL, token: TOKEN, mode: 'audio'
    });

    const track = {
        mediaStreamTrack: { id: 'remote-1', kind: 'audio' }
    };

    e.room().events.subscribed(track);
    assert.equal(e.remote.at(-1).length, 1);

    e.room().events.unsubscribed(track);
    assert.equal(e.remote.at(-1).length, 0);
});

test('Navigateur : reconnexion et raccrochage', async () => {
    const e = environnement();

    await e.adapter.connect({
        url: URL, token: TOKEN, mode: 'audio'
    });

    e.room().events.reconnecting();
    e.room().events.reconnected();

    assert.deepEqual(
        e.states,
        ['connected', 'disconnected', 'connected']
    );

    const room = e.room();
    e.adapter.close();

    assert.equal(
        room.actions.some(a => a[0] === 'disconnect'),
        true
    );
    assert.equal(e.adapter.room, null);
});

test('Navigateur : scripts charges dans les deux espaces', () => {
    for (const role of ['client', 'artisan']) {
        const html = fs.readFileSync(
            'client/private/' + role + '/messagerie.html',
            'utf8'
        );

        const sdk = html.indexOf('/js/vendor/livekit-client.umd.js');
        const adapter = html.indexOf('/js/taskly-call-livekit.js');
        const ui = html.indexOf('/js/taskly-call-ui.js');

        assert.ok(sdk >= 0 && sdk < adapter && adapter < ui);
    }
});
