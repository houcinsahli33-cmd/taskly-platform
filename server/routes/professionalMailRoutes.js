'use strict';
const express=require('express'),crypto=require('node:crypto');
const db=require('../config/db').promise();
const {verifierConnexion,verifierArtisan,verifierAdmin}=require('../middleware/authMiddleware');
const {limiter}=require('../middleware/securityMiddleware');
const {domaine,adresse,empreinte,codeValide,peutDemander}=require('../services/professionalMailPolicy');
const artisan=express.Router(),admin=express.Router();
const {createGateway}=require('../services/professionalMailGateway');
const internalMode=process.env.TASKLY_MAIL_INTERNAL_ENABLED==='true';
const autoInternal=internalMode&&process.env.TASKLY_MAIL_AUTO_ACTIVATION==='true';
const {createInternalGateway,internalAddress}=internalMode
 ? require('../services/professionalMailInternal')
 : {};
const colonnes='user_id,artisan_id,service_id,proposed_address,status,requested_at,confirmed_at,decided_at,refusal_reason';
function erreur(message,status=409){return Object.assign(new Error(message),{status});}
const actif=(req,res,next)=>process.env.TASKLY_MAIL_PILOT_ENABLED==='true'?next():res.status(404).json({message:'Taskly Mail n’est pas encore disponible.'});
const pilotIds=new Set(
 String(process.env.TASKLY_MAIL_PILOT_USER_IDS||'')
 .split(',')
 .map(id=>id.trim())
 .filter(id=>/^[1-9][0-9]*$/.test(id))
);

const {modeGeneral,modeClient}=require('../services/professionalMailAccess');

const piloteAutorise=id=>!internalMode
    || modeGeneral(process.env)
    || pilotIds.has(String(id));

function accesPilote(req,res,next){
 if(!piloteAutorise(req.session.utilisateur.id)){
  return res.status(403).json({message:'Taskly Mail est actuellement en test prive.'});
 }
 next();
}

function verifierProfilMail(req,res,next){
 if(req.session?.utilisateur?.role==='client'
    && modeClient(process.env))return next();
 return verifierArtisan(req,res,next);
}
artisan.use(actif,verifierConnexion,verifierProfilMail,accesPilote);
admin.use(actif,verifierConnexion,verifierAdmin);
const sensible=limiter({max:12});
async function transaction(fn){let conn;try{conn=await db.getConnection();await conn.beginTransaction();const value=await fn(conn);await conn.commit();return value;}catch(e){if(conn)await conn.rollback();throw e;}finally{conn?.release();}}
async function profil(conn,id){
 if(!piloteAutorise(id))throw erreur('Profil non autorise pour le pilote.',403);const [rows]=await conn.query(`SELECT u.id,u.nom,u.prenom,u.email,u.role,u.statut_compte,u.email_verified,a.id AS artisan_id,a.service_id,a.verification_statut,s.nom AS service_nom, (SELECT m.address FROM taskly_professional_mailboxes m WHERE m.user_id=u.id AND m.activated_at IS NOT NULL) AS active_mail_address FROM users u JOIN artisans a ON a.user_id=u.id JOIN services s ON s.id=a.service_id WHERE u.id=? FOR UPDATE`,[id]);const p=rows[0];
 if(!p&&modeClient(process.env)){
  const [clients]=await conn.query(
   `SELECT u.id,u.nom,u.prenom,u.email,u.role,
           u.statut_compte,u.email_verified,
           c.id AS client_id,
           (SELECT m.address FROM taskly_professional_mailboxes m WHERE m.user_id=u.id AND m.activated_at IS NOT NULL) AS active_mail_address
    FROM users u JOIN clients c ON c.user_id=u.id
    WHERE u.id=? AND u.role='client' FOR UPDATE`,[id]);
  const c=clients[0];
  if(c&&c.role==='client'&&c.statut_compte==='actif'
     &&Number(c.email_verified)===1
     &&Number(c.client_id)>0)return c;
 }
 if(!p||p.role!=='artisan'||p.statut_compte!=='actif'||!p.email_verified||p.verification_statut!=='approuve')throw erreur('Profil artisan non autorisé.',403);return p;}
