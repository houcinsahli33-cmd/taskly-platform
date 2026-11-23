'use strict';

const crypto = require('node:crypto');
const {email, validateSend, folder, messageId} =
    require('./professionalMailGateway');

function error(message, status = 403) {
    return Object.assign(new Error(message), {status});
}

function internalAddress(address) {
    return email(address) &&
        /^[a-z0-9-]+\.taskly\.(?:test|dz)$/.test(address.split('@')[1]);
}

function createInternalGateway({transaction, profil, correspond, env = process.env, clientEnabled = false, enableNotifications = false, sendNotification, attachmentStorage}) {

    const configured =
        env.TASKLY_MAIL_INTERNAL_ENABLED === 'true' &&
        env.TASKLY_MAIL_GATEWAY_ENABLED !== 'true';

    const foldersEnabled = configured && env.TASKLY_MAIL_FOLDERS_ENABLED === 'true';
    const attachmentsEnabled = foldersEnabled && env.TASKLY_MAIL_ATTACHMENTS_ENABLED === 'true';
    const attachments = require('./professionalMailAttachments');
    const copyId = v => {if(typeof v!=='string'||!/^[1-9][0-9]{0,19}$/.test(v)||BigInt(v)>18446744073709551615n)throw error('Identifiant invalide.',400);return v;};
    const filters = {inbox:"folder='inbox' AND archived_at IS NULL AND trashed_at IS NULL",sent:"folder='sent' AND archived_at IS NULL AND trashed_at IS NULL",favorites:"is_starred=1 AND trashed_at IS NULL",archive:'archived_at IS NOT NULL AND trashed_at IS NULL',trash:'trashed_at IS NOT NULL'};
    const clientFields =
        clientEnabled === true
        ? ', r.client_id' : '';

    async function active(conn, id) {
        const p = await profil(conn, id);

        const [rows] = await conn.query(
            `SELECT m.*, r.artisan_id, r.service_id, r.personal_email,
                    r.proposed_address, r.status, r.confirmed_at${clientFields}
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

        if (env.TASKLY_ADMIN_MAIL_V10_ENABLED==='true' && m?.suspended_at)throw error('Boîte désactivée.',403);

        if (!m || !correspond(p, m) ||
            m.address !== m.proposed_address ||
            !internalAddress(m.address) ||
            !/^internal:[a-f0-9]{64}$/.test(m.provider_id)) {
            throw error('Boite interne non autorisee.');
        }

        return enableNotifications ? {...m, notificationEmail:p.email} : m;
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
            ...(typeof m.preview==='string'?{preview:m.preview}:{}),
            date: new Date(m.created_at).toISOString(),
            isRead: Boolean(m.is_read),
            ...(m.sequence_id?{copyId:String(m.sequence_id),folder:m.folder,starred:Boolean(m.is_starred),archived:Boolean(m.archived_at),trashed:Boolean(m.trashed_at)}:{})
        };
    }

    const notifications = enableNotifications && configured ? require('./professionalMailNotifications').createNotifications({transaction,active,format,env,send:sendNotification}) : null;
    return {
        configured, foldersEnabled, attachmentsEnabled,
        async downloadAttachment(mailbox,id) {
            if(!attachmentsEnabled)throw error('Pièces jointes indisponibles.',503);copyId(id);
            return transaction(async conn=>{const m=await own(conn,mailbox);return attachments.download(conn,m.user_id,id);});
        },
        ...(notifications ? {redeemNotification:notifications.redeem,retryNotifications:notifications.retry} : {}),
        async listCopies(mailbox, box, next, q='') {
            if(!foldersEnabled)throw error('Dossiers indisponibles.',503);
            if(!Object.hasOwn(filters,box)||typeof q!=='string'||q.length>100)throw error('Recherche invalide.',400);
            if(next)copyId(next);
            return transaction(async conn=>{
                const m=await own(conn,mailbox),params=[m.user_id,q,q];if(next)params.push(next);
                const [rows]=await conn.query(`SELECT CAST(id AS CHAR) AS sequence_id,message_id,folder,from_address,to_address,subject,LEFT(body,120) AS preview,created_at,is_read,is_starred,archived_at,trashed_at FROM taskly_professional_mail_messages WHERE owner_user_id=? AND ${filters[box]} AND (?='' OR LOCATE(LOWER(?),LOWER(CONCAT_WS(' ',from_address,to_address,subject,body)))>0) ${next?'AND id<CAST(? AS UNSIGNED)':''} ORDER BY id DESC LIMIT 26`,params);
                const page=rows.slice(0,25);return {messages:page.map(format),next:rows.length>25?page.at(-1).sequence_id:null};
            });
        },
        async readCopy(mailbox,id) {
            if(!foldersEnabled)throw error('Dossiers indisponibles.',503);copyId(id);
            return transaction(async conn=>{const m=await own(conn,mailbox);const [rows]=await conn.query('SELECT *,CAST(id AS CHAR) AS sequence_id FROM taskly_professional_mail_messages WHERE owner_user_id=? AND id=CAST(? AS UNSIGNED) FOR UPDATE',[m.user_id,id]);if(!rows[0])throw error('Message introuvable.',404);if(rows[0].folder==='inbox')await conn.query('UPDATE taskly_professional_mail_messages SET is_read=1 WHERE owner_user_id=? AND id=CAST(? AS UNSIGNED)',[m.user_id,id]);return {...format({...rows[0],is_read:1}),...(attachmentsEnabled?{attachments:await attachments.meta(conn,m.user_id,id)}:{})};});
        },
        async changeCopy(mailbox,id,action) {
            if(!foldersEnabled)throw error('Dossiers indisponibles.',503);copyId(id);
            const updates={star:'is_starred=1',unstar:'is_starred=0',archive:'archived_at=NOW()',unarchive:'archived_at=NULL',trash:'trashed_at=NOW()',restore:'trashed_at=NULL'};
            if(!Object.hasOwn(updates,action)&&action!=='delete')throw error('Action invalide.',400);
            return transaction(async conn=>{const m=await own(conn,mailbox);const [rows]=await conn.query('SELECT trashed_at FROM taskly_professional_mail_messages WHERE owner_user_id=? AND id=CAST(? AS UNSIGNED) FOR UPDATE',[m.user_id,id]);if(!rows[0])throw error('Message introuvable.',404);if(action==='delete'){
                    if(!rows[0].trashed_at)throw error('Déplacez le message dans la corbeille auparavant.',409);
                    await conn.query('DELETE FROM taskly_professional_mail_messages WHERE owner_user_id=? AND id=CAST(? AS UNSIGNED) AND trashed_at IS NOT NULL',[m.user_id,id]);
                    return {ok:true};
                }
                if(rows[0].trashed_at&&!['restore','trash'].includes(action))throw error('Restaurez le message auparavant.',409);
                await conn.query(`UPDATE taskly_professional_mail_messages SET ${updates[action]} WHERE owner_user_id=? AND id=CAST(? AS UNSIGNED)`,[m.user_id,id]);return {ok:true};});
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

        async send(mailbox, value, file) {
            if (!configured) throw error('Service indisponible.', 503);

            if(file&&!attachmentsEnabled)throw error('Pièces jointes indisponibles.',503);
            const descriptor=file?attachments.describe(file):null;
            const d = validateSend(value);
            d.to = d.to.toLowerCase();
            d.key = d.key.toLowerCase();

            const specialAdmin=d.to==='administration@taskly.dz' && env.TASKLY_ADMIN_MAIL_V10_ENABLED==='true' && foldersEnabled;
            const specialSupport=d.to==='support@taskly.dz' && env.TASKLY_MAIL_UNIFIED_SUPPORT_ENABLED==='true' && foldersEnabled;
            if (!internalAddress(d.to) && !specialAdmin && !specialSupport) {
                throw error('Seules les adresses Taskly internes sont acceptees.', 400);
            }

            // Administrative destination is a special internal mailbox, not an account.
            // Existing user-to-user delivery remains unchanged when disabled or for other addresses.
            if (specialSupport) {
                if(file)throw error('Pièces jointes Support non encore disponibles.',400);
                const id=await transaction(async conn=>{
                    const sender=await own(conn,mailbox);
                    const [old]=await conn.query('SELECT message_id,to_address,subject,body FROM taskly_professional_mail_messages WHERE owner_user_id=? AND idempotency_key=? FOR UPDATE',[sender.user_id,d.key]);
                    if(old[0]){
                      if(old[0].to_address!==d.to||old[0].subject!==d.subject||old[0].body!==d.body)throw error('Identifiant envoi deja utilise.',409);
                      return old[0].message_id;
                    }
                    // A reply to a Support subject stays in the user's existing private thread.
                    // own() already locks the sender's mailbox row for this transaction.
                    const topic=d.subject.replace(/^(?:Re\s*:\s*)+/i,'').trim() || d.subject;
                    const [existingThreads]=await conn.query(
                      "SELECT id FROM taskly_mail_service_threads WHERE service_name='support' AND user_id=? AND user_address=? AND subject=? ORDER BY id DESC LIMIT 1 FOR UPDATE",
                      [sender.user_id,sender.address,topic]);
                    let threadId=existingThreads[0]?.id;
                    if(!threadId){
                      const [thread]=await conn.query("INSERT INTO taskly_mail_service_threads (service_name,user_id,user_address,subject) VALUES ('support',?,?,?)",[sender.user_id,sender.address,topic]);
                      threadId=thread.insertId;
                    }
                    await conn.query("INSERT INTO taskly_mail_service_entries (thread_id,sender_kind,sender_user_id,body) VALUES (?,'user',?,?)",[threadId,sender.user_id,d.body]);
                    await conn.query('UPDATE taskly_mail_service_threads SET updated_at=NOW() WHERE id=?',[threadId]);
                    const id=crypto.randomUUID();
                    await conn.query("INSERT INTO taskly_professional_mail_messages (owner_user_id,message_id,idempotency_key,folder,from_address,to_address,subject,body,is_read) VALUES (?,?,?,'sent',?,?,?,?,1)",[sender.user_id,id,d.key,sender.address,d.to,d.subject,d.body]);
                    return id;
                });return {id};
            }
            if (specialAdmin) {
                if(file)throw error('Pièces jointes administrateur non encore disponibles.',400);
                const id=await transaction(async conn=>{
                    const sender=await own(conn,mailbox);
                    const [previous]=await conn.query('SELECT message_id,to_address,subject,body FROM taskly_professional_mail_messages WHERE owner_user_id=? AND idempotency_key=? FOR UPDATE',[sender.user_id,d.key]);
                    if(previous[0]){
                        if(previous[0].to_address!==d.to||previous[0].subject!==d.subject||previous[0].body!==d.body)throw error('Identifiant envoi deja utilise.',409);
                        return previous[0].message_id;
                    }
                    const id=crypto.randomUUID();
                    await conn.query("INSERT INTO taskly_admin_mail_messages (message_id,folder,from_address,to_address,subject,body,is_read) VALUES (?,'inbox',?,?,?,?,0)",[id,sender.address,d.to,d.subject,d.body]);
                    await conn.query("INSERT INTO taskly_professional_mail_messages (owner_user_id,message_id,idempotency_key,folder,from_address,to_address,subject,body,is_read) VALUES (?,?,?,'sent',?,?,?,?,1)",[sender.user_id,id,d.key,sender.address,d.to,d.subject,d.body]);
                    return id;
                });
                return {id};
            }

            const result = await transaction(async conn => {

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

                    if(attachmentsEnabled&&!await attachments.retryMatches(conn,senderId,old.message_id,descriptor))throw error('Identifiant envoi deja utilise.',409);
                    return {id: old.message_id, targetId};
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

                if(descriptor)await attachments.save(conn,id,senderId,targetId,file,descriptor,attachmentStorage||require('./fileStorage'));
                if(notifications)await notifications.enqueue(conn,targetId,id);
                return {id,targetId};
            });
            // SMTP is performed only after the two copies and notification are committed.
            if(notifications){try{await notifications.deliver(result.targetId,result.id);}catch(e){console.error('Notification Taskly Mail :',e.code||e.name);}}
            return {id:result.id};
        }
    };
}

module.exports = {createInternalGateway, internalAddress};
