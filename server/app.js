// Ce fichier prÃƒÂ©pare l'application Express. Il contient la configuration principale du serveur : routes, middlewares, fichiers statiques, sessions et gestion des erreurs.
// Le serveur est lancÃƒÂ© sÃƒÂ©parÃƒÂ©ment dans server.js.

// imports
const express = require("express");

const configurerSession = require('./config/sessionConfig');
const {sessionMesuree} = require('./helpers/performanceTiming');
const {verifierCsrf} = require('./middleware/securityMiddleware');
const adminAuthRoutes=require('./routes/adminAuthRoutes');
const verificationRoutes=require('./routes/verificationRoutes');
const adminVerificationRoutes=require('./routes/adminVerificationRoutes');
const adminSettingsRoutes = require('./routes/adminSettingsRoutes');
const path = require("path");
require("./config/db");

const authRoutes = require("./routes/authRoutes"); //  les routes d'authentification
const serviceRoutes = require("./routes/serviceRoutes"); // les routes de services
const artisanRoutes = require("./routes/artisanRoutes"); // les routes d'artisans
const demandeRoutes = require("./routes/demandeRoutes"); // les routes de demandes
const avisRoutes = require("./routes/avisRoutes"); // les routes d'avis
const adminRoutes = require("./routes/adminRoutes"); // les routes admin
const signalementRoutes = require("./routes/signalementRoutes"); // les routes de signalements
const contactRoutes = require("./routes/contactRoutes"); // les routes de contact/support

// creation de l'application express
const app = express();
// Entree privee : choisissez un chemin aleatoire long dans server/.env.
// Exemple : ADMIN_ENTRY_PATH=/acces-prive-<48 caracteres hexadecimaux>.
// Ce chemin n'est PAS un facteur d'authentification : les controles serveur restent obligatoires.
const adminEntryPath = process.env.ADMIN_ENTRY_PATH;
if (!adminEntryPath || !/^\/[a-z0-9][a-z0-9-]{30,100}$/.test(adminEntryPath)) {
  throw new Error('ADMIN_ENTRY_PATH manquant ou invalide. Definissez un chemin aleatoire long dans server/.env (ex. /acces-prive- suivi de 48 caracteres hexadecimaux).');
}

if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.disable('x-powered-by');
// Les API privées ne doivent pas être mises en cache ni revalidées par ETag.
app.disable('etag');

// Middleware. La session est montee AVANT les pages privees.
function preparerApp(store) {
// Les ressources publiques ne nécessitent pas de lecture de session.
app.use(require('./middleware/publicFiles').publicAssets);
// Même les erreurs de parsing ou de stockage de session ne sont pas cachables.
app.use('/api', (req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next();});
app.use(express.json({limit:'100kb'}));
app.use(express.urlencoded({extended:false,limit:'100kb'}));
// Lecture par jeton uniquement, sans cookie de session ni accès à la boîte.
if (process.env.TASKLY_MAIL_READ_LINK_ENABLED === 'true') {
  const mail = require('./routes/professionalMailRoutes');
  require('./routes/professionalMailReadRoutes').mount(app,{redeem:mail.redeemNotification,retry:mail.retryNotifications,limiter:require('./middleware/securityMiddleware').limiter});
}
// Les comptes publics et administrateurs n'utilisent ni le même cookie ni le même contexte.
const sessionPublique = configurerSession(store, false);
const sessionAdmin = configurerSession(store, true);
app.use((req,res,next)=>{
  const chemin=req.path.toLowerCase().replace(/\/+$/, '') || '/';
  const apiAdmin = chemin==='/api/admin' || chemin.startsWith('/api/admin/') ||
    chemin.startsWith('/api/admin-verification') ||
    (chemin.startsWith('/api/admin-settings') && !chemin.startsWith('/api/admin-settings/invitation')) ||
    chemin.startsWith('/api'+adminEntryPath+'/auth');
  // Ces endpoints sont partagés : seul le portail privé les marque comme admin.
  const partage=['/api/auth/me','/api/auth/logout','/api/auth/activity','/api/auth/csrf'].includes(chemin) &&
    req.get('X-Taskly-Admin')==='1';
  const prive=chemin===adminEntryPath || chemin.startsWith(adminEntryPath+'/') || apiAdmin || partage;
  req.tasklyAdminContext=prive;
  sessionMesuree(prive?sessionAdmin:sessionPublique,req,res,next);
});
app.use(require('./services/sessionActivity').verifierInactivite);
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','DENY');
  if (!res.hasHeader('Cache-Control')) res.setHeader('Cache-Control',req.path === adminEntryPath || req.path.startsWith(adminEntryPath + '/') ? 'no-store, private' : 'no-cache');
  next();
});
// Ne jamais exposer les anciennes URL d'administration.
app.get(['/admin', '/admin/dashboard', '/admin-login.html', '/admin-dashboard.html'], (req, res) =>
  res.status(404).json({ message: 'Route introuvable.' })
);

function headersAdminPrive(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}

app.get(adminEntryPath, headersAdminPrive, (req, res) => {
  if (req.session.utilisateur?.role === 'admin' && req.session.adminVerified === true)
    return res.redirect(302, adminEntryPath + '/dashboard');
  res.sendFile(path.join(__dirname, '../client/private/admin-login.html'), {dotfiles:'allow'});
});

