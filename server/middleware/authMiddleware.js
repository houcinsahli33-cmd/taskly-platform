function pagePriveeHTML(req) {
  // Express peut considérer Accept: */* comme HTML ; ce n'est pas une navigation.
  if (req.method !== 'GET') return false;
  const accept = String((typeof req.get === 'function' ? req.get('Accept') : req.headers?.accept) || '');
  if (!/\btext\/html\b/i.test(accept)) return false;
  const chemin = String(req.originalUrl || req.path || '').split('?')[0];
  const portail = process.env.ADMIN_ENTRY_PATH;
  if (req.tasklyAdminContext)
    return !!portail && (chemin === portail + '/dashboard' || chemin.startsWith(portail + '/dashboard/'));
  return /^\/(?:client|artisan)-dashboard\.html$/.test(chemin) ||
    /^\/espace\/(?:client|artisan)\/(?:accueil|demandes|avis|profil|support)$/.test(chemin);
}

// Ce fichier contient les middlewares d'authentification.
// Un middleware est une fonction exécutée entre la route et le controller. Il permet de vérifier si l'utilisateur est connecté et s'il possède le bon rôle.

// Verifier si l'utilisateur est connecte
async function verifierConnexion(req,res,next) {
  if (!req.session?.utilisateur) {
    if (pagePriveeHTML(req))
      return res.redirect(302, req.tasklyAdminContext ? process.env.ADMIN_ENTRY_PATH + '?session=expiree' : '/login.html?session=expiree');
    return res.status(401).json({code:'SESSION_EXPIREE',message:'Vous devez être connecté.'});
  }
  try {
    const user=await require('../models/userModel').trouverUtilisateurParId(req.session.utilisateur.id);
    if (!user || user.statut_compte !== 'actif' || !user.email_verified || user.role!==req.session.utilisateur?.role ||
        (user.role==='admin' && user.admin_session_version!==req.session.adminSessionVersion)) {
      req.session.destroy(()=>{});
      return res.status(403).json({message:'Votre compte est bloqué ou votre session a expiré. Contactez le support.'});
    }
    if(user.role!=='admin' && Number(user.admin_session_version||0)!==Number(req.session.accountSessionVersion||0)) {
      req.session.destroy(()=>{});return res.status(401).json({message:'Session expirée. Reconnectez-vous.'});
    }
    if(user.role==='artisan') {
      const artisan=await require('../models/artisanModel').trouverArtisanParUserId(user.id);
      if(!require('../services/accountAccess').autoriserEspace(user,artisan)) {
        req.session.destroy(()=>{});return res.status(403).json({message:'Votre compte artisan doit être activé. Reconnectez-vous pour contacter le support.'});
      }
    }
    next();
  } catch(e) {res.status(503).json({message:'Vérification de session indisponible.'});}
}
async function verifierArtisanActif(req,res,next) {
  try {
    const artisan=await require('../models/artisanModel').trouverArtisanParUserId(req.session.utilisateur.id);
    if (!artisan || artisan.verification_statut!=='approuve') return res.status(403).json({message:'Votre dossier doit être approuvé par un administrateur.'});
    next();
  } catch(e) {res.status(503).json({message:'Vérification du dossier indisponible.'});}
}

// Verifier si l'utilisateur connecte est un client
function verifierClient(req, res, next) {
    if (req.session.utilisateur?.role !== "client") {
        return res.status(403).json({
            message: "Accès refusé. Rôle client requis."
        });
    }

    next();
}

// Verifier si l'utilisateur connecte est un artisan
function verifierArtisan(req, res, next) {
    if (req.session.utilisateur?.role !== "artisan") {
        return res.status(403).json({
            message: "Accès refusé. Rôle artisan requis."
        });
    }

    next();
}

// Verifier si l'utilisateur connecte est un administrateur
async function verifierAdmin(req, res, next) {
    if (req.session.utilisateur?.role !== "admin" || req.session.adminVerified !== true) {
        return res.status(403).json({
            message: "Accès refusé. Rôle administrateur requis."
        });
    }

    try {
      const user = await require('../models/userModel').trouverUtilisateurParId(req.session.utilisateur.id);
      if (!user || user.role !== 'admin' || user.statut_compte === 'bloque') {
        return res.status(403).json({message:'Session admin non autorisee.'});
      }
      next();
    } catch(e) { console.error('Controle admin :',e.message);res.status(500).json({message:'Erreur de securite.'}); }
}

module.exports = {  // on exporte les fonctions pour pouvoir les utiliser dans d'autres fichiers
    verifierConnexion,
    verifierArtisanActif,
    verifierClient,
    verifierArtisan,
    verifierAdmin
};