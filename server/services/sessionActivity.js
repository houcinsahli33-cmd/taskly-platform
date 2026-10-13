'use strict';
// L'inactivite expire sur le serveur, meme si un onglet effectue des requetes passives.
const INACTIVITE_MS = 4 * 60 * 60 * 1000;
function verifierInactivite(req, res, next) {
  if (!req.session?.utilisateur) return next();
  const maintenant = Date.now();
  const derniere = Number(req.session.lastUserActivityAt);
  if (Number.isFinite(derniere) && derniere > 0 && maintenant - derniere >= INACTIVITE_MS) {
    const identifiant = req.sessionID, utilisateur = req.session.utilisateur, admin = req.tasklyAdminContext;
    return req.session.destroy(() => {
      res.clearCookie(admin?'taskly.admin.sid':'artisans.sid', {path:'/'});
      if(identifiant && utilisateur?.email)require('./sessionExpiryNotifier').notifierFin(identifiant,utilisateur,admin).catch(()=>{});
      if (!String(req.originalUrl||req.path||'').startsWith('/api/') && typeof req.accepts==='function' && req.accepts('html'))
        return res.redirect(302,req.tasklyAdminContext?process.env.ADMIN_ENTRY_PATH+'?session=expiree':'/login.html?session=expiree');
      res.status(401).json({code:'SESSION_EXPIREE',message:'Session expirée après 4 heures sans activité. Reconnectez-vous.'});
    });
  }
  // Compatibilite avec les sessions existantes lors du deploiement.
  if (!Number.isFinite(derniere) || derniere <= 0) req.session.lastUserActivityAt = maintenant;
  if (req.session?.utilisateur?.id && req.sessionID) {
    require('./sessionExpiryNotifier').enregistrerActivite(req.sessionID,req.session.utilisateur,
      req.session.lastUserActivityAt,req.tasklyAdminContext).catch(()=>{});
  }
  next();
}
function confirmerActivite(req, res) {
  if (!req.session?.utilisateur) return res.status(401).json({message:'Connexion requise.'});
  req.session.lastUserActivityAt = Date.now();
  req.session.save(err => {
    if (err) return res.status(503).json({message:'Session indisponible.'});
    require('./sessionExpiryNotifier').enregistrerActivite(req.sessionID,req.session.utilisateur,
      req.session.lastUserActivityAt,req.tasklyAdminContext,true).catch(()=>{});
    return res.status(204).end();
  });
}
module.exports = { INACTIVITE_MS, verifierInactivite, confirmerActivite };
