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

function environnement(sdkPresent = true, remoteVideo = null) {
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
        constructor(options) {
            this.options = options;
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
        stream => local.push(stream.getTracks()),
        () => remoteVideo
    );

    return {
        adapter, states, remote, local, window,
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


test('Navigateur : suppression echo et bruit activee', async () => {
    const e = environnement();

    await e.adapter.connect({
        url: URL, token: TOKEN, mode: 'audio'
    });

    const audio = e.room().options.audioCaptureDefaults;

    assert.equal(audio.echoCancellation, true);
    assert.equal(audio.noiseSuppression, true);
    assert.equal(audio.autoGainControl, true);
    assert.equal(audio.channelCount, 1);
});


test('Krisp : traitement applique au microphone', async () => {
    const e = environnement();
    await e.adapter.connect({
        url: URL, token: TOKEN, mode: 'audio'
    });

    let applied = false;
    let enabled = false;

    const track = e.room()
        .localParticipant.trackPublications.get('audio').track;

    track.setProcessor = async () => { applied = true; };
    track.stopProcessor = async () => {};

    e.window.TasklyKrisp = {
        isKrispNoiseFilterSupported: () => true,
        KrispNoiseFilter: () => ({
            setEnabled: async value => { enabled = value; }
        })
    };

    await e.adapter.enableKrisp(e.room());

    assert.equal(applied, true);
    assert.equal(enabled, true);
    assert.deepEqual(e.states, ['connected']);
});

test('Krisp : navigateur incompatible conserve le son', async () => {
    const e = environnement();
    await e.adapter.connect({
        url: URL, token: TOKEN, mode: 'audio'
    });

    e.window.TasklyKrisp = {
        isKrispNoiseFilterSupported: () => false,
        KrispNoiseFilter: () => {
            throw new Error('Ne doit pas etre execute');
        }
    };

    await e.adapter.enableKrisp(e.room());

    assert.equal(e.room() !== null, true);
    assert.deepEqual(e.states, ['connected']);
});


test('LiveKit HD: capture 720p demandée en vidéo seulement, audio préservé', async () => {
    const e = environnement();
    await e.adapter.connect({url: URL, token: TOKEN, mode: 'video'});
    assert.equal(e.room().options.adaptiveStream, true);
    assert.equal(e.room().options.dynacast, true);
    assert.deepEqual(
        Object.fromEntries(Object.entries(e.room().options.videoCaptureDefaults.resolution)),
        {width:1280, height:720}
    );
    assert.equal(e.room().options.videoCaptureDefaults.frameRate, 24);
});

test('LiveKit HD: la piste vidéo distante est attachée à la vraie vidéo pour adaptiveStream', async () => {
    const element = {tagName:'VIDEO'};
    const e = environnement(true, element);
    await e.adapter.connect({url: URL, token: TOKEN, mode: 'video'});
    const calls = [];
    const track = {
        mediaStreamTrack: {id:'remote-video-hd', kind:'video'},
        attach(video) { calls.push(['attach',video]); },
        detach(video) { calls.push(['detach',video]); }
    };
    e.room().events.subscribed(track);
    assert.deepEqual(calls, [['attach',element]]);
    assert.equal(e.remote.at(-1)[0].kind, 'video');
    e.room().events.unsubscribed(track);
    assert.deepEqual(calls[1], ['detach',element]);
    e.room().events.subscribed(track);
    e.adapter.close();
    assert.deepEqual(calls[3], ['detach',element]);
});

test('LiveKit HD: les deux pages chargent le script corrigé après cache bust', () => {
    const ui=fs.readFileSync('client/public/js/taskly-call-ui.js','utf8');
    assert.match(ui,/\(\) => this\.get\('remote'\)/);
    for(const role of ['client','artisan']) {
        const html=fs.readFileSync(`client/private/${role}/messagerie.html`,'utf8');
        assert.match(html,/taskly-call-livekit\.js\?v=19-restored/);
        assert.match(html,/taskly-call-ui\.js\?v=5/);
    }
});