// TASKLY_MAIL_CONTINUITY_START
// La demande historique garde son adresse personnelle d'origine.
// Seule une boite deja confirmee ET active peut survivre a son changement.
function activeContinuity(p,r){
 return p.id!=null && r.user_id!=null && String(p.id)===String(r.user_id)
  && p.statut_compte==='actif' && Number(p.email_verified)===1
  && (p.role==='client'||(p.role==='artisan'&&p.verification_statut==='approuve'))
  && r.status==='approved_pending_provider' && Boolean(r.confirmed_at)
  && typeof p.active_mail_address==='string' && p.active_mail_address.length>0
  && p.active_mail_address===r.proposed_address;
}
function correspondMail(p,r,clientEnabled){
 if(!p||!r)return false;
 const emailMatches=p.email===r.personal_email||activeContinuity(p,r);
 if(p.role==='client'){
  return clientEnabled && Number(p.client_id)>0
   && Number(p.client_id)===Number(r.client_id)
   && r.artisan_id===null && r.service_id===null && emailMatches;
 }
 return p.role==='artisan' && Number(p.artisan_id)>0 && Number(p.service_id)>0
  && Number(p.artisan_id)===Number(r.artisan_id)
  && Number(p.service_id)===Number(r.service_id)
  && r.client_id==null && emailMatches;
}
// TASKLY_MAIL_CONTINUITY_END
const correspond=(p,r)=>correspondMail(p,r,modeClient(process.env));
const gateway=internalMode
 ? createInternalGateway({transaction,profil,correspond,clientEnabled:modeClient(process.env),enableNotifications:process.env.TASKLY_MAIL_READ_LINK_ENABLED==='true'&&require('../services/professionalMailNotifications').configured(process.env)})
 : createGateway();

