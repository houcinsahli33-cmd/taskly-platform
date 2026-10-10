// Pas de faux envoi d'email : un SMTP reel doit etre configure.
const nodemailer = require('nodemailer');
function estConfigure() {return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM);}
async function envoyerCode(email, code, usage) {
  if (!estConfigure()) { const e = new Error('SMTP non configure : voir README_SECURITE.md');e.status=503;throw e; }
  const transporter=nodemailer.createTransport({
    host:process.env.SMTP_HOST, port:Number(process.env.SMTP_PORT || 587),
    secure:process.env.SMTP_SECURE === 'true',
    auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}
  });
  await transporter.sendMail({from:process.env.MAIL_FROM,to:email,
    subject:usage === 'admin_login' ? 'Code de connexion administration Taskly' : 'Code de verification Taskly',
    text:`Votre code de verification : ${code}\nIl expire dans 3 minutes. Vous avez 3 tentatives. Ne le partagez avec personne.`});
}
module.exports={envoyerCode,estConfigure};
