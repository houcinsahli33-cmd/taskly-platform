'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../client/public/js/taskly-call-livekit-e2ee-v20.js'), 'utf8');

function setup({ neverActivates = false } = {}) {
    const operations = [];
    class WorkerMock {
        constructor() { operations.push('worker:init'); }
        terminate() { operations.push('worker:terminate'); }
    }
    class KeyProvider {
        async setKey(key) {
            assert.equal(key.byteLength, 32);
            operations.push('key:set');
        }
    }
    class Room {
        constructor(options) {
            this.options = options;
            this.isE2EEEnabled = false;
            this.handlers = {};
            this.localParticipant = {
                trackPublications: new Map(),
                setMicrophoneEnabled: async () => operations.push('microphone:publish'),
                setCameraEnabled: async () => operations.push('camera:publish')
            };
        }
        on(event, handler) { this.handlers[event] = handler; }
        async setE2EEEnabled(v) {
            assert.equal(v, true);
            operations.push('e2ee:request');
            // Simule le comportement observe en navigateur :
            // isE2EEEnabled reste false jusqu'a room.connect().
            assert.equal(this.isE2EEEnabled, false);
        }
        async connect() {
            operations.push('room:connect');
            if (!neverActivates) this.isE2EEEnabled = true;
        }
        async disconnect() { operations.push('room:disconnect'); }
    }
    class Stream {
        constructor(tracks = []) { this.tracks = tracks; }
        getTracks() { return this.tracks; }
        addTrack(track) { this.tracks.push(track); }
    }
    const sdk = {
        Room,
        RoomEvent: {
            TrackSubscribed: 'subscribed',
            TrackUnsubscribed: 'unsubscribed',
            Reconnecting: 'reconnecting',
            Reconnected: 'reconnected',
            Disconnected: 'disconnected',
            EncryptionError: 'encryptionError'
        },
        ExternalE2EEKeyProvider: KeyProvider,
        isE2EESupported: () => true
    };
    const window = { TasklyE2EESdk: { get: () => sdk } };
    vm.runInNewContext(source, { window, MediaStream: Stream, Worker: WorkerMock, console, ArrayBuffer });
    const adapter = new window.TasklyCallLiveKitE2EE();
    adapter.enableKrisp = async () => {};
    return { adapter, operations };
}
const opts = {
    url: 'wss://example.invalid', token: 'a'.repeat(32),
    mode: 'audio', e2eeRequired: true, e2eeKey: new ArrayBuffer(32)
};
const tick = () => new Promise(resolve => setImmediate(resolve));

test('V23 : accepte E2EE false avant connexion mais true avant publication audio', async () => {
    const { adapter, operations } = setup();
    await adapter.connect(opts);
    assert.deepEqual(operations.slice(0, 5), [
        'worker:init', 'key:set', 'e2ee:request', 'room:connect', 'microphone:publish'
    ]);
    adapter.close();
    await tick();
    assert.ok(operations.includes('worker:terminate'));
});

test('V23 : bloque tout media si E2EE toujours desactive apres connexion', async () => {
    const { adapter, operations } = setup({ neverActivates: true });
    await assert.rejects(adapter.connect(opts), /Activation E2EE non confirmee/);
    assert.ok(operations.includes('room:connect'));
    assert.ok(!operations.includes('microphone:publish'));
    assert.ok(!operations.includes('camera:publish'));
    await tick();
    assert.ok(operations.includes('room:disconnect'));
    assert.ok(operations.includes('worker:terminate'));
});

test('V23 : pages chargent le pilote corrige sans changer le moteur V19', () => {
    for (const role of ['client', 'artisan']) {
        const html = fs.readFileSync(path.join(__dirname,
            '../client/private', role, 'messagerie.html'), 'utf8');
        assert.match(html, /taskly-call-livekit-e2ee-v20\.js\?v=23/);
        assert.match(html, /taskly-call-livekit\.js\?v=19-restored/);
    }
});
