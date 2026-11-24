"use strict";

(function (global) {
    const crypto = global.crypto;
    if (!crypto?.subtle) return;

    const subtle = crypto.subtle;
    const encoder = new TextEncoder();
    const prefix = "Taskly-Admin-Private-Keys-V17";

    function encode(bytes) {
        return btoa(Array.from(bytes, b =>
            String.fromCharCode(b)).join(""))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    }

    function decode(value) {
        if (typeof value !== "string" ||
            !/^[A-Za-z0-9_-]{87}$/.test(value)) {
            throw new Error("Cle publique invalide.");
        }

        const base = value.replace(/-/g, "+").replace(/_/g, "/");

        const bytes = Uint8Array.from(
            atob(base + "="),
            c => c.charCodeAt(0)
        );

        if (bytes.length !== 65 || bytes[0] !== 4 ||
            encode(bytes) !== value) {
            throw new Error("Format de cle invalide.");
        }

        return bytes;
    }

    function scope(role, userId) {
        if (!["admin", "client", "artisan"].includes(role) ||
            !Number.isSafeInteger(userId) ||
            userId < 1 || userId > 2147483647) {
            throw new Error("Identite invalide.");
        }

        return role + ":" + userId;
    }

    async function fingerprint(role, userId, publicKey) {
        decode(publicKey);

        const data = encoder.encode(JSON.stringify([
            prefix,
            scope(role, userId),
            publicKey
        ]));

        const hash = new Uint8Array(
            await subtle.digest("SHA-256", data)
        );

        return Array.from(hash, b =>
            b.toString(16).padStart(2, "0")).join("");
    }

    async function create(role, userId) {
        scope(role, userId);

        const pair = await subtle.generateKey(
            { name: "ECDH", namedCurve: "P-256" },
            false,
            ["deriveBits"]
        );

        const publicKey = encode(new Uint8Array(
            await subtle.exportKey("raw", pair.publicKey)
        ));

        return Object.freeze({
            role,
            userId,
            privateKey: pair.privateKey,
            publicKey,
            fingerprint: await fingerprint(role, userId, publicKey)
        });
    }

    async function derive(
        own,
        peer,
        verifiedFingerprint,
        threadId,
        version = 1
    ) {
        if (!own?.privateKey || !peer) {
            throw new Error("Identites manquantes.");
        }

        const self = scope(own.role, own.userId);
        const remote = scope(peer.role, peer.userId);

        if ((own.role === "admin") === (peer.role === "admin") ||
            own.userId === peer.userId) {
            throw new Error("Participants non autorises.");
        }

        if (!/^[1-9][0-9]{0,18}$/.test(String(threadId)) ||
            !Number.isSafeInteger(version) ||
            version < 1 || version > 100000) {
            throw new Error("Contexte invalide.");
        }

        if (typeof verifiedFingerprint !== "string" ||
            !/^[a-f0-9]{64}$/.test(verifiedFingerprint)) {
            throw new Error("Empreinte de confiance requise.");
        }

        const peerFingerprint = await fingerprint(
            peer.role, peer.userId, peer.publicKey
        );

        if (peerFingerprint !== verifiedFingerprint) {
            throw new Error("Identite distante non verifiee.");
        }

        const ownFingerprint = await fingerprint(
            own.role, own.userId, own.publicKey
        );

        const participants = own.role === "admin"
            ? [[self, ownFingerprint], [remote, peerFingerprint]]
            : [[remote, peerFingerprint], [self, ownFingerprint]];

        const context = encoder.encode(JSON.stringify([
            prefix,
            String(threadId),
            version,
            participants
        ]));

        const remoteKey = await subtle.importKey(
            "raw",
            decode(peer.publicKey),
            { name: "ECDH", namedCurve: "P-256" },
            false,
            []
        );

        const bits = await subtle.deriveBits(
            { name: "ECDH", public: remoteKey },
            own.privateKey,
            256
        );

        try {
            const base = await subtle.importKey(
                "raw", bits, "HKDF", false, ["deriveKey"]
            );

            return await subtle.deriveKey(
                {
                    name: "HKDF",
                    hash: "SHA-256",
                    salt: await subtle.digest("SHA-256", context),
                    info: encoder.encode(prefix + ":message-key")
                },
                base,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt", "decrypt"]
            );
        } finally {
            new Uint8Array(bits).fill(0);
        }
    }

    global.TasklyAdminPrivateKeysV17 = Object.freeze({
        create,
        fingerprint,
        derive
    });

})(window);