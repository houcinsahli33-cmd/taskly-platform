"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { envelope } = require(
    "../server/services/tasklyAdminPrivateV17Service"
);

function fixture(memberRole = "client") {
    const participants = [
        { userId: 1, role: "admin", publicKey: null },
        { userId: 2, role: memberRole, publicKey: null }
    ];

    const stored = [];

    function browser(self, peer) {
        const window = { crypto: webcrypto };

        const context = vm.createContext({
            window, TextEncoder, TextDecoder,
            Uint8Array, btoa, atob
        });

        function load(file) {
            vm.runInContext(
                fs.readFileSync(
                    path.join(
                        __dirname,
                        "../client/public/js",
                        file
                    ),
                    "utf8"
                ),
                context
            );
        }

        load("taskly-admin-private-crypto-v17.js");
        load("taskly-admin-private-keys-v17.js");

        const keys = window.TasklyAdminPrivateKeysV17;

        let identity;
        let pin;

        function publicIdentity() {
            if (!identity) {
                throw new Error("Identite locale absente.");
            }

            return {
                role: identity.role,
                userId: identity.userId,
                publicKey: identity.publicKey,
                fingerprint: identity.fingerprint
            };
        }

        // Simulated local vault, separate for each browser.
        window.TasklyAdminPrivateVaultV17 = {
            async createIdentity(role, userId) {
                identity ||= await keys.create(role, userId);
                return publicIdentity();
            },

            async getIdentity() {
                return publicIdentity();
            },

            async trustPeer(role, userId, remote, fp, verified) {
                const actual = await keys.fingerprint(
                    remote.role,
                    remote.userId,
                    remote.publicKey
                );

                if (!verified || actual !== fp) {
                    throw new Error("Empreinte incorrecte.");
                }

                if (pin && pin !== fp) {
                    throw new Error("Identite modifiee.");
                }

                pin = fp;
                return true;
            },

            async deriveForConversation(
                role, userId, remote, thread, version
            ) {
                if (!pin) {
                    throw new Error("Correspondant non verifie.");
                }

                return keys.derive(
                    identity, remote, pin, thread, version
                );
            }
        };

        load("taskly-admin-private-connector-v17.js");

        async function request(url, options) {
            if (url === "/threads/17/keys") {
                if (options.method === "GET") {
                    return {
                        keys: participants.map(p => ({ ...p }))
                    };
                }

                assert.equal(
                    Object.keys(options.body).join(","),
                    "publicKey"
                );

                const value = options.body.publicKey;

                if (self.publicKey && self.publicKey !== value) {
                    throw new Error("Remplacement interdit.");
                }

                self.publicKey = value;

                return { registered: true };
            }

            if (url === "/threads/17/messages" &&
                options.method === "POST") {

                const body = options.body;

                assert.equal(
                    Object.keys(body).sort().join(","),
                    "alg,ciphertext,keyVersion,nonce"
                );

                // Validate using the actual server validator.
                envelope(body);

                stored.push({
                    ...body,
                    id: String(stored.length + 1),
                    sender_user_id: self.userId,
                    created_at: new Date().toISOString()
                });

                return {
                    message: { id: String(stored.length) }
                };
            }

            if (url === "/threads/17" &&
                options.method === "GET") {
                return {
                    messages: stored.map(m => ({ ...m }))
                };
            }

            throw new Error("Route inattendue : " + url);
        }

        const connector =
            window.TasklyAdminPrivateConnectorV17.create({
                request,
                role: self.role,
                userId: self.userId,
                peerRole: peer.role,
                peerId: peer.userId,
                threadId: "17"
            });

        return {
            connector,
            keys,
            forgetIdentity() {
                identity = undefined;
            }
        };
    }

    const admin = browser(participants[0], participants[1]);
    const member = browser(participants[1], participants[0]);

    async function prepare() {
        const a = await admin.connector.prepare();
        const b = await member.connector.prepare();

        return {
            adminFingerprint: a.ownFingerprint,
            memberFingerprint: b.ownFingerprint
        };
    }

    async function trust() {
        const fp = await prepare();

        // Test fingerprints obtained independently
        // from the two simulated browsers.
        await admin.connector.verifyPeer(fp.memberFingerprint);
        await member.connector.verifyPeer(fp.adminFingerprint);
    }

    return {
        admin, member, stored,
        participants, prepare, trust
    };
}

test("V17 connector: publication des cles publiques", async () => {
    const f = fixture();

    await f.prepare();

    assert.equal(f.participants[0].publicKey.length, 87);
    assert.equal(f.participants[1].publicKey.length, 87);
});

test("V17 connector: envoi sans confiance refuse", async () => {
    const f = fixture();

    await f.prepare();

    await assert.rejects(
        f.admin.connector.send("Message prive"),
        /non verifie/
    );

    assert.equal(f.stored.length, 0);
});

test("V17 connector: mauvaise empreinte refusee", async () => {
    const f = fixture();

    await f.prepare();

    await assert.rejects(
        f.admin.connector.verifyPeer("0".repeat(64))
    );
});

test("V17 connector: admin client dans les deux sens", async () => {
    const f = fixture();

    await f.trust();

    await f.admin.connector.send("Bonjour client");
    await f.member.connector.send("Bonjour administrateur");

    const messages = await f.admin.connector.read();

    assert.equal(messages.length, 2);
    assert.equal(messages[0].content, "Bonjour client");
    assert.equal(messages[0].own, true);
    assert.equal(messages[1].content, "Bonjour administrateur");
    assert.equal(messages[1].own, false);

    assert.equal(
        JSON.stringify(f.stored).includes("Bonjour"),
        false
    );
});

test("V17 connector: admin artisan et message court", async () => {
    const f = fixture("artisan");

    await f.trust();

    await f.admin.connector.send("?");

    const messages = await f.member.connector.read();

    assert.equal(messages[0].content, "?");
    assert.equal(messages[0].own, false);
});

test("V17 connector: identite distante substituee refusee", async () => {
    const f = fixture();

    await f.trust();

    const replacement = await f.member.keys.create("client", 2);

    f.participants[1].publicKey = replacement.publicKey;

    await assert.rejects(
        f.admin.connector.send("Secret")
    );

    assert.equal(f.stored.length, 0);
});

test("V17 connector: cle locale perdue non remplacee", async () => {
    const f = fixture();

    await f.trust();

    const previous = f.participants[0].publicKey;

    f.admin.forgetIdentity();

    await assert.rejects(
        f.admin.connector.prepare()
    );

    assert.equal(f.participants[0].publicKey, previous);
});

test("V17 connector: message trop volumineux refuse", async () => {
    const f = fixture();

    await f.trust();

    await assert.rejects(
        f.admin.connector.send("😀".repeat(4000))
    );

    assert.equal(f.stored.length, 0);
});

test("V17 connector: message falsifie refuse", async () => {
    const f = fixture();

    await f.trust();

    await f.admin.connector.send("Secret");

    const original = f.stored[0].ciphertext;

    f.stored[0].ciphertext =
        (original[0] === "A" ? "B" : "A") +
        original.slice(1);

    await assert.rejects(
        f.member.connector.read()
    );
});