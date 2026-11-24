"use strict";

const { randomUUID } = require("node:crypto");

const fail = (message,status=400) =>
    Object.assign(new Error(message),{status});

const activeStates = new Set([
    "ringing","accepted"
]);

function validateCallId(value) {
    if(typeof value !== "string" ||
       !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) {
        throw fail("Identifiant appel invalide.");
    }

    return value;
}

function nextState(call,uid,action) {
    const caller = Number(call.caller_user_id) === uid;
    const recipient =
        Number(call.recipient_user_id) === uid;

    if(!caller && !recipient) {
        throw fail("Appel introuvable.",404);
    }

    if(!["accept","reject","cancel","end"].includes(action)){
        throw fail("Action invalide.");
    }

    if(["accept","reject"].includes(action) && !recipient) {
        throw fail("Action reservee au destinataire.",403);
    }

    if(action === "cancel" && !caller) {
        throw fail("Action reservee a appelant.",403);
    }

    if(call.state === "ringing") {
        if(action === "accept") return "accepted";
        if(action === "reject") return "rejected";
        if(action === "cancel") return "cancelled";
    }

    if(call.state === "accepted" && action === "end") {
        return "ended";
    }

    throw fail("Etat appel incompatible.",409);
}

function createCallService({
    tx,check,id,threadId
}) {
    if([tx,check,id,threadId].some(
        fn=>typeof fn !== "function"
    )){
        throw new TypeError("Dependances appels invalides.");
    }

    function publicCall(row) {
        return {
            id:String(row.id),
            threadId:String(row.thread_id),
            callerUserId:Number(row.caller_user_id),
            recipientUserId:Number(row.recipient_user_id),
            kind:row.kind,
            state:row.state,
            createdAt:row.created_at,
            updatedAt:row.updated_at
        };
    }

    async function lock(c,user,role,thread) {
        const participants =
            await check(c,user,role,thread);

        const [rows] = await c.query(
            `SELECT CAST(id AS CHAR) AS id
             FROM taskly_admin_private_threads
             WHERE id=CAST(? AS UNSIGNED)
             FOR UPDATE`,
            [thread]
        );

        if(!rows[0]) {
            throw fail("Conversation introuvable.",404);
        }

        // Expire calls using the database clock.

        await c.query(
            `UPDATE taskly_admin_private_calls
             SET state=CASE
                 WHEN state='ringing' THEN 'missed'
                 ELSE 'ended'
             END,
             updated_at=UTC_TIMESTAMP(3)
             WHERE thread_id=CAST(? AS UNSIGNED)
               AND state IN ('ringing','accepted')
               AND expires_at<=UTC_TIMESTAMP(3)`,
            [thread]
        );

        return participants;
    }

    async function find(c,thread,callId) {
        const [rows] = await c.query(
            `SELECT id,
                    CAST(thread_id AS CHAR) AS thread_id,
                    caller_user_id,recipient_user_id,
                    kind,state,created_at,updated_at
             FROM taskly_admin_private_calls
             WHERE thread_id=CAST(? AS UNSIGNED)
               AND id=?
             LIMIT 1`,
            [thread,callId]
        );

        if(!rows[0]) {
            throw fail("Appel introuvable.",404);
        }

        return rows[0];
    }

    async function start(uid,role,tid,kind) {
        const user=id(uid);
        const thread=threadId(tid);

        if(!["audio","video"].includes(kind)) {
            throw fail("Type appel invalide.");
        }

        return tx(async c=>{
            const t=await lock(c,user,role,thread);

            const recipient=Number(
                role==="admin"
                    ? t.member_user_id
                    : t.admin_user_id
            );

            const [existing]=await c.query(
                `SELECT id
                 FROM taskly_admin_private_calls
                 WHERE thread_id=CAST(? AS UNSIGNED)
                   AND state IN ('ringing','accepted')
                 LIMIT 1 FOR UPDATE`,
                [thread]
            );

            if(existing.length) {
                throw fail("Appel deja en cours.",409);
            }

            // Both participants need a published public key.
            // Browser fingerprint verification remains mandatory
            // before the future media connection.

            const [keys]=await c.query(
                `SELECT user_id
                 FROM taskly_admin_private_public_keys
                 WHERE thread_id=CAST(? AS UNSIGNED)
                   AND user_id IN (?,?)`,
                [thread,user,recipient]
            );

            if(new Set(
                keys.map(k=>Number(k.user_id))
            ).size !== 2) {
                throw fail(
                    "Identites cryptographiques indisponibles.",
                    409
                );
            }

            const callId=randomUUID();

            await c.query(
                `INSERT INTO taskly_admin_private_calls
                   (id,thread_id,caller_user_id,
                    recipient_user_id,kind,state,
                    created_at,updated_at,expires_at)
                 VALUES (?,CAST(? AS UNSIGNED),?,?,?,
                   'ringing',
                   UTC_TIMESTAMP(3),
                   UTC_TIMESTAMP(3),
                   DATE_ADD(
                       UTC_TIMESTAMP(3),
                       INTERVAL 3 MINUTE
                   ))`,
                [callId,thread,user,recipient,kind]
            );

            return publicCall(
                await find(c,thread,callId)
            );
        });
    }

    async function get(uid,role,tid,cid) {
        const user=id(uid);
        const thread=threadId(tid);
        const callId=validateCallId(cid);

        return tx(async c=>{
            await lock(c,user,role,thread);

            return publicCall(
                await find(c,thread,callId)
            );
        });
    }

    async function current(uid,role,tid) {
        const user=id(uid);
        const thread=threadId(tid);

        return tx(async c=>{
            await lock(c,user,role,thread);

            const [rows]=await c.query(
                `SELECT id,
                        CAST(thread_id AS CHAR) AS thread_id,
                        caller_user_id,recipient_user_id,
                        kind,state,created_at,updated_at
                 FROM taskly_admin_private_calls
                 WHERE thread_id=CAST(? AS UNSIGNED)
                   AND state IN ('ringing','accepted')
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [thread]
            );

            return {
                call:rows[0]
                    ? publicCall(rows[0])
                    : null
            };
        });
    }

    async function transition(
        uid,role,tid,cid,action
    ) {
        const user=id(uid);
        const thread=threadId(tid);
        const callId=validateCallId(cid);

        return tx(async c=>{
            await lock(c,user,role,thread);

            const call=await find(
                c,thread,callId
            );

            const state=nextState(
                call,user,action
            );

            await c.query(
                `UPDATE taskly_admin_private_calls
                 SET state=?,
                     updated_at=UTC_TIMESTAMP(3),
                     expires_at=CASE
                         WHEN ?='accepted'
                         THEN DATE_ADD(
                             UTC_TIMESTAMP(3),
                             INTERVAL 2 HOUR
                         )
                         ELSE UTC_TIMESTAMP(3)
                     END
                 WHERE id=?
                   AND thread_id=CAST(? AS UNSIGNED)
                   AND state=?`,
                [state,state,callId,thread,call.state]
            );

            return publicCall(
                await find(c,thread,callId)
            );
        });
    }

    return {start,get,current,transition};
}

module.exports={
    createCallService,
    nextState,
    validateCallId,
    activeStates
};