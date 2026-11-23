'use strict';
const crypto=require('node:crypto');
const {createGateway,validateDraft}=require('../services/professionalMailGateway');
const mailPrefs=require('../services/professionalMailPreferences');
function activationHash(secret,uid,address,code){
 if(typeof secret!=='string'||Buffer.byteLength(secret)<32)throw Object.assign(new Error('Activation indisponible.'),{status:503});
 return crypto.createHmac('sha256',secret).update(JSON.stringify(['taskly-mail-activation-v4',String(uid),address,code])).digest('hex');
}
function activationMatches(secret,uid,row,code){return typeof code==='string'&&/^\d{6}$/.test(code)&&/^[a-f0-9]{64}$/.test(row.activation_hash||'')&&crypto.timingSafeEqual(Buffer.from(row.activation_hash,'hex'),Buffer.from(activationHash(secret,uid,row.address,code),'hex'));}
function provisionKey(uid,address){return crypto.createHash('sha256').update(JSON.stringify(['taskly-mail-provision-v4',String(uid),address])).digest('hex');}
// Les mêmes contrôles de rôle, de session, de CSRF et de profil que le pilote.
function mount({artisan,admin,db,transaction,profil,correspond,wrap,erreur,limiter,gateway=createGateway(),env=process.env,sendConfirmation}){
 const uid=req=>req.session.utilisateur.id;
 const enabled=(req,res,next)=>gateway.configured?next():res.status(503).json({message:'Connexion au fournisseur non configurée.'});
 const sensitive=limiter({max:8}),reads=limiter({max:120}),writes=limiter({max:40});
 async function checked(conn,id){const p=await profil(conn,id);const [rows]=await conn.query("SELECT * FROM taskly_professional_mail_requests WHERE user_id=? AND status='approved_pending_provider' FOR UPDATE",[id]);const r=rows[0];if(!r||!correspond(p,r))throw erreur('Demande non approuvée ou profil modifié.',403);return {p,r};}
 async function state(conn,id,active=false){const {p,r}=await checked(conn,id);const [rows]=await conn.query('SELECT *, (activation_expires_at>NOW()) AS activation_valid, TIMESTAMPDIFF(SECOND,activation_requested_at,NOW()) AS activation_age FROM taskly_professional_mailboxes WHERE user_id=? FOR UPDATE',[id]);const m=rows[0];if(m&&m.address!==r.proposed_address)throw erreur('Incohérence de la boîte. Contactez le support.',403);if(!m){if(active)throw erreur('Boîte non créée.',403);return {p,r,m:null};}if(active&&!m.activated_at)throw erreur('Activation requise.',403);if(env.TASKLY_ADMIN_MAIL_V10_ENABLED==='true'&&active&&m.suspended_at)throw erreur('Boîte désactivée.',403);return {p,r,m};}
 const own=async req=>(await transaction(conn=>state(conn,uid(req),true))).m;
 admin.post('/:id/provision',enabled,sensitive,wrap(async(req,res)=>{
  if(env.TASKLY_MAIL_INTERNAL_ENABLED==='true'&&env.TASKLY_MAIL_AUTO_ACTIVATION==='true')throw erreur('Activation automatique : provisionnement manuel désactivé.',409);
  const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)throw erreur('Identifiant invalide.',400);
  const first=await transaction(conn=>state(conn,id));if(first.m)return res.json({message:'Boîte déjà provisionnée.'});
  const address=first.r.proposed_address,providerId=await gateway.provision(address,provisionKey(id,address));
  await transaction(async conn=>{const {r,m}=await state(conn,id);if(r.proposed_address!==address)throw erreur('Demande modifiée. Intervention du support nécessaire.');if(m){if(m.provider_id!==providerId)throw erreur('Incohérence du fournisseur. Intervention nécessaire.');return;}await conn.query('INSERT INTO taskly_professional_mailboxes (user_id,address,provider_id) VALUES (?,?,?)',[id,address,providerId]);});
  res.json({message:'Boîte confirmée par le fournisseur. L’artisan doit encore activer son accès.'});
 }));
 artisan.get('/mailbox',enabled,reads,wrap(async(req,res)=>{const {m}=await transaction(conn=>state(conn,uid(req)));res.json({state:!m?'waiting_provider':m.activated_at?'active':'activation_required',address:m?.address||null,foldersEnabled:Boolean(gateway.foldersEnabled),attachmentsEnabled:Boolean(gateway.attachmentsEnabled),internal:env.TASKLY_MAIL_INTERNAL_ENABLED==='true'});}));
 artisan.post('/mailbox/activation/request',enabled,sensitive,wrap(async(req,res)=>{
  const id=uid(req),code=crypto.randomInt(0,1000000).toString().padStart(6,'0');
  const target=await transaction(async conn=>{const {p,m}=await state(conn,id);if(!m||m.activated_at)throw erreur('Activation non disponible.');if(m.activation_age!==null&&Number(m.activation_age)<60)throw erreur('Veuillez attendre une minute.',429);const hash=activationHash(env.SESSION_SECRET,id,m.address,code);await conn.query('UPDATE taskly_professional_mailboxes SET activation_hash=?,activation_expires_at=DATE_ADD(NOW(),INTERVAL 10 MINUTE),activation_requested_at=NOW(),activation_attempts=0 WHERE user_id=?',[hash,id]);return {email:p.email,address:m.address};});
  await sendConfirmation(target.email,'Taskly Mail — activation de votre accès',`Votre adresse professionnelle : ${target.address}. Code d’activation : ${code}. Valable 10 minutes, 3 tentatives. Saisissez-le dans le même espace Artisan. Ne partagez jamais ce code.`);
  res.json({message:'Code envoyé sur votre adresse personnelle.'});
 }));
 artisan.post('/mailbox/activation/confirm',enabled,sensitive,wrap(async(req,res)=>{
  const code=req.body?.code,id=uid(req);if(typeof code!=='string'||!/^\d{6}$/.test(code))throw erreur('Code invalide.',400);
  const ok=await transaction(async conn=>{const {m}=await state(conn,id);if(!m||m.activated_at||Number(m.activation_valid)!==1||Number(m.activation_attempts)>=3)return false;if(!activationMatches(env.SESSION_SECRET,id,m,code)){await conn.query('UPDATE taskly_professional_mailboxes SET activation_attempts=activation_attempts+1 WHERE user_id=?',[id]);return false;}await conn.query('UPDATE taskly_professional_mailboxes SET activated_at=NOW(),activation_hash=NULL,activation_expires_at=NULL WHERE user_id=?',[id]);return true;});
  if(!ok)throw erreur('Code incorrect, expiré ou tentatives épuisées.',400);res.json({message:'Accès Taskly Mail activé.'});
 }));
 if(gateway.foldersEnabled){
  artisan.get('/mailbox/copies',enabled,reads,wrap(async(req,res)=>res.json(await gateway.listCopies(await own(req),req.query.folder,req.query.cursor,req.query.q??''))));
  // Lecture modifie le statut : POST protégé par CSRF global, pas de GET mutateur nouveau.
  artisan.post('/mailbox/copies/:id/read',enabled,writes,wrap(async(req,res)=>res.json({message:await gateway.readCopy(await own(req),req.params.id)})));
  artisan.post('/mailbox/copies/:id/action',enabled,writes,wrap(async(req,res)=>res.json(await gateway.changeCopy(await own(req),req.params.id,req.body?.action))));
  artisan.get('/mailbox/counts',enabled,reads,wrap(async(req,res)=>res.json(await gateway.counts(await own(req)))));
 }
 if(gateway.attachmentsEnabled){
  const multer=require('multer');
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:3*1024*1024,files:1,fields:4,fieldSize:32000,parts:6}}).single('attachment');
  const uploadLimit=limiter({max:8,parCompte:true});
  const downloadLimit=limiter({max:60,parCompte:true});
  artisan.post('/mailbox/send-file',enabled,uploadLimit,(req,res,next)=>upload(req,res,e=>e?res.status(e.code==='LIMIT_FILE_SIZE'?413:400).json({message:'Fichier ou formulaire invalide (3 Mo maximum).'}):next()),wrap(async(req,res)=>{
   if(!req.file)throw erreur('Fichier requis.',400);
   const result=await gateway.send(await own(req),req.body,req.file);
   res.status(202).json({message:'Message et fichier enregistrés.',id:result.id});
  }));
  artisan.get('/mailbox/copies/:id/attachment',enabled,downloadLimit,wrap(async(req,res)=>{
   const f=await gateway.downloadAttachment(await own(req),req.params.id);
   res.set('Cache-Control','private, no-store');res.set('X-Content-Type-Options','nosniff');
   res.set('Content-Security-Policy',"default-src 'none'; sandbox");
   res.attachment(f.name);res.type(f.mime);res.send(f.content);
  }));
 }
 artisan.get('/mailbox/messages',enabled,reads,wrap(async(req,res)=>res.json(await gateway.list(await own(req),req.query.folder,req.query.cursor))));
 artisan.get('/mailbox/messages/:id',enabled,reads,wrap(async(req,res)=>res.json({message:await gateway.read(await own(req),req.params.id)})));
 artisan.post('/mailbox/send',enabled,sensitive,wrap(async(req,res)=>{const result=await gateway.send(await own(req),req.body);res.status(202).json({message:'Message accepté par le service de messagerie. La livraison finale n’est pas garantie.',id:result.id});}));
    // Paramètres persistants, limités au profil authentifié et à sa boîte.
    artisan.get('/mailbox/preferences',enabled,reads,wrap(async(req,res)=>{
      const preferences=await transaction(async conn=>{await state(conn,uid(req),true);return mailPrefs.load(conn,uid(req));});
      res.json({preferences});
    }));
    artisan.put('/mailbox/preferences',enabled,writes,wrap(async(req,res)=>{
      const parsed=mailPrefs.validate(req.body);
      const preferences=await transaction(async conn=>{await state(conn,uid(req),true);return mailPrefs.save(conn,uid(req),parsed);});
      res.json({preferences,message:'Paramètres enregistrés.'});
    }));
 artisan.get('/mailbox/draft',enabled,reads,wrap(async(req,res)=>{const draft=await transaction(async conn=>{await state(conn,uid(req),true);const [rows]=await conn.query('SELECT recipient AS `to`,subject,body FROM taskly_professional_mail_drafts WHERE user_id=?',[uid(req)]);return rows[0]||{to:'',subject:'',body:''};});res.json({draft});}));
 artisan.put('/mailbox/draft',enabled,writes,wrap(async(req,res)=>{const d=validateDraft(req.body);await transaction(async conn=>{await state(conn,uid(req),true);await conn.query('INSERT INTO taskly_professional_mail_drafts (user_id,recipient,subject,body) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE recipient=VALUES(recipient),subject=VALUES(subject),body=VALUES(body)',[uid(req),d.to,d.subject,d.body]);});res.json({message:'Brouillon enregistré.'});}));
 artisan.delete('/mailbox/draft',enabled,writes,wrap(async(req,res)=>{await transaction(async conn=>{await state(conn,uid(req),true);await conn.query('DELETE FROM taskly_professional_mail_drafts WHERE user_id=?',[uid(req)]);});res.json({message:'Brouillon supprimé.'});}));
 return {configured:gateway.configured};
}
module.exports={mount,activationHash,activationMatches,provisionKey};
