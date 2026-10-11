'use strict';
const express = require('express');
const path = require('path');
const db = require('../config/db').promise();
const {verifierConnexion, verifierAdmin} = require('../middleware/authMiddleware');
const {dossier} = require('../middleware/documentUpload');
const router = express.Router();
router.use(verifierConnexion, verifierAdmin);

// Toutes les réponses contenant des données privées restent hors cache.
function sansCache(res) {
  res.set('Cache-Control', 'no-store');
  return res;
}
function idPositif(valeur) {
  const texte = String(valeur || '');
  return /^[1-9]\d{0,14}$/.test(texte) && Number.isSafeInteger(Number(texte)) ? Number(texte) : null;
}
function borne(valeur, defaut, maximum) {
  const nombre = Number(valeur);
  return Number.isInteger(nombre) && nombre > 0 ? Math.min(nombre, maximum) : defaut;
}
function erreur(res, error, action) {
  console.error('Vérification artisans :', action, error.code || error.message);
  return sansCache(res).status(500).json({message:'Dossier momentanément indisponible. Vérifiez la connexion MySQL et les migrations nécessaires.'});
}

router.get('/artisans', async (req, res) => {
  try {
    const page = borne(req.query?.page, 1, 100000);
    const limite = borne(req.query?.limite ?? req.query?.limit, 20, 50);
    const statut = String(req.query?.statut || 'tous');
    const recherche = String(req.query?.recherche || '').trim().slice(0,100);
    const tri = String(req.query?.tri || 'recent');
    if (!['recent','ancien'].includes(tri)) return sansCache(res).status(400).json({message:'Tri invalide.'});
    if (!['tous','en_attente','a_completer','approuve','refuse','bloque','examines'].includes(statut))
      return sansCache(res).status(400).json({message:'Filtre de statut invalide.'});
    const conditions = [];
    const parametres = [];
    if (statut === 'bloque') conditions.push("u.statut_compte = 'bloque'");
    else if (statut === 'examines') conditions.push("a.verification_statut IN ('approuve','refuse')");
    else if (statut !== 'tous') {conditions.push('a.verification_statut = ?'); parametres.push(statut);}
    if (recherche) {
      conditions.push('(u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ? OR s.nom LIKE ? OR a.ville LIKE ?)');
      parametres.push(...Array(5).fill('%'+recherche+'%'));
    }
    const filtre = conditions.length ? ' WHERE '+conditions.join(' AND ') : '';
    const jointures = ' FROM artisans a JOIN users u ON u.id=a.user_id JOIN services s ON s.id=a.service_id';
    const [comptages] = await db.query('SELECT COUNT(*) AS total'+jointures+filtre, parametres);
    const total = Number(comptages[0]?.total || 0);
    // Compteurs globaux, indépendants des filtres courants.
    const [statistiques] = await db.query(`SELECT COUNT(*) AS total,
       COALESCE(SUM(a.verification_statut='en_attente'),0) AS en_attente,
       COALESCE(SUM(a.verification_statut='a_completer'),0) AS a_completer,
       COALESCE(SUM(a.verification_statut='approuve'),0) AS approuve,
       COALESCE(SUM(a.verification_statut='refuse'),0) AS refuse,
       COALESCE(SUM(u.statut_compte='bloque'),0) AS bloque
       FROM artisans a JOIN users u ON u.id=a.user_id`);
    const pages = Math.max(1, Math.ceil(total/limite));
    const pageEffective = Math.min(page, pages);
    const [artisans] = await db.query(`SELECT a.id,a.verification_statut,a.verification_commentaire,a.ville,
      a.telephone,a.experience,a.description,a.user_id,u.nom,u.prenom,u.email,u.statut_compte,u.created_at AS date_inscription,
      s.nom AS service_nom,
      (SELECT COUNT(*) FROM artisan_documents d WHERE d.artisan_id=a.id) AS documents_count
      ${jointures}${filtre} ORDER BY a.created_at ${tri === 'ancien' ? 'ASC,a.id ASC' : 'DESC,a.id DESC'} LIMIT ? OFFSET ?`,
      [...parametres,limite,(pageEffective-1)*limite]);
    sansCache(res).json({artisans,total,page:pageEffective,limite,pages,comptes:statistiques[0] || {total:0}});
  } catch(e) {erreur(res,e,'liste');}
});

