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
            callerProof:row.caller_proof || null,
            recipientProof:row.recipient_proof || null,
            remainingMs:Math.max(0,Number(row.remaining_ms)||0),
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
                    kind,state,created_at,updated_at,
                    caller_proof,recipient_proof,
                    TIMESTAMPDIFF(MICROSECOND,UTC_TIMESTAMP(3),expires_at) DIV 1000 AS remaining_ms
             FROM taskly_admin_private_calls
             WHERE thread_id=CAST(? AS UNSIGNED)
               AND id=?
             LIMIT 1 FOR UPDATE`,
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
                        kind,state,created_at,updated_at,
                    caller_proof,recipient_proof,
                    TIMESTAMPDIFF(MICROSECOND,UTC_TIMESTAMP(3),expires_at) DIV 1000 AS remaining_ms
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

            if(action==="accept" && (!call.caller_proof || !call.recipient_proof)){
                throw fail("Confirmation cryptographique incomplete.",409);
            }

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

    async function publishProof(uid,role,tid,cid,proof){
        const user=id(uid),thread=threadId(tid),callId=validateCallId(cid);
        if(typeof proof!=="string"||!/^[a-f0-9]{64}$/.test(proof))throw fail("Preuve invalide.");
        return tx(async c=>{
            await lock(c,user,role,thread);
            const call=await find(c,thread,callId);
            if(call.state!=="ringing")throw fail("Appel non disponible.",409);
            const caller=Number(call.caller_user_id)===user;
            if(!caller&&Number(call.recipient_user_id)!==user)throw fail("Appel introuvable.",404);
            const column=caller?"caller_proof":"recipient_proof";
            if(!caller&&!call.caller_proof)throw fail("Offre non confirmee.",409);
            if(call[column]&&call[column]!==proof)throw fail("Preuve deja enregistree.",409);
            await c.query(`UPDATE taskly_admin_private_calls SET ${column}=?
                WHERE id=? AND thread_id=CAST(? AS UNSIGNED) AND state='ringing' AND (${column} IS NULL OR ${column}=?)`,[proof,callId,thread,proof]);
            return publicCall(await find(c,thread,callId));
        });
    }
    async function incoming(uid,role){
        const user=id(uid);
        if(!["admin","user"].includes(role))throw fail("Role invalide.",403);
        const own=role==="admin"?"admin_user_id":"member_user_id";
        const peer=role==="admin"?"member_user_id":"admin_user_id";
        const selfRole=role==="admin"?"u.role='admin'":"u.role IN ('client','artisan')";
        const peerRole=role==="admin"?"p.role IN ('client','artisan')":"p.role='admin'";
        return tx(async c=>{
            const [rows]=await c.query(`SELECT a.id,CAST(a.thread_id AS CHAR) AS thread_id,
                a.caller_user_id,a.recipient_user_id,a.kind,a.state,a.created_at,a.updated_at,
                a.caller_proof,a.recipient_proof,
                TIMESTAMPDIFF(MICROSECOND,UTC_TIMESTAMP(3),a.expires_at) DIV 1000 AS remaining_ms,
                p.id AS peer_id,p.role AS peer_role,CONCAT_WS(' ',p.prenom,p.nom) AS peer_name
                FROM taskly_admin_private_calls a JOIN taskly_admin_private_threads t ON t.id=a.thread_id
                JOIN users u ON u.id=t.${own} JOIN users p ON p.id=t.${peer}
                WHERE t.${own}=? AND a.recipient_user_id=? AND a.caller_user_id=p.id
                AND a.state='ringing' AND a.expires_at>UTC_TIMESTAMP(3) AND a.caller_proof IS NOT NULL
                AND ${selfRole} AND ${peerRole} AND u.statut_compte='actif' AND p.statut_compte='actif'
                AND u.email_verified=1 AND p.email_verified=1 ORDER BY a.created_at LIMIT 10`,[user,user]);
            return {calls:rows.map(row=>({...publicCall(row),peer:{userId:Number(row.peer_id),role:row.peer_role,name:row.peer_name}}))};
        });
    }
    async function mediaToken(uid,role,tid,cid,sessionRole){
        const user=id(uid),thread=threadId(tid),callId=validateCallId(cid);
        return tx(async c=>{
            await lock(c,user,role,thread);
            const call=await find(c,thread,callId);
            if(call.state!=="accepted"||!call.caller_proof||!call.recipient_proof||Number(call.remaining_ms)<=0)throw fail("Appel non confirme.",409);
            const [accounts]=await c.query("SELECT role FROM users WHERE id=? AND statut_compte='actif' AND email_verified=1 LIMIT 1",[user]);
            if(accounts[0]?.role!==sessionRole)throw fail("Session invalide.",403);
            return require("./tasklyAdminPrivateLiveKitV17").issueToken({call:publicCall(call),userId:user,role:sessionRole});
        });
    }
    return {start,get,current,transition,publishProof,incoming,mediaToken};
}

module.exports={
    createCallService,
    nextState,
    validateCallId,
    activeStates
};