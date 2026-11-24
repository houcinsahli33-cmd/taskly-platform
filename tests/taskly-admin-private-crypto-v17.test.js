"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const window = { crypto: webcrypto };

const context = vm.createContext({
    window,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    btoa,
    atob
});

const source = fs.readFileSync(
    path.join(
        __dirname,
        "../client/public/js/taskly-admin-private-crypto-v17.js"
    ),
    "utf8"
);

vm.runInContext(source, context);

const api = window.TasklyAdminPrivateCryptoV17;

async function key() {
    return api.importKey(
        webcrypto.getRandomValues(new Uint8Array(32))
    );
}

test("V17 crypto: chiffrement et dechiffrement", async () => {
    const k = await key();
    const original = "Bonjour, message prive Taskly.";

    const encrypted = await api.encrypt(k, "12", "34", original);

    assert.equal(encrypted.alg, "AES-256-GCM");
    assert.equal(encrypted.nonce.length, 16);
    assert.notEqual(encrypted.ciphertext, original);

    assert.equal(
        await api.decrypt(k, "12", "34", encrypted),
        original
    );
});

test("V17 crypto: mauvaise cle refusee", async () => {
    const k = await key();
    const wrong = await key();

    const encrypted = await api.encrypt(k, "12", "34", "Secret");

    await assert.rejects(
        api.decrypt(wrong, "12", "34", encrypted)
    );
});

test("V17 crypto: message falsifie refuse", async () => {
    const k = await key();

    const encrypted = await api.encrypt(k, "12", "34", "Secret");

    const altered = {
        ...encrypted,
        ciphertext:
            (encrypted.ciphertext[0] === "A" ? "B" : "A") +
            encrypted.ciphertext.slice(1)
    };

    await assert.rejects(
        api.decrypt(k, "12", "34", altered)
    );
});

test("V17 crypto: autre conversation refusee", async () => {
    const k = await key();

    const encrypted = await api.encrypt(k, "12", "34", "Secret");

    await assert.rejects(
        api.decrypt(k, "13", "34", encrypted)
    );
});

test("V17 crypto: faux expediteur refuse", async () => {
    const k = await key();

    const encrypted = await api.encrypt(k, "12", "34", "Secret");

    await assert.rejects(
        api.decrypt(k, "12", "35", encrypted)
    );
});

test("V17 crypto: mauvaise version refusee", async () => {
    const k = await key();

    const encrypted = await api.encrypt(k, "12", "34", "Secret");

    await assert.rejects(
        api.decrypt(k, "12", "34", {
            ...encrypted,
            keyVersion: 2
        })
    );
});

test("V17 crypto: nonces aleatoires distincts", async () => {
    const k = await key();

    const a = await api.encrypt(k, "12", "34", "Secret");
    const b = await api.encrypt(k, "12", "34", "Secret");

    assert.notEqual(a.nonce, b.nonce);
    assert.notEqual(a.ciphertext, b.ciphertext);
});

test("V17 crypto: cle non exportable", async () => {
    const k = await key();

    assert.equal(k.extractable, false);
    assert.equal(k.algorithm.length, 256);

    await assert.rejects(
        webcrypto.subtle.exportKey("raw", k)
    );
});

test("V17 crypto: cle de taille invalide refusee", async () => {
    await assert.rejects(
        api.importKey(new Uint8Array(16))
    );
});