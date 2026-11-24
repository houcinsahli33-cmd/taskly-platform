"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createService } = require(
    "../server/services/tasklyAdminPrivateV17Service"
);

function fixture() {
    const users = [
        { id: 1, role: "admin" },
        { id: 2, role: "client" },
        { id: 3, role: "artisan" },
        { id: 4, role: "admin" }
    ];

    const threads = [
        {
            id: "17",
            admin_user_id: 1,
            member_user_id: 2
        },
        {
            id: "18",
            admin_user_id: 1,
            member_user_id: 3
        }
    ];

    const messages = [
        { id: "101", thread: "17", sender: 1 },
        { id: "102", thread: "17", sender: 1 },
        { id: "103", thread: "17", sender: 2 },
        { id: "104", thread: "18", sender: 1 },
        { id: "105", thread: "18", sender: 3 }
    ];

    const receipts = new Set();

    async function query(sql, params) {
        if (sql.startsWith("SELECT id,role FROM users")) {
            return [
                users.filter(u => u.id === params[0])
            ];
        }

        if (sql.startsWith(
            "SELECT id,admin_user_id,member_user_id"
        )) {
            return [
                threads.filter(t => t.id === params[0])
            ];
        }

        if (sql.includes("COUNT(*) AS unread")) {
            const user = params[0];

            assert.equal(params[1],user);

            const admin = sql.includes(
                "WHERE t.admin_user_id=?"
            );

            const own = admin
                ? "admin_user_id"
                : "member_user_id";

            const peer = admin
                ? "member_user_id"
                : "admin_user_id";

            assert.ok(sql.includes(
                "m.sender_user_id=t." + peer
            ));

            assert.ok(sql.includes(
                "r.message_id IS NULL"
            ));

            assert.ok(sql.includes(
                "p.statut_compte='actif'"
            ));

            const rows = [];

            for (const thread of threads) {
                if (thread[own] !== user) continue;

                const count = messages.filter(m =>
                    m.thread === thread.id &&
                    m.sender === thread[peer] &&
                    !receipts.has(m.id + ":" + user)
                ).length;

                if (count) {
                    rows.push({
                        id: thread.id,
                        unread: count
                    });
                }
            }

            return [rows];
        }

        if (sql.includes(
            "INSERT INTO taskly_admin_private_receipts"
        )) {
            const [user,thread,partner,...ids] = params;

            assert.ok(sql.includes(
                "m.thread_id=CAST(? AS UNSIGNED)"
            ));

            assert.ok(sql.includes(
                "m.sender_user_id=?"
            ));

            for (const message of messages) {
                if (
                    message.thread === thread &&
                    message.sender === partner &&
                    ids.includes(message.id)
                ) {
                    receipts.add(
                        message.id + ":" + user
                    );
                }
            }

            return [{ affectedRows: 1 }];
        }

        throw new Error("Unexpected SQL: " + sql);
    }

    const db = {
        query,

        async getConnection() {
            return {
                query,
                async beginTransaction() {},
                async commit() {},
                async rollback() {},
                release() {}
            };
        }
    };

    return {
        service: createService({ db }),
        receipts
    };
}

test("V17 unread: client sees only received messages",async()=>{
    const {service}=fixture();

    assert.deepEqual(
        await service.unread(2,"user"),
        {
            total:2,
            threads:[{id:"17",unread:2}]
        }
    );
});

test("V17 unread: admin counts both conversations",async()=>{
    const {service}=fixture();

    assert.deepEqual(
        await service.unread(1,"admin"),
        {
            total:2,
            threads:[
                {id:"17",unread:1},
                {id:"18",unread:1}
            ]
        }
    );
});

test("V17 unread: only selected messages become read",async()=>{
    const {service}=fixture();

    await service.markRead(
        2,"user","17",["101"]
    );

    assert.equal(
        (await service.unread(2,"user")).total,1
    );
});

test("V17 unread: duplicate receipts are idempotent",async()=>{
    const {service,receipts}=fixture();

    await service.markRead(
        2,"user","17",["101","101"]
    );

    await service.markRead(
        2,"user","17",["101"]
    );

    assert.equal(receipts.size,1);
    assert.equal(
        (await service.unread(2,"user")).total,1
    );
});

test("V17 unread: own and foreign messages ignored",async()=>{
    const {service,receipts}=fixture();

    await service.markRead(
        2,"user","17",["103","104","105"]
    );

    assert.equal(receipts.size,0);
});

test("V17 unread: outside participant rejected",async()=>{
    const {service,receipts}=fixture();

    await assert.rejects(
        service.markRead(
            3,"user","17",["101"]
        ),
        {status:404}
    );

    assert.equal(receipts.size,0);
});

test("V17 unread: invalid message identifiers rejected",async()=>{
    const {service}=fixture();

    for(const ids of [
        [],
        ["abc"],
        ["-1"],
        [101],
        Array(51).fill("101")
    ]){
        await assert.rejects(
            service.markRead(
                2,"user","17",ids
            ),
            {status:400}
        );
    }
});

test("V17 unread: unknown roles rejected",async()=>{
    const {service}=fixture();

    await assert.rejects(
        service.unread(2,"unknown"),
        {status:403}
    );
});

test("V17 unread: other admin cannot mark messages",async()=>{
    const {service}=fixture();

    await assert.rejects(
        service.markRead(
            4,"admin","17",["103"]
        ),
        {status:404}
    );
});

test("V17 unread: all received messages read",async()=>{
    const {service}=fixture();

    await service.markRead(
        2,"user","17",["101","102"]
    );

    assert.deepEqual(
        await service.unread(2,"user"),
        {total:0,threads:[]}
    );

    assert.equal(
        (await service.unread(1,"admin")).total,2
    );
});