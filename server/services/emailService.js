'use strict';

const nodemailer = require('nodemailer');

function estConfigure() {
    return Boolean(
        process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        process.env.MAIL_FROM
    );
}

async function envoyerCode(email, code, usage) {

    if (!estConfigure()) {
        const e = new Error('SMTP non configure');
        e.status = 503;
        throw e;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        // TLS obligatoire en production, y compris STARTTLS sur le port 587.
        connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
        requireTLS: process.env.NODE_ENV === 'production' && process.env.SMTP_SECURE !== 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    let subject = 'Code de verification Taskly';

    let text = `Votre code de verification : ${code}

Il expire dans 3 minutes.
Vous avez 3 tentatives.
Ne le partagez avec personne.`;

    if (usage === 'admin_login') {

        subject = 'Code de connexion administration Taskly';

    } else if (usage === 'password_reset') {

        subject = 'Réinitialisation de votre mot de passe Taskly';

        text = `Bonjour,

Vous avez demandé la réinitialisation de votre mot de passe Taskly.

Votre code de récupération est : ${code}

Ce code est valable pendant 3 minutes.
Vous disposez de 3 tentatives maximum.

Ne communiquez jamais ce code à une autre personne.

Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail.

Cordialement,
L'équipe Taskly.`;
    }

    await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject,
        text
    });
}

module.exports = {
    envoyerCode,
    estConfigure
};