function wrap(fn){return async(req,res)=>{try{await fn(req,res);}catch(e){console.error('Taskly Mail pilote :',e.code||e.status||e.name);res.status(e.status||503).json({message:e.status?e.message:'Service temporairement indisponible.'});}};}
artisan.get('/',wrap(async(req,res)=>{if(req.session.utilisateur.role==='client')await transaction(conn=>profil(conn,req.session.utilisateur.id));const [rows]=await db.query(`SELECT ${colonnes} FROM taskly_professional_mail_requests WHERE user_id=?`,[req.session.utilisateur.id]);res.json({demande:rows[0]||null,pilote:true,gatewayConfigured:gateway.configured,internalMode,autoInternal,adminActionsV10:process.env.TASKLY_ADMIN_MAIL_V10_ENABLED==='true'});}));
artisan.post('/request',sensible,wrap(async(req,res)=>{
 if(internalMode&&!gateway.configured)throw erreur('Configuration interne invalide.',503);
 const domain=domaine(internalMode?'taskly.dz':process.env.TASKLY_MAIL_DOMAIN);if(!domain||!require('../services/emailService').estConfigure())throw erreur('Domaine ou service de confirmation non configuré.',503);
 const code=crypto.randomInt(0,1000000).toString().padStart(6,'0'),uid=req.session.utilisateur.id;
 const data=await transaction(async conn=>{
  const p=await profil(conn,uid);
  const [rows]=await conn.query('SELECT *, TIMESTAMPDIFF(SECOND,requested_at,NOW()) AS age FROM taskly_professional_mail_requests WHERE user_id=? FOR UPDATE',[uid]);const old=rows[0];
  let previous=old;
  if(autoInternal&&old&&['pending_admin','approved_pending_provider'].includes(old.status)){
   const [boxes]=await conn.query('SELECT user_id FROM taskly_professional_mailboxes WHERE user_id=? FOR UPDATE',[uid]);
   if(!boxes.length)previous={...old,status:'pending_confirmation'};
  }
  peutDemander(previous,!old||correspond(p,old));
  let candidate=old?.proposed_address||adresse(p,domain);
  if(!old){const [occupied]=await conn.query('SELECT user_id FROM taskly_professional_mail_requests WHERE proposed_address=?',[candidate]);if(occupied.length)candidate=adresse(p,domain,true);}
  if(internalMode&&!internalAddress(candidate))throw erreur('Adresse interne invalide.',409);
  const hash=empreinte(process.env.SESSION_SECRET,uid,candidate,code);
  if(old)await conn.query("UPDATE taskly_professional_mail_requests SET status='pending_confirmation',code_hash=?,attempts=0,expires_at=DATE_ADD(NOW(),INTERVAL 10 MINUTE),requested_at=NOW(),confirmed_at=NULL WHERE user_id=?",[hash,uid]);
  else if(p.role==='client'){
    await conn.query(
     `INSERT INTO taskly_professional_mail_requests
      (user_id,client_id,personal_email,proposed_address,code_hash,expires_at)
      VALUES (?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE))`,
      [uid,p.client_id,p.email,candidate,hash]);
   }
   else await conn.query(`INSERT INTO taskly_professional_mail_requests (user_id,artisan_id,service_id,personal_email,proposed_address,code_hash,expires_at) VALUES (?,?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE))`,[uid,p.artisan_id,p.service_id,p.email,candidate,hash]);
  return {email:p.email,candidate};
 });
 await require('../services/adminMailService').envoyerCourrielAdmin(data.email,'Taskly Mail — confirmer ou annuler votre demande',`Adresse proposée : ${data.candidate}. Code : ${code}. Valable 10 minutes, 3 tentatives. Retournez dans le même espace Taskly, rubrique Taskly Mail, puis saisissez le code pour confirmer ou annuler. Ne transmettez jamais ce code.`);
 res.status(201).json({message:'Code envoyé à votre adresse personnelle. Aucune boîte mail n’a été créée.'});
}));
artisan.post('/confirm',sensible,wrap(async(req,res)=>{
 const {code,decision}=req.body||{};if(!['confirm','cancel'].includes(decision)||typeof code!=='string'||!/^\d{6}$/.test(code))throw erreur('Code ou décision invalide.',400);
 const uid=req.session.utilisateur.id;
 const ok=await transaction(async conn=>{
  const p=await profil(conn,uid);const [rows]=await conn.query("SELECT * FROM taskly_professional_mail_requests WHERE user_id=? AND status='pending_confirmation' AND expires_at>NOW() FOR UPDATE",[uid]);const row=rows[0];
  if(!row||row.attempts>=3||!correspond(p,row))return false;
  if(!codeValide(process.env.SESSION_SECRET,row,code)){await conn.query('UPDATE taskly_professional_mail_requests SET attempts=attempts+1 WHERE user_id=?',[uid]);return false;}
  if(autoInternal&&decision==='confirm'){
   if(!gateway.configured||!internalAddress(row.proposed_address))throw erreur('Configuration interne invalide.',503);
   const [boxes]=await conn.query('SELECT user_id FROM taskly_professional_mailboxes WHERE user_id=? FOR UPDATE',[uid]);
   if(boxes.length)throw erreur('Une boîte existe déjà. Contactez le support.',409);
   const key=require('./professionalMailboxRoutes').provisionKey(uid,row.proposed_address);
   const providerId=await gateway.provision(row.proposed_address,key);
   await conn.query("UPDATE taskly_professional_mail_requests SET status='approved_pending_provider',code_hash=NULL,expires_at=NULL,confirmed_at=NOW(),decided_at=NOW(),decided_by=NULL,refusal_reason=NULL WHERE user_id=?",[uid]);
   await conn.query('INSERT INTO taskly_professional_mailboxes (user_id,address,provider_id,activated_at) VALUES (?,?,?,NOW())',[uid,row.proposed_address,providerId]);
   return true;
  }
  await conn.query('UPDATE taskly_professional_mail_requests SET status=?,code_hash=NULL,expires_at=NULL,confirmed_at=NOW() WHERE user_id=?',[decision==='confirm'?'pending_admin':'cancelled',uid]);return true;
 });
 if(!ok)throw erreur('Code incorrect, expiré ou tentatives épuisées.',400);
 res.json({message:decision==='confirm'?(autoInternal?'Votre boîte interne est créée et activée.':'Demande transmise à l’administration.'):'Demande annulée.',activated:autoInternal&&decision==='confirm'});
}));
// Read admin requests and mailbox states independently. This keeps the listing
// available even when a complex JOIN/CASE query is rejected by the SQL provider.
// It never changes mailbox access or writes to the database.
admin.get('/',wrap(async(req,res)=>{
 const after=Number(req.query.after||0);
 if(!Number.isSafeInteger(after)||after<0)throw erreur('Pagination invalide.',400);
 const joined=Boolean(gateway.configured);
 const v10=process.env.TASKLY_ADMIN_MAIL_V10_ENABLED==='true';
 const [rows]=await db.query(
  `SELECT ${colonnes} FROM taskly_professional_mail_requests WHERE user_id>? AND status IN ('pending_admin','approved_pending_provider','rejected') ORDER BY user_id LIMIT 50`,
  [after]
 );
 let mailboxStateUnavailable=false;
 if(joined&&rows.length){
  const ids=rows.map(row=>row.user_id);
  const placeholders=ids.map(()=>'?').join(',');
  try{
   const [boxes]=await db.query(
    `SELECT user_id,address,activated_at${v10?',suspended_at':''} FROM taskly_professional_mailboxes WHERE user_id IN (${placeholders})`,
    ids
   );
   const byAccount=new Map(boxes.map(box=>[String(box.user_id)+'|'+box.address,box]));
   for(const row of rows){
    const box=byAccount.get(String(row.user_id)+'|'+row.proposed_address);
    row.mailbox_state=box
     ? v10&&box.suspended_at!=null?'suspended':box.activated_at!=null?'active':'activation_required'
     : 'waiting_provider';
   }
  }catch(e){
   // Never show an unverified mailbox as active or allow access changes.
   // Display the requests while reporting mailbox status as unavailable.
   mailboxStateUnavailable=true;
   for(const row of rows)row.mailbox_state=null;
   console.error('Taskly Mail mailbox-state lookup:',e.code||e.name);
  }
 }
 res.json({demandes:rows,next:rows.length===50?rows.at(-1).user_id:null,
  gatewayConfigured:gateway.configured,internalMode,autoInternal,
  adminActionsV10:v10&&!mailboxStateUnavailable,
  mailboxStateUnavailable,manualMailEnabled:process.env.TASKLY_ADMIN_MANUAL_MAIL_ENABLED!=='false'&&internalMode&&joined&&!mailboxStateUnavailable});
}));
// Explicit admin-only manual provisioning of already approved/confirmed requests.
// The automatic enrollment flow, OTP verification and all user routes remain unchanged.
admin.post('/:id/manual-provision',sensible,wrap(async(req,res)=>{
  if(process.env.TASKLY_ADMIN_MANUAL_MAIL_ENABLED==='false')throw erreur('Option désactivée.',404);
  if(req.session?.adminVerified!==true||req.tasklyAdminContext!==true)throw erreur('Vérification administrateur requise.',403);
  if(!internalMode||!gateway.configured)throw erreur('Création interne indisponible.',503);
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<1)throw erreur('Compte invalide.',400);
  // Single transaction: no creation for unconfirmed requests, changed profiles, or duplicate boxes.
  const result=await transaction(async conn=>{
    const p=await profil(conn,id);
    const [rows]=await conn.query('SELECT * FROM taskly_professional_mail_requests WHERE user_id=? FOR UPDATE',[id]);
    const r=rows[0];
    if(!r||r.status!=='approved_pending_provider'||!r.confirmed_at||!correspond(p,r))
      throw erreur('Demande approuvée et confirmée requise.',409);
    if(!internalAddress(r.proposed_address))throw erreur('Adresse interne invalide.',409);
    const [existing]=await conn.query('SELECT user_id FROM taskly_professional_mailboxes WHERE user_id=? OR address=? FOR UPDATE',[id,r.proposed_address]);
    if(existing.length)throw erreur('Une boîte existe déjà.',409);
    const key=require('./professionalMailboxRoutes').provisionKey(id,r.proposed_address);
    const providerId=await gateway.provision(r.proposed_address,key);
    await conn.query('INSERT INTO taskly_professional_mailboxes (user_id,address,provider_id) VALUES (?,?,?)',[id,r.proposed_address,providerId]);
    return {address:r.proposed_address};
  });
  res.status(201).json({message:'Boîte créée. Activation personnelle requise.',address:result.address});
}));
// Reversible change of mailbox access; no messages or user records are deleted.
admin.post('/:id/access',sensible,wrap(async(req,res)=>{
 if(process.env.TASKLY_ADMIN_MAIL_V10_ENABLED!=='true')throw erreur('Fonction indisponible.',404);
 if(req.session?.adminVerified!==true||req.tasklyAdminContext!==true)throw erreur('Vérification administrateur requise.',403);
 const id=Number(req.params.id),action=req.body?.action;
 if(!Number.isSafeInteger(id)||id<1||!['suspend','restore'].includes(action))throw erreur('Opération invalide.',400);
 await transaction(async conn=>{
  const [rows]=await conn.query(`SELECT m.user_id,m.activated_at,m.suspended_at,u.statut_compte,u.email_verified,r.status FROM taskly_professional_mailboxes m JOIN users u ON u.id=m.user_id JOIN taskly_professional_mail_requests r ON r.user_id=m.user_id AND r.proposed_address=m.address WHERE m.user_id=? FOR UPDATE`,[id]);
  const m=rows[0];if(!m||!m.activated_at||m.status!=='approved_pending_provider')throw erreur('Boîte non autorisée.',409);
  if(action==='restore'&&(m.statut_compte!=='actif'||Number(m.email_verified)!==1))throw erreur('Le compte doit être actif et vérifié.',409);
  await conn.query(`UPDATE taskly_professional_mailboxes SET suspended_at=${action==='suspend'?'NOW()':'NULL'} WHERE user_id=?`,[id]);
 });res.json({message:action==='suspend'?'Boîte désactivée sans suppression des messages.':'Boîte réactivée.'});
}));
admin.post('/:id/decision',sensible,wrap(async(req,res)=>{
 if(autoInternal)throw erreur('Activation automatique : aucune décision manuelle.',409);
 const id=Number(req.params.id),{decision,motif}=req.body||{};
 if(!Number.isSafeInteger(id)||id<1||!['approve','reject'].includes(decision)||decision==='reject'&&(typeof motif!=='string'||motif.trim().length<3||motif.length>500))throw erreur('Décision invalide. Motif exigé en cas de refus.',400);
 await transaction(async conn=>{const p=await profil(conn,id);const [rows]=await conn.query("SELECT * FROM taskly_professional_mail_requests WHERE user_id=? AND status='pending_admin' FOR UPDATE",[id]);const row=rows[0];if(!row||!correspond(p,row))throw erreur('Demande non confirmée, déjà traitée ou profil modifié.');await conn.query('UPDATE taskly_professional_mail_requests SET status=?,decided_by=?,decided_at=NOW(),refusal_reason=? WHERE user_id=?',[decision==='approve'?'approved_pending_provider':'rejected',req.session.utilisateur.id,decision==='reject'?motif.trim():null,id]);});
 res.json({message:decision==='approve'?'Demande approuvée. Création de la boîte en attente du fournisseur.':'Demande refusée.'});
}));
require('./professionalMailboxRoutes').mount({artisan,admin,db,transaction,profil,correspond,wrap,erreur,limiter,gateway,sendConfirmation:(...args)=>require('../services/adminMailService').envoyerCourrielAdmin(...args)});
module.exports={artisan,admin,redeemNotification:gateway.redeemNotification,retryNotifications:gateway.retryNotifications};
