
const nodemailer = require("nodemailer");

async function envoyerCourrielAdmin(destination, sujet, corps, expediteur = process.env.MAIL_FROM) {
  const {
    SMTP_HOST,
    SMTP_USER,
    SMTP_PASS,
    MAIL_FROM
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !expediteur) {
    const erreur = new Error(
      "La messagerie transactionnelle n'est pas configuree."
    );

    erreur.status = 503;
    throw erreur;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: expediteur,
    to: destination,
    subject: sujet,
    text: corps
  });
}

module.exports = {
  envoyerCourrielAdmin
};
