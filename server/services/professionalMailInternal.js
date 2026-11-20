'use strict';

const crypto = require('node:crypto');
const {email, validateSend, folder, messageId} =
    require('./professionalMailGateway');

function error(message, status = 403) {
    return Object.assign(new Error(message), {status});
}

function internalAddress(address) {
    return email(address) &&
        /^[a-z0-9-]+\.taskly\.test$/.test(address.split('@')[1]);
}

function createInternalGateway({transaction, profil, correspond, env = process.env, clientEnabled = false}) {

    const configured =
        env.TASKLY_MAIL_INTERNAL_ENABLED === 'true' &&
        env.TASKLY_MAIL_GATEWAY_ENABLED !== 'true';

    const foldersEnabled = configured && env.TASKLY_MAIL_FOLDERS_ENABLED === 'true';
    const copyId = v => {if(typeof v!=='string'||!/^[1-9][0-9]{0,19}$/.test(v)||BigInt(v)>18446744073709551615n)throw error('Identifiant invalide.',400);return v;};
    const filters = {inbox:"folder='inbox' AND archived_at IS NULL AND trashed_at IS NULL",sent:"folder='sent' AND archived_at IS NULL AND trashed_at IS NULL",favorites:"is_starred=1 AND trashed_at IS NULL",archive:'archived_at IS NOT NULL AND trashed_at IS NULL',trash:'trashed_at IS NOT NULL'};
    const clientFields =
        clientEnabled === true
        ? ', r.client_id' : '';

    async function active(conn, id) {
        const p = await profil(conn, id);

        const [rows] = await conn.query(
            `SELECT m.*, r.artisan_id, r.service_id, r.personal_email,
                    r.proposed_address${clientFields}
             FROM taskly_professional_mailboxes m
             JOIN taskly_professional_mail_requests r
               ON r.user_id = m.user_id
             WHERE m.user_id = ?
               AND m.activated_at IS NOT NULL
               AND r.status = 'approved_pending_provider'
             FOR UPDATE`,
            [id]
        );

        const m = rows[0];

        if (!m || !correspond(p, m) ||
            m.address !== m.proposed_address ||
            !internalAddress(m.address) ||
            !/^internal:[a-f0-9]{64}$/.test(m.provider_id)) {
            throw error('Boite interne non autorisee.');
        }

        return m;
    }

    async function own(conn, mailbox) {
        const m = await active(conn, mailbox.user_id);

        if (m.provider_id !== mailbox.provider_id ||
            m.address !== mailbox.address) {
            throw error('Acces refuse.');
        }

        return m;
    }

    function format(m) {
        return {
            id: m.message_id,
            from: m.from_address,
            to: m.to_address,
            subject: m.subject,
            body: m.body,
            date: new Date(m.created_at).toISOString(),
            isRead: Boolean(m.is_read),
            ...(m.sequence_id?{copyId:String(m.sequence_id),folder:m.folder,starred:Boolean(m.is_starred),archived:Boolean(m.archived_at),trashed:Boolean(m.trashed_at)}:{})
        };
    }

    return {
        configured, foldersEnabled,
        async listCopies(mailbox, box, next, q='') {
            if(!foldersEnabled)throw error('Dossiers indisponibles.',503);
            if(!Object.hasOwn(filters,box)||typeof q!=='string'||q.length>100)throw error('Recherche invalide.',400);
            if(next)copyId(next);
            return transaction(async conn=>{
                const m=await own(conn,mailbox),params=[m.user_id,q,q];if(next)params.push(next);
                const [rows]=await conn.query(`SELECT CAST(id AS CHAR) AS sequence_id,message_id,folder,from_address,to_address,subject,created_at,is_read,is_starred,archived_at,trashed_at FROM taskly_professional_mail_messages WHERE owner_user_id=? AND ${filters[box]} AND (?='' OR LOCATE(LOWER(?),LOWER(CONCAT_WS(' ',from_address,to_address,subject,body)))>0) ${next?'AND id<CAST(? AS UNSIGNED)':''} ORDER BY id DESC LIMIT 26`,params);
                const page=rows.slice(0,25);return {messages:page.map(format),next:rows.length>25?page.at(-1).sequence_id:null};
            });
        },
        async readCopy(mailbox,id) {
            if(!foldersEnabled)throw error('Dossiers indisponibles.',503);copyId(id);
            return transaction(async conn=>{const m=await own(conn,mailbox);const [rows]=await conn.query('SELECT *,CAST(id AS CHAR) AS sequence_id FROM taskly_professional_mail_messages WHERE owner_user_id=? AND id=CAST(? AS UNSIGNED) FOR UPDATE',[m.user_id,id]);if(!rows[0])throw error('Message introuvable.',404);if(rows[0].folder==='inbox')await conn.query('UPDATE taskly_professional_mail_messages SET is_read=1 WHERE owner_user_id=? AND id=CAST(? AS UNSIGNED)',[m.user_id,id]);return format({...rows[0],is_read:1});});
        },
        async changeCopy(mailbox,id,action) {
            if(!foldersEnabled)throw error('Dossiers indisponibles.',503);copyId(id);
            const updates={star:'is_starred=1',unstar:'is_starred=0',archive:'archived_at=NOW()',unarchive:'archived_at=NULL',trash:'trashed_at=NOW()',restore:'trashed_at=NULL'};
            if(!Object.hasOwn(updates,action))throw error('Action invalide.',400);
            return transaction(async conn=>{const m=await own(conn,mailbox);const [rows]=await conn.query('SELECT trashed_at FROM taskly_professional_mail_messages WHERE owner_user_id=? AND id=CAST(? AS UNSIGNED) FOR UPDATE',[m.user_id,id]);if(!rows[0])throw error('Message introuvable.',404);if(rows[0].trashed_at&&!['restore','trash'].includes(action))throw error('Restaurez le message auparavant.',409);await conn.query(`UPDATE taskly_professional_mail_messages SET ${updates[action]} WHERE owner_user_id=? AND id=CAST(? AS UNSIGNED)`,[m.user_id,id]);return {ok:true};});
        },
        async counts(mailbox) {
            if(!foldersEnabled)throw error('Dossiers indisponibles.',503);
            return transaction(async conn=>{const m=await own(conn,mailbox);const [rows]=await conn.query("SELECT COUNT(*) AS total FROM taskly_professional_mail_messages WHERE owner_user_id=? AND folder='inbox' AND is_read=0 AND archived_at IS NULL AND trashed_at IS NULL",[m.user_id]);return {unread:Number(rows[0].total)};});
        },

        async provision(address, key) {
            if (!configured || !internalAddress(address) ||
                !/^[a-f0-9]{64}$/.test(key)) {
                throw error('Creation indisponible.', 503);
            }

            return 'internal:' + key;
        },

        async list(mailbox, box, next) {
            const f = folder(box);

            if (!configured) throw error('Service indisponible.', 503);

            if (next && (
                !/^[1-9][0-9]{0,19}$/.test(next) ||
                BigInt(next) > 18446744073709551615n
            )) {
                throw error('Curseur invalide.', 400);
            }

            return transaction(async conn => {
                const m = await own(conn, mailbox);
                const params = [m.user_id, f];

                if (next) params.push(next);

                const [rows] = await conn.query(
                    `SELECT CAST(id AS CHAR) AS sequence_id,
                            message_id, from_address, to_address,
                            subject, created_at, is_read
                     FROM taskly_professional_mail_messages
                     WHERE owner_user_id = ? AND folder = ?
                       AND trashed_at IS NULL
                       AND archived_at IS NULL
                       ${next ? 'AND id < CAST(? AS UNSIGNED)' : ''}
                     ORDER BY id DESC LIMIT 26`,
                    params
                );

                const page = rows.slice(0, 25);

                return {
                    messages: page.map(format),
                    next: rows.length > 25
                        ? page.at(-1).sequence_id : null
                };
            });
        },

        async read(mailbox, id) {
            if (!configured) throw error('Service indisponible.', 503);

            messageId(id);

            return transaction(async conn => {
                const m = await own(conn, mailbox);

                const [rows] = await conn.query(
                    `SELECT * FROM taskly_professional_mail_messages
                     WHERE owner_user_id = ? AND message_id = ?
                       AND trashed_at IS NULL
                     ORDER BY folder ASC LIMIT 1`,
                    [m.user_id, id]
                );

                if (!rows[0]) throw error('Message introuvable.', 404);

                await conn.query(
                    `UPDATE taskly_professional_mail_messages
                     SET is_read = 1
                     WHERE owner_user_id = ? AND message_id = ?
                       AND folder = 'inbox'`,
                    [m.user_id, id]
                );

                return format({...rows[0], is_read: 1});
            });
        },

        async send(mailbox, value) {
            if (!configured) throw error('Service indisponible.', 503);

            const d = validateSend(value);
            d.to = d.to.toLowerCase();
            d.key = d.key.toLowerCase();

            if (!internalAddress(d.to)) {
                throw error('Seules les adresses Taskly internes sont acceptees.', 400);
            }

            return transaction(async conn => {

                const [targets] = await conn.query(
                    `SELECT user_id FROM taskly_professional_mailboxes
                     WHERE address = ?`,
                    [d.to]
                );

                const senderId = Number(mailbox.user_id);
                const targetId = Number(targets[0]?.user_id || 0);

                const ids = [...new Set([senderId, targetId])]
                    .filter(id => id > 0)
                    .sort((a, b) => a - b);

                const accounts = new Map();

                for (const id of ids) {
                    accounts.set(id, await active(conn, id));
                }

                const sender = accounts.get(senderId);
                const target = accounts.get(targetId);

                if (!sender ||
                    sender.provider_id !== mailbox.provider_id ||
                    sender.address !== mailbox.address) {
                    throw error('Acces refuse.');
                }

                const [existing] = await conn.query(
                    `SELECT message_id, to_address, subject, body
                     FROM taskly_professional_mail_messages
                     WHERE owner_user_id = ?
                       AND idempotency_key = ?
                     FOR UPDATE`,
                    [senderId, d.key]
                );

                if (existing[0]) {
                    const old = existing[0];

                    if (old.to_address !== d.to ||
                        old.subject !== d.subject ||
                        old.body !== d.body) {
                        throw error('Identifiant envoi deja utilise.', 409);
                    }

                    return {id: old.message_id};
                }

                if (!target || target.address !== d.to) {
                    throw error('Destinataire indisponible.', 404);
                }

                const id = crypto.randomUUID();

                await conn.query(
                    `INSERT INTO taskly_professional_mail_messages
                     (owner_user_id, message_id, idempotency_key,
                      folder, from_address, to_address,
                      subject, body, is_read)
                     VALUES
                     (?, ?, ?, 'sent', ?, ?, ?, ?, 1),
                     (?, ?, NULL, 'inbox', ?, ?, ?, ?, 0)`,
                    [
                        senderId, id, d.key, sender.address,
                        target.address, d.subject, d.body,
                        targetId, id, sender.address,
                        target.address, d.subject, d.body
                    ]
                );

                return {id};
            });
        }
    };
}

module.exports = {createInternalGateway, internalAddress};
