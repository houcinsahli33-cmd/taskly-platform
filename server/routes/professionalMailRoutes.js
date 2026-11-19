'use strict';
const express=require('express'),crypto=require('node:crypto');
const db=require('../config/db').promise();
const {verifierConnexion,verifierArtisan,verifierAdmin}=require('../middleware/authMiddleware');
const {limiter}=require('../middleware/securityMiddleware');
const {domaine,adresse,empreinte,codeValide,peutDemander}=require('../services/professionalMailPolicy');
const artisan=express.Router(),admin=express.Router();
const {createGateway}=require('../services/professionalMailGateway');
const internalMode=process.env.TASKLY_MAIL_INTERNAL_ENABLED==='true';
const {createInternalGateway,internalAddress}=internalMode
 ? require('../services/professionalMailInternal')
 : {};
const colonnes='user_id,artisan_id,service_id,proposed_address,status,requested_at,confirmed_at,decided_at,refusal_reason';
function erreur(message,status=409){return Object.assign(new Error(message),{status});}
const actif=(req,res,next)=>process.env.TASKLY_MAIL_PILOT_ENABLED==='true'?next():res.status(404).json({message:'Taskly Mail n’est pas encore disponible.'});
artisan.use(actif,verifierConnexion,verifierArtisan);admin.use(actif,verifierConnexion,verifierAdmin);
const sensible=limiter({max:12});
async function transaction(fn){let conn;try{conn=await db.getConnection();await conn.beginTransaction();const value=await fn(conn);await conn.commit();return value;}catch(e){if(conn)await conn.rollback();throw e;}finally{conn?.release();}}
async function profil(conn,id){const [rows]=await conn.query(`SELECT u.id,u.nom,u.prenom,u.email,u.role,u.statut_compte,u.email_verified,a.id AS artisan_id,a.service_id,a.verification_statut,s.nom AS service_nom FROM users u JOIN artisans a ON a.user_id=u.id JOIN services s ON s.id=a.service_id WHERE u.id=? FOR UPDATE`,[id]);const p=rows[0];if(!p||p.role!=='artisan'||p.statut_compte!=='actif'||!p.email_verified||p.verification_statut!=='approuve')throw erreur('Profil artisan non autorisé.',403);return p;}
const correspond=(p,r)=>Number(p.artisan_id)===Number(r.artisan_id)&&Number(p.service_id)===Number(r.service_id)&&p.email===r.personal_email;
const gateway=internalMode
 ? createInternalGateway({transaction,profil,correspond})
 : createGateway();

