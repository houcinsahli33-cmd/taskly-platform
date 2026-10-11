'use strict';
// L'inactivite expire sur le serveur, meme si un onglet effectue des requetes passives.
const INACTIVITE_MS = 4 * 60 * 60 * 1000;
function verifierInactivite(req, res, next) {
  if (!req.session?.utilisateur) return next();
  const maintenant = Date.now();
  const derniere = Number(req.session.lastUserActivityAt);
  if (Number.isFinite(derniere) && derniere > 0 && maintenant - derniere >= INACTIVITE_MS) {
    return req.session.destroy(() => {
      res.clearCookie('artisans.sid', {path:'/'});
      res.status(401).json({message:'Session expirée après 4 heures sans activité. Reconnectez-vous.'});
    });
  }
  // Compatibilite avec les sessions existantes lors du deploiement.
  if (!Number.isFinite(derniere) || derniere <= 0) req.session.lastUserActivityAt = maintenant;
  next();
}
function confirmerActivite(req, res) {
  if (!req.session?.utilisateur) return res.status(401).json({message:'Connexion requise.'});
  req.session.lastUserActivityAt = Date.now();
  req.session.save(err => err ? res.status(503).json({message:'Session indisponible.'}) : res.status(204).end());
}
module.exports = { INACTIVITE_MS, verifierInactivite, confirmerActivite };