require('./routes/clientWorkspaceNavigation')(app);
require('./routes/artisanWorkspaceNavigation')(app);
require('./routes/workspacePages')(app,{adminEntryPath,headersAdminPrive});
app.use(require('./middleware/publicFiles').publicFiles);
app.get('/api/media/:id',async(req,res)=>{
  try {
    const file=await require('./services/fileStorage').lire(req.params.id,false);
    if(!file || !['image/jpeg','image/png'].includes(file.media_type))return res.status(404).end();
    res.set('Content-Type',file.media_type);res.set('Cache-Control','public,max-age=86400');res.send(file.contenu);
  } catch(e) {res.status(503).end();}
});
app.get('/api/site-settings',async(req,res)=>{
  try {res.set('Cache-Control','no-cache');res.json({parametres:await require('./services/siteSettings').lirePublic(require('./config/db').promise())});}
  catch(error){res.status(503).json({message:'Coordonnées du site indisponibles.'});}
});
// Déclencheur externe planifié pour le serverless. Sans CRON_SECRET, accès désactivé.
app.get('/api/internal/expire-sessions', async(req,res)=>{
 const crypto=require('node:crypto');
 const secret=process.env.CRON_SECRET;
 const autorisation=req.get('Authorization')||'';
 const fourni=/^Bearer ([^\s]+)$/i.exec(autorisation)?.[1];
 if(!secret||!fourni||Buffer.byteLength(secret)!==Buffer.byteLength(fourni)||
     !crypto.timingSafeEqual(Buffer.from(secret),Buffer.from(fourni)))return res.status(404).end();
 try { const resultat=await require('./services/sessionExpiryNotifier').traiterEcheances();res.json({notifications:resultat}); }
 catch(e){console.error('Cron session :',e.code||e.message);res.status(503).json({message:'Tâche indisponible.'});}
});
app.use('/api/internal', require('./routes/livekitMaintenanceRoutes').creerRouteMaintenanceLiveKit());
require('./routes/tasklyAdminPrivateMaintenanceV17')(app);
app.use('/api',verifierCsrf);
// L'API de connexion admin partage le meme chemin prive aleatoire.
app.use('/api' + adminEntryPath + '/auth', headersAdminPrive, adminAuthRoutes);
app.use('/api/artisan-verification',verificationRoutes);
app.use('/api/admin-verification',adminVerificationRoutes);
  app.use('/api/admin-settings', adminSettingsRoutes);

// routes
app.use('/api/account',require('./routes/accountRoutes'));
app.use('/api/artisan-support',require('./routes/artisanSupportRoutes'));
app.use("/api/auth", authRoutes); // routes liees a l'authentification
  if (process.env.PASSWORD_RESET_ENABLED === 'true') {
    app.use('/api/password-reset', require('./routes/passwordResetRoutes'));
}
app.use("/api/services", serviceRoutes); // routes liees aux services
app.use("/api/artisans", artisanRoutes); // routes liees aux artisans
app.use("/api/demandes", demandeRoutes); // routes liees aux demandes
app.use("/api/avis", avisRoutes); // routes liees aux avis
  // Assistant des clients et des artisans
app.use(
  '/api/taskly-assistant',
  require('./routes/tasklyAssistantRoutes')
);

// Assistant de l'administration
app.use(
  '/api/admin/taskly-assistant',
  require('./routes/tasklyAssistantRoutes')
);
if (process.env.TASKLY_MAIL_PILOT_ENABLED === 'true') {
  const mail = require('./routes/professionalMailRoutes');
  app.use('/api/taskly-mail',mail.artisan);
  app.use('/api/admin/taskly-mail',mail.admin);
}
// TASKLY_MAIL_SERVICE_V3_PHASE2B_START
// Feature disabled unless explicitly enabled after the isolated SQL migration.
if (process.env.TASKLY_MAIL_SERVICE_V3_ENABLED === 'true') {
  const serviceRouters=require('./routes/tasklyMailServiceV3Routes').createRouters({db:require('./config/db').promise()});
  app.use('/api/taskly-mail-service-v3',serviceRouters.user);
  app.use('/api/admin/taskly-mail-service-v3',serviceRouters.admin);
}
// TASKLY_MAIL_SERVICE_V3_PHASE2B_END
// TASKLY_ADMIN_MAIL_V10: separate, opt-in, verified administrative mailbox.
if (process.env.TASKLY_ADMIN_MAIL_V10_ENABLED === 'true') {
  app.use('/api/admin/taskly-mail-v10',require('./routes/tasklyAdminMailboxV10Routes'));
}
// ADMIN_PRIVATE_V17P2: independent, opt-in API. No legacy chat or Support routes changed.
if (process.env.TASKLY_ADMIN_PRIVATE_V17_ENABLED === 'true') {
  const prive = require('./routes/tasklyAdminPrivateV17Routes');
  app.use('/api/admin/taskly-private-v17', prive.admin);
  app.use('/api/taskly-private-v17', prive.user);
}
app.use("/api/admin", adminRoutes); // routes liees a l'administration
app.use("/api/signalements", signalementRoutes); // routes liees aux signalements
app.use("/api/contact", contactRoutes); // routes liÃƒÂ©es au contact/support

app.get("/", (req, res) => {    // on cree une route pour la page d'accueil
    res.sendFile(path.join(__dirname, "../client/public/index.html"), {dotfiles:"allow"}); // on affiche la page d'accueil du site
});

// Middleware pour gÃƒÂ©rer les routes inexistantes
app.use((req, res) => {
  res.status(404).json({ message: "Route introuvable." });
});

app.use((err,req,res,next)=>{
  console.error('Erreur requête :',err.code||err.name);
  if(res.headersSent)return next(err);
  if(req.path.startsWith('/api/') && !err.code?.startsWith('LIMIT_') && !err.status) return res.status(500).json({message:'Opération indisponible. Vérifiez les migrations de la base.'});
  res.status(err.code==='LIMIT_FILE_SIZE'?413:400).json({message:err.code==='LIMIT_FILE_SIZE'?'Fichier trop volumineux (3 Mo maximum).': 'Requete ou fichier invalide.'});
});
return app;
}
module.exports = preparerApp; // on exporte l'application vers un autre fichier

