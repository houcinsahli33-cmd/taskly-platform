const express=require('express'),path=require('path');
const db=require('../config/db').promise();
const {limiter}=require('../middleware/securityMiddleware');
const router=express.Router();
router.use(async(req,res,next)=>{
 const identity=req.session.supportIdentity;
 if(!identity || identity.expiresAt<=Date.now())return res.status(401).json({message:'Vérifiez vos identifiants et le code e-mail pour contacter le support lié à votre compte.'});
 try {
  const [rows]=await db.query("SELECT u.id,u.nom,u.prenom,u.email,u.statut_compte,a.id AS artisan_id,a.verification_statut,a.verification_commentaire FROM users u JOIN artisans a ON a.user_id=u.id WHERE u.id=? AND u.role='artisan'",[identity.userId]);
  if(!rows[0])return res.status(401).json({message:'Compte introuvable.'});
  req.supportAccount=rows[0];next();
 }catch(e){res.status(503).json({message:'Support de compte indisponible.'});}
});
router.get('/context',async(req,res)=>{
 const a=req.supportAccount;
 const [documents]=await db.query('SELECT id,type_document,original_name,created_at FROM artisan_documents WHERE artisan_id=? ORDER BY id DESC',[a.artisan_id]);
 const [messages]=await db.query("SELECT id,message,statut,created_at FROM contacts_support WHERE user_id=? AND contexte='artisan_activation' ORDER BY id DESC LIMIT 20",[a.id]);
 res.set('Cache-Control','no-store');res.json({compte:a,documents,messages,message:require('../services/accountAccess').messageDossier(a,a),active:a.statut_compte==='actif' && a.verification_statut==='approuve'});
});
router.post('/messages',limiter({max:8}),async(req,res)=>{
 const message=req.body.message;
 if(typeof message!=='string' || message.trim().length<10 || message.length>5000)return res.status(400).json({message:'Message de 10 à 5 000 caractères requis.'});
 const a=req.supportAccount;
 const [result]=await db.query("INSERT INTO contacts_support(nom,email,sujet,message,user_id,contexte,login_verified_at) VALUES (?,?,?,?,?,'artisan_activation',?)",[a.prenom+' '+a.nom,a.email,'Activation du compte artisan',message.trim(),a.id,new Date(req.session.supportIdentity.verifiedAt)]);
 res.status(201).json({message:'Demande liée à votre compte envoyée au support.',contactId:result.insertId});
});
router.post('/documents',limiter({max:8}),require('../middleware/documentUpload').upload.single('document'),async(req,res)=>{
 const a=req.supportAccount,type=req.body.type_document;
 if(a.verification_statut==='approuve')return res.status(403).json({message:'Dossier déjà approuvé.'});
 if(!req.file || !['diplome','certificat'].includes(type))return res.status(400).json({message:'Diplôme ou certificat requis.'});
 let conn;
 try {conn=await db.getConnection();await conn.beginTransaction();
  const [locked]=await conn.query('SELECT verification_statut FROM artisans WHERE id=? FOR UPDATE',[a.artisan_id]);
  if(locked[0]?.verification_statut==='approuve'){await conn.rollback();return res.status(409).json({message:'Votre dossier vient d’être approuvé.'});}
  const stored=await require('../services/fileStorage').enregistrer(req.file,true,conn);
  await conn.query('INSERT INTO artisan_documents(artisan_id,type_document,stored_name,original_name,media_type,taille) VALUES (?,?,?,?,?,?)',[a.artisan_id,type,stored,path.basename(req.file.originalname).slice(0,255),req.file.mimetype,req.file.size]);
  await conn.query("UPDATE artisans SET verification_statut='en_attente' WHERE id=?",[a.artisan_id]);
  await conn.commit();res.status(201).json({message:'Justificatif reçu. Un nouvel examen administratif est nécessaire.'});
 }catch(e){if(conn)await conn.rollback();res.status(e.status||500).json({message:e.status?e.message:'Dépôt indisponible.'});}finally{conn?.release();}
});
router.delete('/account',limiter({max:8}),async(req,res)=>{
 if(req.body.confirmation!=='SUPPRIMER')return res.status(400).json({message:'Écrivez SUPPRIMER pour confirmer.'});
 let conn;
 try{conn=await db.getConnection();await conn.beginTransaction();await require('../services/accountDeletion').supprimer(conn,req.supportAccount.id,req.body.motDePasse);await conn.commit();req.session.destroy(()=>{});res.clearCookie('artisans.sid');res.json({message:'Compte supprimé.'});}
 catch(e){if(conn)await conn.rollback();res.status(e.status||500).json({message:e.status?e.message:'Suppression indisponible.'});}finally{conn?.release();}
});
module.exports=router;

