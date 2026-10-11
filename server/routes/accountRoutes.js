const express=require('express'),bcrypt=require('bcrypt'),crypto=require('crypto');
const pool=require('../config/db'),db=pool.promise();
const {verifierConnexion}=require('../middleware/authMiddleware');
const {limiter}=require('../middleware/securityMiddleware');
const router=express.Router();
router.use(verifierConnexion,(req,res,next)=>['client','artisan'].includes(req.session.utilisateur.role)?next():res.status(403).json({message:'Profil client ou artisan requis.'}));
const sensible=limiter({max:8});
const validText=(s,min,max)=>typeof s==='string' && s.trim().length>=min && s.length<=max;
const validPassword=s=>typeof s==='string' && s.length>=8 && Buffer.byteLength(s,'utf8')<=72 && /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s) && /[^A-Za-z0-9]/.test(s);
const emailHash=(id,email,code)=>crypto.createHmac('sha256',process.env.SESSION_SECRET).update(`profile-email:${id}:${email}:${code}`).digest('hex');
function fail(res,e){console.error('Compte :',e.code||'erreur');return res.status(e.code==='ER_DUP_ENTRY'?409:e.status||500).json({message:e.code==='ER_DUP_ENTRY'?'Cette adresse e-mail est déjà utilisée.':e.status?e.message:'Opération indisponible. Vérifiez la migration de la base.'});}
async function password(req,conn=db){
 const [rows]=await conn.query('SELECT id,role,mot_de_passe,email,photo_profil FROM users WHERE id=?',[req.session.utilisateur.id]);
 if(!rows[0] || typeof req.body.motDePasse!=='string' || !(await bcrypt.compare(req.body.motDePasse,rows[0].mot_de_passe))){const e=Error('Mot de passe actuel incorrect.');e.status=403;throw e;}return rows[0];
}
router.get('/',async(req,res)=>{
 try {
  const id=req.session.utilisateur.id,role=req.session.utilisateur.role;
  const [users]=await db.query('SELECT id,nom,prenom,email,role,photo_profil FROM users WHERE id=?',[id]);
  const [profiles]=await db.query(role==='client'?'SELECT telephone,ville,adresse FROM clients WHERE user_id=?':'SELECT a.id AS artisan_id,a.telephone,a.ville,a.service_id,a.description,a.experience,a.verification_statut,s.nom AS service_nom FROM artisans a JOIN services s ON s.id=a.service_id WHERE a.user_id=?',[id]);
  res.set('Cache-Control','no-store');res.json({compte:{...users[0],...profiles[0]}});
 }catch(e){fail(res,e);}
});
router.put('/',limiter({max:20}),async(req,res)=>{
 const b=req.body,role=req.session.utilisateur.role;
 if(!validText(b.nom,2,100)||!validText(b.prenom,2,100)||!/^0[567]\d{8}$/.test(String(b.telephone||''))||!validText(b.ville,2,255)||
   (role==='client' && !validText(b.adresse,3,255)) || (role==='artisan' && (!Number.isSafeInteger(Number(b.serviceId))||Number(b.serviceId)<=0 || !Number.isInteger(Number(b.experience)) || Number(b.experience)<0 || Number(b.experience)>80 || !validText(b.description,3,500))))return res.status(400).json({message:'Vérifiez les informations : nom, prénom, téléphone, commune et profil.'});
 let conn,reexamen=false;
 try {
  conn=await db.getConnection();await conn.beginTransaction();
  const id=req.session.utilisateur.id;
  await conn.query('SELECT id FROM users WHERE id=? FOR UPDATE',[id]);
  if(role==='client')await conn.query('UPDATE clients SET telephone=?,ville=?,adresse=? WHERE user_id=?',[b.telephone,b.ville.trim(),b.adresse.trim(),id]);
  else {
   const [service]=await conn.query('SELECT id FROM services WHERE id=?',[Number(b.serviceId)]);if(!service[0]){const e=Error('Service inconnu.');e.status=400;throw e;}
   await conn.query('SELECT id FROM users WHERE email=(SELECT email FROM (SELECT email FROM users WHERE id=?) AS compte) ORDER BY id FOR UPDATE',[id]);
   const [doublon]=await conn.query('SELECT a.id FROM artisans a JOIN users u ON u.id=a.user_id WHERE u.email=(SELECT email FROM users WHERE id=?) AND u.id<>? AND a.service_id=?',[id,id,Number(b.serviceId)]);
   if(doublon.length){const e=Error('Un autre espace artisan de cette adresse utilise déjà ce métier.');e.status=409;throw e;}
   const [artisans]=await conn.query('SELECT service_id FROM artisans WHERE user_id=? FOR UPDATE',[id]);
   reexamen=Number(artisans[0].service_id)!==Number(b.serviceId);
   await conn.query('UPDATE artisans SET telephone=?,ville=?,description=?,experience=?,service_id=? WHERE user_id=?',[b.telephone,b.ville.trim(),b.description.trim(),Number(b.experience),Number(b.serviceId),id]);
   if(reexamen){await conn.query("UPDATE artisans SET verification_statut='en_attente',verification_commentaire='Changement de métier : nouvel examen requis.' WHERE user_id=?",[id]);await conn.query('UPDATE users SET admin_session_version=admin_session_version+1 WHERE id=?',[id]);}
  }
  await conn.query('UPDATE users SET nom=?,prenom=? WHERE id=?',[b.nom.trim(),b.prenom.trim(),id]);
  await conn.commit();
  if(reexamen){req.session.destroy(()=>{});return res.json({message:'Informations enregistrées. Le changement de métier nécessite une nouvelle validation. Reconnectez-vous pour le suivi et le support.',deconnexion:true});}
  req.session.utilisateur.nom=b.nom.trim();req.session.utilisateur.prenom=b.prenom.trim();
  req.session.save(err=>err?fail(res,err):res.json({message:'Profil enregistré.'}));
 }catch(e){if(conn)await conn.rollback();fail(res,e);}finally{conn?.release();}
});
router.put('/password',sensible,async(req,res)=>{
 try {
  if(!validPassword(req.body.nouveauMotDePasse))return res.status(400).json({message:'8 caractères minimum, majuscule, minuscule, chiffre et symbole ; 72 octets maximum.'});
  const user=await password(req),hash=await bcrypt.hash(req.body.nouveauMotDePasse,12);
  const [result]=await db.query("UPDATE users SET mot_de_passe=?,admin_session_version=admin_session_version+1 WHERE email=? AND role IN ('client','artisan') AND mot_de_passe=?",[hash,user.email,user.mot_de_passe]);
  if(!result.affectedRows)return res.status(409).json({message:'Le compte a changé. Reconnectez-vous.'});
  req.session.destroy(()=>{});res.clearCookie('artisans.sid');res.json({message:'Mot de passe commun modifié pour tous vos espaces. Reconnectez-vous.',deconnexion:true});
 }catch(e){fail(res,e);}
});
router.post('/email/request',sensible,async(req,res)=>{
 try {
  const email=String(req.body.email||'').trim().toLowerCase();
  if(!/^[A-Za-z0-9._%+-]+@gmail\.com$/.test(email)||email.length>255)return res.status(400).json({message:'Adresse Gmail valide requise.'});
  const user=await password(req);if(email===user.email)return res.status(400).json({message:'Cette adresse est déjà la vôtre.'});
  const [exists]=await db.query('SELECT id FROM users WHERE email=?',[email]);if(exists.length)return res.status(409).json({message:'Cette adresse est déjà utilisée.'});
  const [recent]=await db.query('SELECT user_id FROM account_email_changes WHERE user_id=? AND created_at>DATE_SUB(NOW(),INTERVAL 1 MINUTE)',[user.id]);if(recent.length)return res.status(429).json({message:'Attendez une minute avant de demander un nouveau code.'});
  const code=crypto.randomInt(0,1000000).toString().padStart(6,'0');
  await db.query('INSERT INTO account_email_changes(user_id,nouveau_email,code_hash,expires_at) VALUES (?,?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE)) ON DUPLICATE KEY UPDATE nouveau_email=VALUES(nouveau_email),code_hash=VALUES(code_hash),expires_at=VALUES(expires_at),attempts=0,created_at=NOW()',[user.id,email,emailHash(user.id,email,code)]);
  await require('../services/adminMailService').envoyerCourrielAdmin(email,'Taskly — confirmation de votre nouvelle adresse',`Votre code : ${code}. Valable 10 minutes, 3 tentatives maximum.`);
  res.json({message:'Code envoyé à la nouvelle adresse. L’adresse actuelle reste inchangée jusqu’à confirmation.'});
 }catch(e){fail(res,e);}
});
router.post('/email/verify',sensible,async(req,res)=>{
 let conn;
 try {
  const code=String(req.body.code||'');if(!/^\d{6}$/.test(code))return res.status(400).json({message:'Code à six chiffres requis.'});
  conn=await db.getConnection();await conn.beginTransaction();
  const [rows]=await conn.query('SELECT * FROM account_email_changes WHERE user_id=? AND expires_at>NOW() FOR UPDATE',[req.session.utilisateur.id]);
  const row=rows[0];if(!row||row.attempts>=3){await conn.rollback();return res.status(400).json({message:'Code expiré ou tentatives épuisées.'});}
  if(!crypto.timingSafeEqual(Buffer.from(row.code_hash,'hex'),Buffer.from(emailHash(row.user_id,row.nouveau_email,code),'hex'))){await conn.query('UPDATE account_email_changes SET attempts=attempts+1 WHERE user_id=?',[row.user_id]);await conn.commit();return res.status(400).json({message:'Code incorrect.'});}
  const [origine]=await conn.query('SELECT email FROM users WHERE id=? FOR UPDATE',[row.user_id]);
  if(!origine[0]){const e=Error('Compte introuvable.');e.status=409;throw e;}
  await conn.query('SELECT id FROM users WHERE email=? ORDER BY id FOR UPDATE',[origine[0].email]);
  const [destination]=await conn.query('SELECT id FROM users WHERE email=? FOR UPDATE',[row.nouveau_email]);
  if(destination.length){const e=Error('Cette adresse est déjà utilisée. Les espaces ne peuvent pas être fusionnés.');e.status=409;throw e;}
  await conn.query("UPDATE users SET email=?,email_verified=1,admin_session_version=admin_session_version+1 WHERE email=? AND role IN ('client','artisan')",[row.nouveau_email,origine[0].email]);
  await conn.query('DELETE FROM account_email_changes WHERE user_id=?',[row.user_id]);await conn.commit();
  req.session.destroy(()=>{});res.clearCookie('artisans.sid');res.json({message:'Adresse commune modifiée et confirmée pour tous vos espaces. Reconnectez-vous.',deconnexion:true});
 }catch(e){if(conn)await conn.rollback();fail(res,e);}finally{conn?.release();}
});
router.delete('/',sensible,async(req,res)=>{
 if(req.body.confirmation!=='SUPPRIMER')return res.status(400).json({message:'Écrivez SUPPRIMER pour confirmer la suppression définitive.'});
 let conn;
 try {
  conn=await db.getConnection();await conn.beginTransaction();
  await require('../services/accountDeletion').supprimer(conn,req.session.utilisateur.id,req.body.motDePasse);
  await conn.commit();req.session.destroy(()=>{});res.clearCookie('artisans.sid');res.json({message:'Compte et données liées supprimés.'});
 }catch(e){if(conn)await conn.rollback();fail(res,e);}finally{conn?.release();}
});
module.exports=router;