function wrap(fn){return async(req,res)=>{try{await fn(req,res);}catch(e){console.error('Taskly Mail pilote :',e.code||e.status||e.name);res.status(e.status||503).json({message:e.status?e.message:'Service temporairement indisponible.'});}};}
artisan.get('/',wrap(async(req,res)=>{const [rows]=await db.query(`SELECT ${colonnes} FROM taskly_professional_mail_requests WHERE user_id=?`,[req.session.utilisateur.id]);res.json({demande:rows[0]||null,pilote:true,gatewayConfigured:gateway.configured});}));
artisan.post('/request',sensible,wrap(async(req,res)=>{
 if(internalMode&&!gateway.configured)throw erreur('Configuration interne invalide.',503);
 const domain=domaine(internalMode?'taskly.test':process.env.TASKLY_MAIL_DOMAIN);if(!domain||!require('../services/emailService').estConfigure())throw erreur('Domaine ou service de confirmation non configuré.',503);
 const code=crypto.randomInt(0,1000000).toString().padStart(6,'0'),uid=req.session.utilisateur.id;
 const data=await transaction(async conn=>{
  const p=await profil(conn,uid);
  const [rows]=await conn.query('SELECT *, TIMESTAMPDIFF(SECOND,requested_at,NOW()) AS age FROM taskly_professional_mail_requests WHERE user_id=? FOR UPDATE',[uid]);const old=rows[0];
  peutDemander(old,!old||correspond(p,old));
  let candidate=old?.proposed_address||adresse(p,domain);
  if(!old){const [occupied]=await conn.query('SELECT user_id FROM taskly_professional_mail_requests WHERE proposed_address=?',[candidate]);if(occupied.length)candidate=adresse(p,domain,true);}
  if(internalMode&&!internalAddress(candidate))throw erreur('Adresse interne invalide.',409);
  const hash=empreinte(process.env.SESSION_SECRET,uid,candidate,code);
  if(old)await conn.query("UPDATE taskly_professional_mail_requests SET status='pending_confirmation',code_hash=?,attempts=0,expires_at=DATE_ADD(NOW(),INTERVAL 10 MINUTE),requested_at=NOW(),confirmed_at=NULL WHERE user_id=?",[hash,uid]);
  else await conn.query(`INSERT INTO taskly_professional_mail_requests (user_id,artisan_id,service_id,personal_email,proposed_address,code_hash,expires_at) VALUES (?,?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE))`,[uid,p.artisan_id,p.service_id,p.email,candidate,hash]);
  return {email:p.email,candidate};
 });
 await require('../services/adminMailService').envoyerCourrielAdmin(data.email,'Taskly Mail — confirmer ou annuler votre demande',`Adresse proposée : ${data.candidate}. Code : ${code}. Valable 10 minutes, 3 tentatives. Retournez dans le même espace Artisan, rubrique Taskly Mail, puis saisissez le code pour confirmer ou annuler. Ne transmettez jamais ce code.`);
 res.status(201).json({message:'Code envoyé à votre adresse personnelle. Aucune boîte mail n’a été créée.'});
}));
artisan.post('/confirm',sensible,wrap(async(req,res)=>{
 const {code,decision}=req.body||{};if(!['confirm','cancel'].includes(decision)||typeof code!=='string'||!/^\d{6}$/.test(code))throw erreur('Code ou décision invalide.',400);
 const uid=req.session.utilisateur.id;
 const ok=await transaction(async conn=>{
  const p=await profil(conn,uid);const [rows]=await conn.query("SELECT * FROM taskly_professional_mail_requests WHERE user_id=? AND status='pending_confirmation' AND expires_at>NOW() FOR UPDATE",[uid]);const row=rows[0];
  if(!row||row.attempts>=3||!correspond(p,row))return false;
  if(!codeValide(process.env.SESSION_SECRET,row,code)){await conn.query('UPDATE taskly_professional_mail_requests SET attempts=attempts+1 WHERE user_id=?',[uid]);return false;}
  await conn.query('UPDATE taskly_professional_mail_requests SET status=?,code_hash=NULL,expires_at=NULL,confirmed_at=NOW() WHERE user_id=?',[decision==='confirm'?'pending_admin':'cancelled',uid]);return true;
 });
 if(!ok)throw erreur('Code incorrect, expiré ou tentatives épuisées.',400);
 res.json({message:decision==='confirm'?'Demande transmise à l’administration.':'Demande annulée.'});
}));
admin.get('/',wrap(async(req,res)=>{const after=Number(req.query.after||0);if(!Number.isSafeInteger(after)||after<0)throw erreur('Pagination invalide.',400);const joined=gateway.configured;const fields=colonnes.split(',').map(c=>'r.'+c).join(',');const [rows]=await db.query(`SELECT ${fields}${joined?", CASE WHEN m.activated_at IS NOT NULL THEN 'active' WHEN m.user_id IS NOT NULL THEN 'activation_required' ELSE 'waiting_provider' END AS mailbox_state":''} FROM taskly_professional_mail_requests r ${joined?'LEFT JOIN taskly_professional_mailboxes m ON m.user_id=r.user_id AND m.address=r.proposed_address':''} WHERE r.user_id>? AND r.status IN ('pending_admin','approved_pending_provider','rejected') ORDER BY r.user_id LIMIT 50`,[after]);res.json({demandes:rows,next:rows.length===50?rows.at(-1).user_id:null,gatewayConfigured:gateway.configured});}));
admin.post('/:id/decision',sensible,wrap(async(req,res)=>{
 const id=Number(req.params.id),{decision,motif}=req.body||{};
 if(!Number.isSafeInteger(id)||id<1||!['approve','reject'].includes(decision)||decision==='reject'&&(typeof motif!=='string'||motif.trim().length<3||motif.length>500))throw erreur('Décision invalide. Motif exigé en cas de refus.',400);
 await transaction(async conn=>{const p=await profil(conn,id);const [rows]=await conn.query("SELECT * FROM taskly_professional_mail_requests WHERE user_id=? AND status='pending_admin' FOR UPDATE",[id]);const row=rows[0];if(!row||!correspond(p,row))throw erreur('Demande non confirmée, déjà traitée ou profil modifié.');await conn.query('UPDATE taskly_professional_mail_requests SET status=?,decided_by=?,decided_at=NOW(),refusal_reason=? WHERE user_id=?',[decision==='approve'?'approved_pending_provider':'rejected',req.session.utilisateur.id,decision==='reject'?motif.trim():null,id]);});
 res.json({message:decision==='approve'?'Demande approuvée. Création de la boîte en attente du fournisseur.':'Demande refusée.'});
}));
require('./professionalMailboxRoutes').mount({artisan,admin,db,transaction,profil,correspond,wrap,erreur,limiter,gateway,sendConfirmation:(...args)=>require('../services/adminMailService').envoyerCourrielAdmin(...args)});
module.exports={artisan,admin};
