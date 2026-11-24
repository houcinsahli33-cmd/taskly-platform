"use strict";

(function (global) {
    const vault = global.TasklyAdminPrivateVaultV17;
    const cryptoApi = global.TasklyAdminPrivateCryptoV17;

    if (!vault || !cryptoApi) return;

    function create({ request, role, userId, peerRole, peerId, threadId }) {
        const roles = ["admin", "client", "artisan"];

        if (
            typeof request !== "function" ||
            !roles.includes(role) ||
            !roles.includes(peerRole) ||
            (role === "admin") === (peerRole === "admin") ||
            !Number.isSafeInteger(userId) ||
            !Number.isSafeInteger(peerId) ||
            userId < 1 || peerId < 1 ||
            userId > 2147483647 ||
            peerId > 2147483647 ||
            userId === peerId ||
            !/^[1-9][0-9]{0,18}$/.test(String(threadId))
        ) {
            throw new Error("Conversation invalide.");
        }

        const thread = String(threadId);
        const endpoint = "/threads/" + thread;

        async function directory() {
            const response = await request(endpoint + "/keys", {
                method: "GET"
            });

            if (!Array.isArray(response?.keys) ||
                response.keys.length !== 2) {
                throw new Error("Participants incoherents.");
            }

            const own = response.keys.find(
                k => Number(k.userId) === userId && k.role === role
            );

            const peer = response.keys.find(
                k => Number(k.userId) === peerId && k.role === peerRole
            );

            if (!own || !peer) {
                throw new Error("Identites incoherentes.");
            }

            return {
                own: { ...own, userId },
                peer: { ...peer, userId: peerId }
            };
        }

        async function prepare() {
            let remote = await directory();

            let local;

            if (remote.own.publicKey) {
                // Never replace a registered identity with a new key.
                local = await vault.getIdentity(role, userId);
            } else {
                local = await vault.createIdentity(role, userId);

                await request(endpoint + "/keys", {
                    method: "POST",
                    body: { publicKey: local.publicKey }
                });

                remote = await directory();
            }

            if (remote.own.publicKey !== local.publicKey) {
                throw new Error("Identite locale differente du serveur.");
            }

            return {
                ownFingerprint: local.fingerprint,
                peerAvailable: Boolean(remote.peer.publicKey),
                peer: remote.peer
            };
        }

        async function verifyPeer(verifiedFingerprint) {
            const state = await prepare();

            if (!state.peerAvailable) {
                throw new Error("Correspondant non initialise.");
            }

            // Caller must obtain this fingerprint independently.
            // Never automatically trust the server-supplied fingerprint.
            return vault.trustPeer(
                role,
                userId,
                state.peer,
                verifiedFingerprint,
                true
            );
        }

        async function conversationKey() {
            const remote = await directory();
            const local = await vault.getIdentity(role, userId);

            if (remote.own.publicKey !== local.publicKey) {
                throw new Error("Identite locale incoherente.");
            }

            if (!remote.peer.publicKey) {
                throw new Error("Correspondant non initialise.");
            }

            return vault.deriveForConversation(
                role, userId, remote.peer, thread, 1
            );
        }

        async function send(message) {
            if (typeof message !== "string" ||
                !message.trim() ||
                new TextEncoder().encode(message).length > 12272) {
                throw new Error("Message vide ou trop long.");
            }

            const key = await conversationKey();

            const envelope = await cryptoApi.encrypt(
                key, thread, String(userId), message, 1
            );

            if (envelope.ciphertext.length > 16384) {
                throw new Error("Message chiffre trop long.");
            }

            return request(endpoint + "/messages", {
                method: "POST",
                body: envelope
            });
        }

        async function read() {
            const key = await conversationKey();

            const response = await request(endpoint, {
                method: "GET"
            });

            if (!Array.isArray(response?.messages)) {
                throw new Error("Reponse invalide.");
            }

            return Promise.all(response.messages.map(async message => {
                const sender = String(message.sender_user_id);

                if (sender !== String(userId) &&
                    sender !== String(peerId)) {
                    throw new Error("Expediteur invalide.");
                }

                if (message.keyVersion !== 1) {
                    throw new Error("Version de cle non prise en charge.");
                }

                const content = await cryptoApi.decrypt(
                    key, thread, sender, message
                );

                return {
                    id: String(message.id),
                    senderId: sender,
                    content,
                    createdAt: message.created_at,
                    own: sender === String(userId)
                };
            }));
        }

        return Object.freeze({
            prepare,
            verifyPeer,
            send,
            read
        });
    }

    global.TasklyAdminPrivateConnectorV17 = Object.freeze({
        create
    });

})(window);