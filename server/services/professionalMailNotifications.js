'use strict';
const crypto = require('node:crypto');
const {email} = require('./professionalMailGateway');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const invalid = () => Object.assign(new Error('Lien invalide, expiré ou déjà utilisé.'), {status:404});
function origin(env) {
    try {
        const u = new URL(env.PUBLIC_SITE_URL);
        if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash) return null;
        return u.origin;
    } catch { return null; }
}
function configured(env) {
    return env.TASKLY_MAIL_PILOT_ENABLED === 'true' && env.TASKLY_MAIL_INTERNAL_ENABLED === 'true' &&
        env.TASKLY_MAIL_GATEWAY_ENABLED !== 'true' && env.TASKLY_MAIL_READ_LINK_ENABLED === 'true' && Boolean(origin(env));
}
function notification(site, token) {
    const link = site + '/taskly-mail/consulter#' + token;
    const subject = 'Taskly Mail — Nouveau message';
    const text = `Un nouveau message vous attend dans Taskly Mail.\n\nConsulter mon message : ${link}\n\nCe lien permet une seule lecture pendant 30 minutes. Ne le transmettez pas. Pour répondre ou accéder à votre boîte, connectez-vous à Taskly.`;
    const safeLink = link.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    const html = `<html lang="fr"><body style="background:#eff6f2;padding:24px;font-family:Arial,sans-serif;color:#163e32"><main style="max-width:540px;margin:auto;padding:28px;background:white;border:1px solid #dcebe3;border-radius:16px"><strong style="font-size:24px;color:#087e63">Taskly Mail</strong><h1 style="font-size:22px">Vous avez reçu un nouveau message</h1><p>Un message vous attend dans votre boîte professionnelle.</p><p><a style="display:inline-block;background:#087e63;color:white;padding:14px 20px;border-radius:9px;text-decoration:none;font-weight:bold" href="${safeLink}">Consulter mon message</a></p><p>Accès à un seul message, valable 30 minutes et utilisable une seule fois. Ne partagez pas ce lien.</p><p>Pour répondre, connectez-vous à Taskly. Votre adresse personnelle reste confidentielle.</p></main></body></html>`;
    return {subject,text,html};
}
async function sendSMTP(to, message, env) {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.MAIL_FROM) throw new Error('SMTP indisponible');
    const transport = require('nodemailer').createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||587),secure:env.SMTP_SECURE==='true',requireTLS:env.SMTP_SECURE!=='true',auth:{user:env.SMTP_USER,pass:env.SMTP_PASS},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000});
    await transport.sendMail({from:env.MAIL_FROM,to,...message});
}
function createNotifications({transaction, active, format, env=process.env, send=sendSMTP}) {
    async function enqueue(conn, owner, id) {
        await conn.query('INSERT INTO taskly_mail_read_notifications (owner_user_id,message_id) VALUES (?,?) ON DUPLICATE KEY UPDATE message_id=message_id',[owner,id]);
    }
    async function inbox(conn, owner, id) {
        const [rows] = await conn.query("SELECT * FROM taskly_professional_mail_messages WHERE owner_user_id=? AND message_id=? AND folder='inbox' AND trashed_at IS NULL FOR UPDATE",[owner,id]);
        return rows[0];
    }
    async function deliver(owner,id) {
        if (!configured(env)) return false;
        const token=crypto.randomBytes(32).toString('hex'), digest=hash(token);
        const claim=await transaction(async conn=>{
            let mailbox;
            try { mailbox=await active(conn,owner); } catch(e) { if(e.status!==403)throw e; }
            const [rows]=await conn.query(`SELECT status,attempts,used_at,(last_attempt IS NULL OR last_attempt < DATE_SUB(UTC_TIMESTAMP(),INTERVAL 5 MINUTE)) AS retry_due FROM taskly_mail_read_notifications WHERE owner_user_id=? AND message_id=? FOR UPDATE`,[owner,id]);
            const row=rows[0];
            if(!row||row.used_at||row.attempts>=5||!['pending','sending','failed'].includes(row.status)||(row.status!=='pending'&&Number(row.retry_due)!==1))return null;
            const msg=mailbox&&await inbox(conn,owner,id);
            if(!msg||!email(mailbox.notificationEmail)||msg.to_address!==mailbox.address){
                await conn.query("UPDATE taskly_mail_read_notifications SET status='cancelled',token_hash=NULL WHERE owner_user_id=? AND message_id=?",[owner,id]);return null;
            }
            await conn.query("UPDATE taskly_mail_read_notifications SET status='sending',attempts=attempts+1,last_attempt=UTC_TIMESTAMP(),token_hash=?,email_hash=?,expires_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 MINUTE) WHERE owner_user_id=? AND message_id=?",[digest,hash(mailbox.notificationEmail),owner,id]);
            return {to:mailbox.notificationEmail};
        });
        if(!claim)return false;
        try {
            await send(claim.to,notification(origin(env),token),env);
        } catch {
            await transaction(conn=>conn.query("UPDATE taskly_mail_read_notifications SET status='failed',token_hash=NULL WHERE owner_user_id=? AND message_id=? AND token_hash=? AND status='sending' AND used_at IS NULL",[owner,id,digest]));
            return false;
        }
        await transaction(conn=>conn.query("UPDATE taskly_mail_read_notifications SET status='sent' WHERE owner_user_id=? AND message_id=? AND token_hash=? AND status='sending'",[owner,id,digest]));
        return true;
    }
    async function redeem(token) {
        if (!configured(env)||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw invalid();
        const digest=hash(token);
        // First lookup is not a lock. All mutations lock profile, notification, then message.
        return transaction(async conn=>{
            const [lookup]=await conn.query('SELECT owner_user_id,message_id FROM taskly_mail_read_notifications WHERE token_hash=?',[digest]);
            const ref=lookup[0];if(!ref)throw invalid();
            let m;try{m=await active(conn,ref.owner_user_id);}catch(e){if(e.status===403)throw invalid();throw e;}
            const [rows]=await conn.query("SELECT email_hash FROM taskly_mail_read_notifications WHERE owner_user_id=? AND message_id=? AND token_hash=? AND status IN ('sending','sent') AND used_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE",[ref.owner_user_id,ref.message_id,digest]);
            if(!rows[0]||!email(m.notificationEmail)||rows[0].email_hash!==hash(m.notificationEmail))throw invalid();
            const msg=await inbox(conn,ref.owner_user_id,ref.message_id);
            if(!msg||msg.to_address!==m.address)throw invalid();
            const [result]=await conn.query('UPDATE taskly_mail_read_notifications SET used_at=UTC_TIMESTAMP(),status=\'sent\' WHERE owner_user_id=? AND message_id=? AND token_hash=? AND used_at IS NULL AND expires_at>UTC_TIMESTAMP()',[ref.owner_user_id,ref.message_id,digest]);
            if(result.affectedRows!==1)throw invalid();
            await conn.query("UPDATE taskly_professional_mail_messages SET is_read=1 WHERE owner_user_id=? AND message_id=? AND folder='inbox'",[ref.owner_user_id,ref.message_id]);
            return format({...msg,is_read:1});
        });
    }
    async function retry() {
        if(!configured(env))return 0;
        const [rows]=await transaction(conn=>conn.query("SELECT owner_user_id,message_id FROM taskly_mail_read_notifications WHERE used_at IS NULL AND attempts<5 AND (status='pending' OR (status IN ('sending','failed') AND last_attempt<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 5 MINUTE))) ORDER BY created_at LIMIT 3"));
        let count=0;for(const r of rows){try{if(await deliver(r.owner_user_id,r.message_id))count++;}catch(e){console.error('Notification Taskly Mail :',e.code||e.name);}}
        return count;
    }
    return {enqueue,deliver,redeem,retry};
}
module.exports={createNotifications,configured,origin,notification,hash};
