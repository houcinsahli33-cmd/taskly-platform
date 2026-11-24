"use strict";

/*
 * Taskly Admin Private V17
 * AES-256-GCM message encryption primitive.
 *
 * No server-side plaintext.
 * No key exchange or identity verification here.
 * Keys must be supplied by a separately authenticated
 * and persistent key-management protocol.
 */

(function (global) {
    const webcrypto = global.crypto;

    if (!webcrypto || !webcrypto.subtle) {
        return;
    }

    const subtle = webcrypto.subtle;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder("utf-8", { fatal: true });

    function encode(bytes) {
        let binary = "";

        for (const byte of bytes) {
            binary += String.fromCharCode(byte);
        }

        return btoa(binary)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "");
    }

    function decode(value) {
        if (
            typeof value !== "string" ||
            !/^[A-Za-z0-9_-]+$/.test(value)
        ) {
            throw new Error("Encodage cryptographique invalide.");
        }

        const base64 = value
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        const padded = base64 +
            "=".repeat((4 - base64.length % 4) % 4);

        const bytes = Uint8Array.from(
            atob(padded),
            character => character.charCodeAt(0)
        );

        if (encode(bytes) !== value) {
            throw new Error("Encodage non canonique.");
        }

        return bytes;
    }

    function validId(value) {
        const text = String(value);

        if (!/^[1-9][0-9]{0,18}$/.test(text)) {
            throw new Error("Identifiant invalide.");
        }

        return text;
    }

    function associatedData(threadId, senderId, version) {
        if (
            !Number.isSafeInteger(version) ||
            version < 1 ||
            version > 100000
        ) {
            throw new Error("Version de cle invalide.");
        }

        return encoder.encode(JSON.stringify([
            "Taskly-Admin-Private-Message-V17",
            validId(threadId),
            validId(senderId),
            version
        ]));
    }

    async function importKey(secret) {
        if (
            !(secret instanceof Uint8Array) ||
            secret.length !== 32
        ) {
            throw new Error("Cle AES-256 invalide.");
        }

        return subtle.importKey(
            "raw",
            secret,
            { name: "AES-GCM" },
            false,
            ["encrypt", "decrypt"]
        );
    }

    async function encrypt(key, threadId, senderId, message, version = 1) {
        if (
            typeof message !== "string" ||
            !message.trim() ||
            message.length > 10000
        ) {
            throw new Error("Message invalide.");
        }

        const aad = associatedData(threadId, senderId, version);
        const nonce = webcrypto.getRandomValues(new Uint8Array(12));

        const ciphertext = await subtle.encrypt(
            {
                name: "AES-GCM",
                iv: nonce,
                additionalData: aad,
                tagLength: 128
            },
            key,
            encoder.encode(message)
        );

        return {
            alg: "AES-256-GCM",
            keyVersion: version,
            nonce: encode(nonce),
            ciphertext: encode(new Uint8Array(ciphertext))
        };
    }

    async function decrypt(key, threadId, senderId, envelope) {
        if (
            !envelope ||
            envelope.alg !== "AES-256-GCM"
        ) {
            throw new Error("Enveloppe invalide.");
        }

        const aad = associatedData(
            threadId,
            senderId,
            envelope.keyVersion
        );

        const nonce = decode(envelope.nonce);
        const ciphertext = decode(envelope.ciphertext);

        if (nonce.length !== 12 || ciphertext.length < 17) {
            throw new Error("Format du message chiffre invalide.");
        }

        const plaintext = await subtle.decrypt(
            {
                name: "AES-GCM",
                iv: nonce,
                additionalData: aad,
                tagLength: 128
            },
            key,
            ciphertext
        );

        return decoder.decode(plaintext);
    }

    global.TasklyAdminPrivateCryptoV17 = Object.freeze({
        importKey,
        encrypt,
        decrypt
    });

})(window);