// Ouvrir un dossier depuis la liste des utilisateurs (user.id != artisans.id).
router.get('/artisans/by-user/:userId', async (req,res) => {
  const userId=idPositif(req.params.userId);
  if (!userId) return sansCache(res).status(400).json({message:'Identifiant invalide.'});
  try {
    const [rows] = await db.query(`SELECT a.id,a.user_id,a.verification_statut,a.verification_commentaire,
      a.ville,a.telephone,a.experience,a.description,u.nom,u.prenom,u.email,u.statut_compte,u.created_at AS date_inscription,
      s.nom AS service_nom FROM artisans a JOIN users u ON u.id=a.user_id
      JOIN services s ON s.id=a.service_id WHERE a.user_id=? LIMIT 1`,[userId]);
    if (!rows.length) return sansCache(res).status(404).json({message:'Dossier artisan introuvable.'});
    sansCache(res).json({artisanId:rows[0].id,artisan:rows[0]});
  } catch(e) {erreur(res,e,'recherche par utilisateur');}
});

router.get('/artisans/:id/documents', async (req,res) => {
  const id=idPositif(req.params.id);
  if (!id) return sansCache(res).status(400).json({message:'Identifiant invalide.'});
  try {
    const [exists] = await db.query('SELECT id FROM artisans WHERE id=?',[id]);
    if (!exists.length) return sansCache(res).status(404).json({message:'Dossier introuvable.'});
    const [documents] = await db.query('SELECT id,type_document,original_name,media_type,created_at FROM artisan_documents WHERE artisan_id=? ORDER BY id DESC',[id]);
    const [support] = await db.query(`SELECT id,message,statut,created_at FROM contacts_support
      WHERE user_id=(SELECT user_id FROM artisans WHERE id=?) AND contexte='artisan_activation'
      ORDER BY id DESC LIMIT 30`,[id]);
    const [notifications] = await db.query(`SELECT id,statut,created_at,sent_at FROM account_notifications
      WHERE user_id=(SELECT user_id FROM artisans WHERE id=?) ORDER BY id DESC LIMIT 20`,[id]);
    const [historique] = await db.query(`SELECT va.id,va.ancien_statut,va.nouveau_statut,va.commentaire,
      va.created_at,au.nom AS admin_nom,au.prenom AS admin_prenom
      FROM verification_audit va LEFT JOIN users au ON au.id=va.admin_user_id
      WHERE va.artisan_id=? ORDER BY va.id DESC LIMIT 100`,[id]);
    sansCache(res).json({documents,support,notifications,historique});
  } catch(e) {erreur(res,e,'dossier');}
});

router.get('/documents/:id',async(req,res)=>{
  const id=idPositif(req.params.id);
  if (!id) return sansCache(res).status(400).end();
  try {
    const [rows]=await db.query('SELECT stored_name,original_name,media_type FROM artisan_documents WHERE id=?',[id]);
    const doc=rows[0];if(!doc)return sansCache(res).status(404).end();
    if(!/^[a-f0-9]{64}$/.test(doc.stored_name))return sansCache(res).status(400).end();
    const stored=await require('../services/fileStorage').lire(doc.stored_name,true);
    sansCache(res).set('Content-Type',doc.media_type);
    res.set('X-Content-Type-Options','nosniff');
    // Seuls les PDF et images sûres sont présentés dans le navigateur. Jamais de SVG/HTML.
    const visualisable=['application/pdf','image/png','image/jpeg'].includes(doc.media_type);
    const afficher=req.query?.afficher==='1' && visualisable;
    if(afficher)res.set('Content-Security-Policy',"sandbox; default-src 'none'; style-src 'unsafe-inline'");
    res.set('Content-Disposition',`${afficher?'inline':'attachment'}; filename="justificatif-${id}"`);
    if(stored) return res.send(stored.contenu);
    // Support des documents historiques restés dans le stockage disque privé.
    res.sendFile(path.join(dossier,doc.stored_name));
  }catch(e){erreur(res,e,'document');}
});

