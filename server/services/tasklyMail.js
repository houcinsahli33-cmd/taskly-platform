'use strict';
// File d'envoi persistante. Ne contient ni mot de passe, ni token de session.
const db = require('../config/db').promise();
const nodemailer = require('nodemailer');
const echapper = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

function base() {
    const url = String(process.env.PUBLIC_SITE_URL || '').trim();
    if (!url) return '';
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:')) return '';
        if (parsed.username || parsed.password) return '';
        return parsed.origin;
    } catch { return ''; }
}

function modele(subject, message, link = '', button = 'Ouvrir Taskly') {
    const origin = base();
    const logo = origin ? `<img src="${echapper(origin)}/images/logo/taskly-logo.svg" alt="Taskly" width="126" style="max-width:126px;height:auto">` : '<strong style="font-size:22px">Taskly</strong>';
    const action = link && origin && link.startsWith(origin + '/')
        ? `<p style="margin-top:26px"><a href="${echapper(link)}" style="display:inline-block;padding:14px 22px;background:#007e64;color:#fff;border-radius:10px;text-decoration:none;font-weight:700">${echapper(button)}</a></p>`
        : '<p>Retrouvez votre demande en vous connectant à Taskly depuis votre navigateur.</p>';
    return `<!doctype html><html lang="fr"><body style="margin:0;padding:32px 12px;background:#f1f7f4;font-family:Arial,sans-serif;color:#163e32"><main style="max-width:570px;margin:auto;background:white;padding:30px;border:1px solid #d9e9e2;border-radius:18px">${logo}<h1 style="font-size:24px;line-height:1.35;margin:28px 0 12px">${echapper(subject)}</h1><p style="font-size:16px;line-height:1.7">${echapper(message)}</p>${action}<hr style="border:0;border-top:1px solid #e3eee8;margin-top:30px"><p style="font-size:12px;color:#526f63">Taskly — Notification liée à votre demande. Ne communiquez jamais vos codes de connexion.</p></main></body></html>`;
}

async function mettreEnFile({userId, to, subject, message, link='', button='Ouvrir Taskly', key}) {
    if (!Number.isSafeInteger(Number(userId)) || Number(userId) <= 0 || !to || !key) throw new Error('Notification incomplète.');
    const html = modele(subject, message, link, button);
    await db.query(`INSERT INTO taskly_mail_queue (user_id,destinataire,sujet,corps,html,cle)
        VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id`, [userId,to,subject,message,html,key]);
}

function estConfigure() {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM);
}

async function traiterLot() {
    if (!estConfigure()) return 0;
    // Un worker interrompu ne laisse pas de message définitivement bloqué.
    await db.query(`UPDATE taskly_mail_queue SET statut='failed'
        WHERE statut='sending' AND last_attempt < DATE_SUB(NOW(),INTERVAL 10 MINUTE)`);
    const [rows] = await db.query(`SELECT id,destinataire,sujet,corps,html FROM taskly_mail_queue
        WHERE attempts < 5 AND (statut='pending' OR (statut='failed' AND
        (last_attempt IS NULL OR last_attempt < DATE_SUB(NOW(),INTERVAL 5 MINUTE))))
        ORDER BY id LIMIT 10`);
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},
        connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000
    });
    let sent = 0;
    for (const row of rows) {
        const [claimed] = await db.query(`UPDATE taskly_mail_queue SET statut='sending', attempts=attempts+1, last_attempt=NOW()
            WHERE id=? AND attempts<5 AND (statut='pending' OR (statut='failed'
            AND (last_attempt IS NULL OR last_attempt < DATE_SUB(NOW(),INTERVAL 5 MINUTE))))`, [row.id]);
        if (!claimed.affectedRows) continue;
        try {
            await transporter.sendMail({from:process.env.MAIL_FROM,to:row.destinataire,
                subject:row.sujet,text:row.corps,html:row.html});
            await db.query("UPDATE taskly_mail_queue SET statut='sent',sent_at=NOW() WHERE id=?",[row.id]);
            sent++;
        } catch (error) {
            console.error('Envoi e-mail Taskly :', error.code || error.message);
            await db.query("UPDATE taskly_mail_queue SET statut='failed' WHERE id=?",[row.id]);
        }
    }
    return sent;
}

function demarrer() {
    // Pour un serveur Node durable. En serverless, prévoir également une tâche planifiée externe.
    const timer = setInterval(() => traiterLot().catch(e => console.error('File e-mails :',e.code||e.message)), 60000);
    timer.unref?.();
    traiterLot().catch(e => console.error('File e-mails :',e.code||e.message));
}
module.exports = {base, modele, mettreEnFile, traiterLot, demarrer, estConfigure};
