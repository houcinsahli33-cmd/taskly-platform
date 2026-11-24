"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const window = { crypto: webcrypto };

const context = vm.createContext({
    window, TextEncoder, TextDecoder,
    Uint8Array, btoa, atob
});

for (const file of [
    "taskly-admin-private-crypto-v17.js",
    "taskly-admin-private-keys-v17.js"
]) {
    vm.runInContext(fs.readFileSync(
        path.join(__dirname, "../client/public/js", file),
        "utf8"
    ), context);
}

const keys = window.TasklyAdminPrivateKeysV17;
const messages = window.TasklyAdminPrivateCryptoV17;

function publicIdentity(identity) {
    return {
        role: identity.role,
        userId: identity.userId,
        publicKey: identity.publicKey
    };
}

test("V17 keys: admin et client derivent la meme cle", async () => {
    const a = await keys.create("admin", 1);
    const b = await keys.create("client", 2);

    const ka = await keys.derive(
        a, publicIdentity(b), b.fingerprint, "10"
    );

    const kb = await keys.derive(
        b, publicIdentity(a), a.fingerprint, "10"
    );

    const envelope = await messages.encrypt(
        ka, "10", "1", "Bonjour Taskly"
    );

    assert.equal(
        await messages.decrypt(kb, "10", "1", envelope),
        "Bonjour Taskly"
    );
});

test("V17 keys: cle privee non exportable", async () => {
    const a = await keys.create("admin", 1);

    assert.equal(a.privateKey.extractable, false);

    await assert.rejects(
        webcrypto.subtle.exportKey("pkcs8", a.privateKey)
    );
});

test("V17 keys: empreinte incorrecte refusee", async () => {
    const a = await keys.create("admin", 1);
    const b = await keys.create("artisan", 2);

    await assert.rejects(
        keys.derive(a, publicIdentity(b), "0".repeat(64), "10")
    );
});

test("V17 keys: empreinte manquante refusee", async () => {
    const a = await keys.create("admin", 1);
    const b = await keys.create("client", 2);

    await assert.rejects(
        keys.derive(a, publicIdentity(b), null, "10")
    );
});

test("V17 keys: deux utilisateurs non admin refuses", async () => {
    const a = await keys.create("client", 1);
    const b = await keys.create("artisan", 2);

    await assert.rejects(
        keys.derive(a, publicIdentity(b), b.fingerprint, "10")
    );
});

test("V17 keys: substitution de cle publique refusee", async () => {
    const a = await keys.create("admin", 1);
    const b = await keys.create("artisan", 2);
    const fake = await keys.create("artisan", 2);

    await assert.rejects(
        keys.derive(a, publicIdentity(fake), b.fingerprint, "10")
    );
});

test("V17 keys: isolation cryptographique des conversations", async () => {
    const a = await keys.create("admin", 1);
    const b = await keys.create("artisan", 2);

    const ka = await keys.derive(
        a, publicIdentity(b), b.fingerprint, "10"
    );

    const kb = await keys.derive(
        b, publicIdentity(a), a.fingerprint, "11"
    );

    const envelope = await messages.encrypt(
        ka, "10", "1", "Message prive"
    );

    await assert.rejects(
        messages.decrypt(kb, "10", "1", envelope)
    );
});

test("V17 keys: cle AES derivee non exportable", async () => {
    const a = await keys.create("admin", 1);
    const b = await keys.create("client", 2);

    const key = await keys.derive(
        a, publicIdentity(b), b.fingerprint, "10"
    );

    assert.equal(key.extractable, false);
    assert.equal(key.algorithm.length, 256);

    await assert.rejects(
        webcrypto.subtle.exportKey("raw", key)
    );
});