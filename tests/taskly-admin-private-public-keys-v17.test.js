"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createECDH } = require("node:crypto");

const { createService } = require(
    "../server/services/tasklyAdminPrivateV17Service"
);

function publicKey() {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    return ecdh.getPublicKey().toString("base64url");
}

function fixture() {
    const users = [
        { id: 1, role: "admin" },
        { id: 2, role: "client" },
        { id: 3, role: "artisan" },
        { id: 4, role: "admin" }
    ];

    const stored = new Map();

    const thread = {
        id: "17",
        admin_user_id: 1,
        member_user_id: 2
    };

    async function query(sql, params) {
        if (sql.startsWith("SELECT id,role FROM users")) {
            return [users.filter(u => u.id === params[0])];
        }

        if (sql.startsWith(
            "SELECT id,admin_user_id,member_user_id"
        )) {
            return [
                String(params[0]) === "17" ? [thread] : []
            ];
        }

        if (sql.includes(
            "INSERT INTO taskly_admin_private_public_keys"
        )) {
            const [tid, uid, key] = params;
            const index = tid + ":" + uid;

            if (!stored.has(index)) {
                stored.set(index, key);
            }

            return [{ affectedRows: 1 }];
        }

        if (sql.includes("SELECT public_key")) {
            const key = stored.get(params[0] + ":" + params[1]);

            return [key ? [{ public_key: key }] : []];
        }

        if (sql.includes("SELECT u.id AS userId")) {
            const [tid, aid, mid] = params;

            return [
                users.filter(u => [aid, mid].includes(u.id))
                    .map(u => ({
                        userId: u.id,
                        role: u.role,
                        publicKey:
                            stored.get(tid + ":" + u.id) || null
                    }))
            ];
        }

        throw new Error("SQL inattendu : " + sql);
    }

    const db = {
        query,
        async getConnection() {
            const snapshot = new Map(stored);

            return {
                query,
                async beginTransaction() {},
                async commit() {},
                async rollback() {
                    stored.clear();
                    for (const [k, v] of snapshot) {
                        stored.set(k, v);
                    }
                },
                release() {}
            };
        }
    };

    return {
        service: createService({ db }),
        stored
    };
}

test("V17 public keys: enregistrement autorise", async () => {
    const { service } = fixture();

    assert.deepEqual(
        await service.publishPublicKey(
            1, "admin", "17", publicKey()
        ),
        { registered: true }
    );
});

test("V17 public keys: meme cle acceptee", async () => {
    const { service } = fixture();
    const key = publicKey();

    await service.publishPublicKey(1, "admin", "17", key);

    assert.deepEqual(
        await service.publishPublicKey(
            1, "admin", "17", key
        ),
        { registered: true }
    );
});

test("V17 public keys: remplacement refuse", async () => {
    const { service, stored } = fixture();
    const original = publicKey();

    await service.publishPublicKey(
        1, "admin", "17", original
    );

    await assert.rejects(
        service.publishPublicKey(
            1, "admin", "17", publicKey()
        ),
        { status: 409 }
    );

    assert.equal(stored.get("17:1"), original);
});

test("V17 public keys: utilisateur tiers refuse", async () => {
    const { service, stored } = fixture();

    await assert.rejects(
        service.publishPublicKey(
            3, "user", "17", publicKey()
        ),
        { status: 404 }
    );

    assert.equal(stored.size, 0);
});

test("V17 public keys: autre admin refuse", async () => {
    const { service } = fixture();

    await assert.rejects(
        service.publishPublicKey(
            4, "admin", "17", publicKey()
        ),
        { status: 404 }
    );
});

test("V17 public keys: point cryptographique invalide", async () => {
    const { service } = fixture();

    const invalid = Buffer.alloc(65);
    invalid[0] = 4;

    await assert.rejects(
        service.publishPublicKey(
            1, "admin", "17",
            invalid.toString("base64url")
        ),
        { status: 400 }
    );
});

test("V17 public keys: lecture des deux participants", async () => {
    const { service } = fixture();

    const adminKey = publicKey();
    const clientKey = publicKey();

    await service.publishPublicKey(
        1, "admin", "17", adminKey
    );

    await service.publishPublicKey(
        2, "user", "17", clientKey
    );

    const result = await service.getPublicKeys(
        2, "user", "17"
    );

    assert.deepEqual(result, [
        { userId: 1, role: "admin", publicKey: adminKey },
        { userId: 2, role: "client", publicKey: clientKey }
    ]);
});

test("V17 public keys: lecture par un tiers refusee", async () => {
    const { service } = fixture();

    await assert.rejects(
        service.getPublicKeys(3, "user", "17"),
        { status: 404 }
    );
});

test("V17 public keys: role inconnu refuse", async () => {
    const { service } = fixture();

    await assert.rejects(
        service.getPublicKeys(2, "unknown", "17"),
        { status: 403 }
    );
});