router.put('/artisans/:id/decision',async(req,res)=>{
  const id=idPositif(req.params.id);
  if (!id) return sansCache(res).status(400).json({message:'Identifiant invalide.'});
  const statut=String(req.body?.statut||'');
  const motif=req.body?.commentaire;
  const commentaire=typeof motif==='string'?motif.trim():'';
  // Les anciennes interfaces continuent de notifier par défaut.
  const notifier=req.body?.notifier!==false;
  if(!['approuve','refuse','a_completer'].includes(statut))return sansCache(res).status(400).json({message:'Statut invalide.'});
  if(commentaire.length>500 || (statut!=='approuve' && commentaire.length<5))
    return sansCache(res).status(400).json({message:'Motif de 5 à 500 caractères requis pour un refus ou complément.'});
  let conn;
  try {
    conn=await db.getConnection();
    await conn.beginTransaction();
    const [rows]=await conn.query('SELECT a.id,a.user_id,a.verification_statut,u.email,u.prenom FROM artisans a JOIN users u ON u.id=a.user_id WHERE a.id=? FOR UPDATE',[id]);
    if(!rows[0]){await conn.rollback();return sansCache(res).status(404).json({message:'Artisan introuvable.'});}
    if(statut==='approuve'){
      const [types]=await conn.query('SELECT DISTINCT type_document FROM artisan_documents WHERE artisan_id=?',[id]);
      const connus=new Set(types.map(x=>x.type_document));
      if(!['diplome','certificat'].some(t=>connus.has(t))){await conn.rollback();return sansCache(res).status(400).json({message:'Diplôme ou certificat requis.'});}
    }
    await conn.query('UPDATE artisans SET verification_statut=?,verification_commentaire=? WHERE id=?',[statut,commentaire||null,id]);
    await conn.query('INSERT INTO verification_audit (artisan_id,admin_user_id,ancien_statut,nouveau_statut,commentaire) VALUES (?,?,?,?,?)',
      [id,req.session.utilisateur.id,rows[0].verification_statut,statut,commentaire||null]);
    const compte=rows[0];
    await conn.query("UPDATE users SET statut_compte=?,motif_blocage=?,date_blocage=?,admin_session_version=admin_session_version+1 WHERE id=? AND role='artisan'",
      [statut==='refuse'?'bloque':'actif',statut==='refuse'?commentaire:null,statut==='refuse'?new Date():null,compte.user_id]);
    const sujet=statut==='approuve'?'Taskly — compte artisan activé':statut==='refuse'?'Taskly — compte artisan bloqué':'Taskly — complément demandé';
    const corps=statut==='approuve'?`Bonjour ${compte.prenom}, votre compte artisan est activé. Connectez-vous avec votre e-mail, votre mot de passe et le code de confirmation.`:
      `Bonjour ${compte.prenom}, ${statut==='refuse'?'votre compte artisan est bloqué':'votre dossier nécessite un complément'}. Motif : ${commentaire}. Depuis la connexion, vérifiez vos identifiants et votre code e-mail pour contacter le support.`;
    let notificationId=null;
    if(notifier){
      const [notification]=await conn.query('INSERT INTO account_notifications(user_id,destinataire,sujet,corps) VALUES (?,?,?,?)',[compte.user_id,compte.email,sujet,corps]);
      notificationId=notification.insertId;
    }
    await conn.commit();
    const emailEnvoye=notificationId?await require('../services/accountNotifications').envoyer(notificationId).catch(()=>false):false;
    const message=!notifier?'Décision enregistrée sans notification e-mail.':emailEnvoye?'Décision enregistrée et e-mail envoyé.':'Décision enregistrée. E-mail en attente : utilisez Réessayer dans le dossier.';
    return sansCache(res).json({message,emailEnvoye});
  }catch(e){if(conn) await conn.rollback().catch(()=>{});return erreur(res,e,'décision');}
  finally{if(conn)conn.release();}
});

router.post('/notifications/:id/retry',require('../middleware/securityMiddleware').limiter({max:8}),async(req,res)=>{
 const id=idPositif(req.params.id);
 if(!id)return sansCache(res).status(400).json({message:'Identifiant invalide.'});
 try{
   // Ne pas permettre de renvoyer des notifications sans vérifier le contexte artisan.
   const [items]=await db.query(`SELECT n.id FROM account_notifications n
     JOIN users u ON u.id=n.user_id JOIN artisans a ON a.user_id=u.id WHERE n.id=?`,[id]);
   if(!items.length)return sansCache(res).status(404).json({message:'Notification introuvable.'});
   const sent=await require('../services/accountNotifications').envoyer(id);
   return sansCache(res).json({message:sent?'E-mail envoyé.':'E-mail déjà envoyé, en cours ou indisponible. Consultez son état dans le dossier.'});
 }catch(e){return erreur(res,e,'notification');}
});
module.exports=router;
