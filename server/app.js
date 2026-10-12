// Ce fichier prÃƒÂ©pare l'application Express. Il contient la configuration principale du serveur : routes, middlewares, fichiers statiques, sessions et gestion des erreurs.
// Le serveur est lancÃƒÂ© sÃƒÂ©parÃƒÂ©ment dans server.js.

// imports
const express = require("express");

const configurerSession = require('./config/sessionConfig');
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

// Middleware. La session est montee AVANT les pages privees.
function preparerApp(store) {
app.use(express.json({limit:'100kb'}));
app.use(express.urlencoded({extended:false,limit:'100kb'}));
app.use(configurerSession(store));
app.use(require('./services/sessionActivity').verifierInactivite);
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Cache-Control',req.path === adminEntryPath || req.path.startsWith(adminEntryPath + '/') ? 'no-store, private' : 'no-cache');
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
    if(!file)return res.status(404).end();
    res.set('Content-Type',file.media_type);res.set('Cache-Control','public,max-age=86400');res.send(file.contenu);
  } catch(e) {res.status(503).end();}
});
app.get('/api/site-settings',async(req,res)=>{
  try {res.set('Cache-Control','no-cache');res.json({parametres:await require('./services/siteSettings').lire(require('./config/db').promise())});}
  catch(error){res.status(503).json({message:'Coordonnées du site indisponibles.'});}
});
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
app.use("/api/services", serviceRoutes); // routes liees aux services
app.use("/api/artisans", artisanRoutes); // routes liees aux artisans
app.use("/api/demandes", demandeRoutes); // routes liees aux demandes
app.use("/api/avis", avisRoutes); // routes liees aux avis
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
  if(req.path.startsWith('/api/') && !err.code?.startsWith('LIMIT_') && !err.status) return res.status(500).json({message:'Opération indisponible. Vérifiez les migrations de la base.'});
  res.status(err.code==='LIMIT_FILE_SIZE'?413:400).json({message:err.code==='LIMIT_FILE_SIZE'?'Fichier trop volumineux (3 Mo maximum).': 'Requete ou fichier invalide.'});
});
return app;
}
module.exports = preparerApp; // on exporte l'application vers un autre fichier

