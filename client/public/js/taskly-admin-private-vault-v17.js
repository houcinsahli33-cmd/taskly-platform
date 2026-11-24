"use strict";

(function (global) {
    const database = "taskly-admin-private-vault-v17";
    const collection = "identities-and-pins";

    function keys() {
        const api = global.TasklyAdminPrivateKeysV17;
        if (!api) throw new Error("Module de cles indisponible.");
        return api;
    }

    function scope(role, userId) {
        if (
            !["admin", "client", "artisan"].includes(role) ||
            !Number.isSafeInteger(userId) ||
            userId < 1 ||
            userId > 2147483647
        ) {
            throw new Error("Identite invalide.");
        }

        return role + ":" + userId;
    }

    function identityKey(role, userId) {
        return "identity:" + scope(role, userId);
    }

    function pinKey(role, userId, peerRole, peerId) {
        const own = scope(role, userId);
        const peer = scope(peerRole, peerId);

        if ((role === "admin") === (peerRole === "admin") ||
            userId === peerId) {
            throw new Error("Participants invalides.");
        }

        return "pin:" + own + "|" + peer;
    }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            if (!global.indexedDB) {
                reject(new Error("IndexedDB indisponible."));
                return;
            }

            const request = global.indexedDB.open(database, 1);

            request.onupgradeneeded = () => {
                request.result.createObjectStore(collection);
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function access(key, write = false, candidate) {
        const db = await openDatabase();

        try {
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(
                    collection,
                    write ? "readwrite" : "readonly"
                );

                const store = tx.objectStore(collection);
                const request = store.get(key);

                let result;

                request.onsuccess = () => {
                    result = request.result;

                    if (write && result === undefined) {
                        store.add(candidate, key);
                        result = candidate;
                    }
                };

                tx.oncomplete = () => resolve(result);
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(
                    tx.error || new Error("Transaction annulee.")
                );
            });
        } finally {
            db.close();
        }
    }

    async function loadOwn(role, userId) {
        const identity = await access(identityKey(role, userId));

        if (!identity) {
            throw new Error("Identite locale absente.");
        }

        if (
            identity.role !== role ||
            identity.userId !== userId ||
            identity.privateKey?.type !== "private" ||
            identity.privateKey.extractable !== false ||
            identity.privateKey.algorithm.name !== "ECDH" ||
            identity.privateKey.algorithm.namedCurve !== "P-256"
        ) {
            throw new Error("Identite locale invalide.");
        }

        const fingerprint = await keys().fingerprint(
            role, userId, identity.publicKey
        );

        if (fingerprint !== identity.fingerprint) {
            throw new Error("Identite locale incoherente.");
        }

        return identity;
    }

    function publicIdentity(identity) {
        return {
            role: identity.role,
            userId: identity.userId,
            publicKey: identity.publicKey,
            fingerprint: identity.fingerprint
        };
    }

    async function createIdentity(role, userId) {
        const key = identityKey(role, userId);
        const existing = await access(key);

        if (existing === undefined) {
            const candidate = await keys().create(role, userId);

            // Atomic insert: existing identities are never overwritten.
            await access(key, true, candidate);
        }

        return publicIdentity(await loadOwn(role, userId));
    }

    async function getIdentity(role, userId) {
        return publicIdentity(await loadOwn(role, userId));
    }

    async function trustPeer(
        role,
        userId,
        peer,
        verifiedFingerprint,
        verifiedOutsideTaskly
    ) {
        await loadOwn(role, userId);

        const key = pinKey(role, userId, peer.role, peer.userId);

        if (
            verifiedOutsideTaskly !== true ||
            typeof verifiedFingerprint !== "string" ||
            !/^[a-f0-9]{64}$/.test(verifiedFingerprint)
        ) {
            throw new Error("Verification externe obligatoire.");
        }

        const actual = await keys().fingerprint(
            peer.role, peer.userId, peer.publicKey
        );

        if (actual !== verifiedFingerprint) {
            throw new Error("Empreinte incorrecte.");
        }

        const saved = await access(key, true, verifiedFingerprint);

        if (saved !== verifiedFingerprint) {
            throw new Error("Identite distante modifiee. Acces refuse.");
        }

        return true;
    }

    async function deriveForConversation(
        role,
        userId,
        peer,
        threadId,
        version = 1
    ) {
        const identity = await loadOwn(role, userId);

        const trusted = await access(
            pinKey(role, userId, peer.role, peer.userId)
        );

        if (typeof trusted !== "string") {
            throw new Error("Correspondant non verifie.");
        }

        return keys().derive(
            identity, peer, trusted, threadId, version
        );
    }

    global.TasklyAdminPrivateVaultV17 = Object.freeze({
        createIdentity,
        getIdentity,
        trustPeer,
        deriveForConversation
    });

})(window);