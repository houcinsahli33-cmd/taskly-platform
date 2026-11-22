'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'client', 'public', 'js', 'taskly-call-livekit.js'),
  'utf8'
);

function createHarness({ activationFails = false } = {}) {
  const events = [];

  class FakeWorker {
    constructor(url) {
      events.push('worker:create');
      this.url = url;
    }
    terminate() {
      events.push('worker:terminate');
    }
  }

  class FakeKeyProvider {
    async setKey(key) {
      assert.equal(key.byteLength, 32);
      events.push('key:set');
    }
  }

  class FakeRoom {
    constructor(options) {
      this.options = options;
      this.isE2EEEnabled = false;
      this.localParticipant = {
        trackPublications: new Map(),
        setMicrophoneEnabled: async () => events.push('microphone'),
        setCameraEnabled: async () => events.push('camera')
      };
    }

    on() { return this; }

    async setE2EEEnabled(value) {
      events.push('e2ee:enable');
      if (activationFails) throw new Error('Activation refusee');
      this.isE2EEEnabled = value;
    }

    async connect() {
      events.push('room:connect');
    }

    async disconnect() {
      events.push('room:disconnect');
    }
  }

  class FakeMediaStream {
    constructor(tracks = []) { this.tracks = [...tracks]; }
    getTracks() { return this.tracks; }
    addTrack(track) { this.tracks.push(track); }
    removeTrack(track) {
      this.tracks = this.tracks.filter(t => t !== track);
    }
  }

  const window = {
    LivekitClient: {
      Room: FakeRoom,
      RoomEvent: new Proxy({}, { get: (_, key) => key }),
      ExternalE2EEKeyProvider: FakeKeyProvider,
      isE2EESupported: () => true
    }
  };

  vm.runInNewContext(source, {
    window,
    Worker: FakeWorker,
    MediaStream: FakeMediaStream,
    ArrayBuffer,
    console
  });

  const media = new window.TasklyCallLiveKit();
  media.enableKrisp = async () => {};

  return { media, events };
}

const connection = {
  url: 'wss://example.invalid',
  token: 'x'.repeat(32),
  mode: 'audio'
};

const flush = () => new Promise(resolve => setImmediate(resolve));

test('V20 : appel standard sans Worker E2EE', async () => {
  const { media, events } = createHarness();

  await media.connect(connection);

  assert.ok(events.includes('room:connect'));
  assert.ok(events.includes('microphone'));
  assert.ok(!events.includes('worker:create'));

  media.close();
});

test('V20 : cle absente refusee avant connexion', async () => {
  const { media, events } = createHarness();

  await assert.rejects(
    media.connect({ ...connection, e2eeRequired: true }),
    /Cle E2EE/
  );

  assert.ok(!events.includes('room:connect'));
  assert.ok(!events.includes('microphone'));
  assert.ok(!events.includes('worker:create'));
});

test('V20 : E2EE actif avant publication du micro', async () => {
  const { media, events } = createHarness();

  await media.connect({
    ...connection,
    e2eeRequired: true,
    e2eeKey: new ArrayBuffer(32)
  });

  assert.ok(events.includes('worker:create'));

  const order = [
    'key:set',
    'e2ee:enable',
    'room:connect',
    'microphone'
  ];

  for (let i = 1; i < order.length; i++) {
    assert.ok(events.indexOf(order[i - 1]) < events.indexOf(order[i]));
  }

  media.close();
  await flush();

  assert.equal(
    events.filter(e => e === 'worker:terminate').length,
    1
  );
});

test('V20 : erreur E2EE sans connexion et avec nettoyage', async () => {
  const { media, events } = createHarness({
    activationFails: true
  });

  await assert.rejects(
    media.connect({
      ...connection,
      e2eeRequired: true,
      e2eeKey: new ArrayBuffer(32)
    }),
    /Activation refusee/
  );

  await flush();

  assert.ok(!events.includes('room:connect'));
  assert.ok(!events.includes('microphone'));
  assert.ok(events.includes('worker:terminate'));
});
