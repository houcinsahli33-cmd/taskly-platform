const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../config/db').promise();
const { verifierConnexion, verifierAdmin } = require('../middleware/authMiddleware');
const { dossier } = require('../middleware/documentUpload');
const router = express.Router();
router.use(verifierConnexion, verifierAdmin);

const entierPositif = (valeur, defaut, maximum) => {
  const nombre = Number(valeur);
  return Number.isSafeInteger(nombre) && nombre > 0 ? Math.min(nombre, maximum) : defaut;
};
const idValide = valeur => /^[1-9]\d*$/.test(String(valeur)) && Number.isSafeInteger(Number(valeur));

// Les artisans restent TOUS consultables par l'admin ; seul l'annuaire public filtre les comptes.
router.get('/artisans', async (req, res) => {
  try {
    const page = entierPositif(req.query?.page, 1, 10000);
    const limite = entierPositif(req.query?.limite, 20, 50);
    const statut = String(req.query?.statut || 'tous');
    const recherche = String(req.query?.recherche || '').trim().slice(0, 100);
    if (!['tous', 'en_attente', 'a_completer', 'approuve', 'refuse', 'bloque'].includes(statut)) {
      return res.status(400).json({ message: 'Filtre de statut invalide.' });
    }
    const conditions = [];
    const params = [];
    if (statut === 'bloque') {
      conditions.push("u.statut_compte = 'bloque'");
    } else if (statut !== 'tous') {
      conditions.push('a.verification_statut = ?');
      params.push(statut);
    }
    if (recherche) {
      conditions.push('(u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ? OR s.nom LIKE ? OR a.ville LIKE ?)');
      params.push(...Array(5).fill(`%${recherche}%`));
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const from = 'FROM artisans a JOIN users u ON u.id=a.user_id JOIN services s ON s.id=a.service_id';
    const [comptage] = await db.query(`SELECT COUNT(*) AS total ${from} ${where}`, params);
    const total = Number(comptage[0]?.total || 0);
    const pages = Math.max(1, Math.ceil(total / limite));
    const [comptes] = await db.query(`SELECT COUNT(*) AS total,
      COALESCE(SUM(a.verification_statut='en_attente'),0) AS en_attente,
      COALESCE(SUM(a.verification_statut='a_completer'),0) AS a_completer,
      COALESCE(SUM(a.verification_statut='approuve'),0) AS approuve,
      COALESCE(SUM(a.verification_statut='refuse'),0) AS refuse,
      COALESCE(SUM(u.statut_compte='bloque'),0) AS bloque
      FROM artisans a JOIN users u ON u.id=a.user_id`);
    const [artisans] = await db.query(`SELECT a.id,a.verification_statut,a.verification_commentaire,a.ville,a.telephone,a.experience,a.description,a.user_id,
      u.nom,u.prenom,u.email,u.statut_compte,s.nom AS service_nom,
      (SELECT COUNT(*) FROM artisan_documents d WHERE d.artisan_id=a.id) AS documents_count
      ${from} ${where} ORDER BY a.created_at DESC,a.id DESC LIMIT ? OFFSET ?`,
      [...params, limite, (page - 1) * limite]);
    res.set('Cache-Control', 'no-store');
    return res.json({artisans, total, pages, page, limite, comptes: comptes[0] || {}});
  } catch (erreur) {
    console.error('Liste artisans admin :', erreur.code || erreur.message);
    return res.status(500).json({message:'Liste des artisans indisponible. Vérifiez la connexion et les migrations MySQL.'});
  }
});

// Les justificatifs, messages support et décisions ne sortent jamais de l'administration.
router.get('/artisans/:id/documents', async (req, res) => {
  if (!idValide(req.params.id)) return res.status(400).json({message:'Identifiant invalide.'});
  const id = Number(req.params.id);
  res.set('Cache-Control', 'no-store');
  try {
    const [existant] = await db.query('SELECT id FROM artisans WHERE id=?', [id]);
    if (!existant.length) return res.status(404).json({message:'Dossier artisan introuvable.'});
    const [documents] = await db.query('SELECT id,type_document,original_name,created_at FROM artisan_documents WHERE artisan_id=?', [id]);
    const [support] = await db.query("SELECT id,message,statut,created_at FROM contacts_support WHERE user_id=(SELECT user_id FROM artisans WHERE id=?) AND contexte='artisan_activation' ORDER BY id DESC LIMIT 30", [id]);
    const [notifications] = await db.query('SELECT id,statut,created_at,sent_at FROM account_notifications WHERE user_id=(SELECT user_id FROM artisans WHERE id=?) ORDER BY id DESC LIMIT 5', [id]);
    const [historique] = await db.query(`SELECT va.id,va.ancien_statut,va.nouveau_statut,va.commentaire,va.created_at,
      u.nom AS admin_nom,u.prenom AS admin_prenom FROM verification_audit va
      LEFT JOIN users u ON u.id=va.admin_user_id WHERE va.artisan_id=? ORDER BY va.created_at DESC,va.id DESC LIMIT 50`, [id]);
    return res.json({documents,support,notifications,historique});
  } catch (erreur) {
    console.error('Dossier artisan admin :', erreur.code || erreur.message);
    return res.status(500).json({message:'Dossier indisponible. Vérifiez les migrations MySQL.'});
  }
});

router.get('/documents/:id',async(req,res)=>{
  try{
    if (!idValide(req.params.id)) return res.status(400).end();
    const [rows]=await db.query('SELECT stored_name,original_name,media_type FROM artisan_documents WHERE id=?',[req.params.id]);
    const doc=rows[0];if(!doc)return res.status(404).end();
    if(!/^[a-f0-9]{64}$/.test(doc.stored_name))return res.status(400).end();
    const stored=await require('../services/fileStorage').lire(doc.stored_name,true);
    res.set('Cache-Control','no-store');res.set('Content-Type',doc.media_type);
    res.set('Content-Disposition',`attachment; filename="justificatif-${Number(req.params.id)}"`);
    if(stored) return res.send(stored.contenu);
    res.sendFile(path.join(dossier,doc.stored_name)); // Compatibilité avec les anciens dépôts locaux.
  }catch(e){console.error(e.message);res.status(500).json({message:'Erreur serveur.'});}
});
router.put('/artisans/:id/decision',async(req,res)=>{
  const statut=String(req.body.statut||'');const commentaire=String(req.body.commentaire||'').trim().slice(0,500);
  if(!['approuve','refuse','a_completer'].includes(statut))return res.status(400).json({message:'Statut invalide.'});
  if(statut!=='approuve' && commentaire.length<5)return res.status(400).json({message:'Motif de cinq caracteres minimum.'});
  const conn=await db.getConnection();
  try{await conn.beginTransaction();
    const [rows]=await conn.query('SELECT a.id,a.user_id,a.verification_statut,u.email,u.prenom FROM artisans a JOIN users u ON u.id=a.user_id WHERE a.id=? FOR UPDATE',[req.params.id]);
    if(!rows[0]){await conn.rollback();return res.status(404).json({message:'Artisan introuvable.'});}
    if(statut==='approuve'){
      const [types]=await conn.query('SELECT DISTINCT type_document FROM artisan_documents WHERE artisan_id=?',[req.params.id]);
      const connus=new Set(types.map(x=>x.type_document));
      if(!['diplome','certificat'].some(t=>connus.has(t))){await conn.rollback();return res.status(400).json({message:'Diplôme ou certificat requis.'});}
    }
    await conn.query('UPDATE artisans SET verification_statut=?,verification_commentaire=? WHERE id=?',[statut,commentaire||null,req.params.id]);
    await conn.query('INSERT INTO verification_audit (artisan_id,admin_user_id,ancien_statut,nouveau_statut,commentaire) VALUES (?,?,?,?,?)',
      [req.params.id,req.session.utilisateur.id,rows[0].verification_statut,statut,commentaire||null]);
    const compte=rows[0];
    await conn.query("UPDATE users SET statut_compte=?,motif_blocage=?,date_blocage=?,admin_session_version=admin_session_version+1 WHERE id=? AND role='artisan'",[statut==='refuse'?'bloque':'actif',statut==='refuse'?commentaire:null,statut==='refuse'?new Date():null,compte.user_id]);
    const sujet=statut==='approuve'?'Taskly — compte artisan activé':statut==='refuse'?'Taskly — compte artisan bloqué':'Taskly — complément demandé';
    const corps=statut==='approuve'?`Bonjour ${compte.prenom}, votre compte artisan est activé. Connectez-vous avec votre e-mail, votre mot de passe et le code de confirmation.`:
      `Bonjour ${compte.prenom}, ${statut==='refuse'?'votre compte artisan est bloqué':'votre dossier nécessite un complément'}. Motif : ${commentaire}. Depuis la connexion, vérifiez vos identifiants et votre code e-mail pour contacter le support.`;
    const [notification]=await conn.query('INSERT INTO account_notifications(user_id,destinataire,sujet,corps) VALUES (?,?,?,?)',[compte.user_id,compte.email,sujet,corps]);
    await conn.commit();
    const emailEnvoye=await require('../services/accountNotifications').envoyer(notification.insertId).catch(()=>false);
    res.json({message:emailEnvoye?'Décision enregistrée et e-mail envoyé.':'Décision enregistrée. E-mail en attente : utilisez Réessayer dans le dossier.',emailEnvoye});
  }catch(e){await conn.rollback();console.error(e.message);res.status(500).json({message:'Erreur serveur.'});}
  finally{conn.release();}
});
router.post('/notifications/:id/retry',require('../middleware/securityMiddleware').limiter({max:8}),async(req,res)=>{
 const sent=await require('../services/accountNotifications').envoyer(req.params.id);
 res.json({message:sent?'E-mail envoyé.':'E-mail déjà envoyé, en cours ou indisponible. Consultez son état dans le dossier.'});
});
module.exports=router;
