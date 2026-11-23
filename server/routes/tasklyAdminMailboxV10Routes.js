'use strict';
// Isolated administrative mailbox; feature-flagged and admin-verified.
const express=require('express');
const crypto=require('node:crypto');
const {verifierConnexion,verifierAdmin}=require('../middleware/authMiddleware');
const {limiter}=require('../middleware/securityMiddleware');
const router=express.Router();
const db=require('../config/db').promise();
const on=(req,res,next)=>process.env.TASKLY_ADMIN_MAIL_V10_ENABLED==='true' &&
 process.env.TASKLY_MAIL_INTERNAL_ENABLED==='true' &&
 process.env.TASKLY_MAIL_FOLDERS_ENABLED==='true' ? next() : res.status(404).json({message:'Messagerie administrative non activée.'});
router.use(on,verifierConnexion,verifierAdmin,(req,res,next)=>req.session?.adminVerified===true && req.tasklyAdminContext===true ? next():res.status(403).json({message:'Vérification administrateur requise.'}));
router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
const error=(message,status=400)=>Object.assign(new Error(message),{status});
const handle=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){console.error('Taskly Admin Mail V10 :',e.code||e.name);res.status(e.status||503).json({message:e.status?e.message:'Messagerie indisponible.'});}};
async function tx(fn){let c;try{c=await db.getConnection();await c.beginTransaction();const r=await fn(c);await c.commit();return r;}catch(e){if(c)await c.rollback();throw e;}finally{c?.release();}}
const id=v=>{if(!/^[1-9][0-9]{0,18}$/.test(String(v)))throw error('Identifiant invalide.');return String(v);};
const filters={inbox:"folder='inbox' AND archived_at IS NULL AND trashed_at IS NULL",sent:"folder='sent' AND archived_at IS NULL AND trashed_at IS NULL",favorites:'is_starred=1 AND trashed_at IS NULL',archive:'archived_at IS NOT NULL AND trashed_at IS NULL',trash:'trashed_at IS NOT NULL'};
router.get('/messages',limiter({max:90}),handle(async(req,res)=>{
 const folder=req.query.folder||'inbox',q=req.query.q||'';
 if(!Object.hasOwn(filters,folder)||typeof q!=='string'||q.length>100)throw error('Filtre invalide.');
 const [rows]=await db.query(`SELECT CAST(id AS CHAR) AS id,message_id,folder,from_address AS \`from\`,to_address AS \`to\`,subject,LEFT(body,120) AS preview,created_at AS date,is_read AS isRead,is_starred AS starred FROM taskly_admin_mail_messages WHERE ${filters[folder]} AND (?='' OR LOCATE(LOWER(?),LOWER(CONCAT_WS(' ',from_address,to_address,subject,body)))>0) ORDER BY id DESC LIMIT 100`,[q,q]);
 res.json({messages:rows});
}));
router.get('/counts',limiter({max:90}),handle(async(req,res)=>{
 const [rows]=await db.query("SELECT SUM(folder='inbox' AND is_read=0 AND archived_at IS NULL AND trashed_at IS NULL) AS unread,SUM(DATE(created_at)=CURRENT_DATE()) AS today FROM taskly_admin_mail_messages WHERE trashed_at IS NULL");
 res.json({unread:Number(rows[0]?.unread||0),today:Number(rows[0]?.today||0),attachments:null});
}));
router.post('/messages/:id/read',limiter({max:45}),handle(async(req,res)=>{
 const m=await tx(async c=>{const [r]=await c.query('SELECT CAST(id AS CHAR) AS id,folder,from_address AS `from`,to_address AS `to`,subject,body,created_at AS date,is_read AS isRead,is_starred AS starred FROM taskly_admin_mail_messages WHERE id=CAST(? AS UNSIGNED) AND trashed_at IS NULL FOR UPDATE',[id(req.params.id)]);if(!r[0])throw error('Message introuvable.',404);await c.query("UPDATE taskly_admin_mail_messages SET is_read=1 WHERE id=CAST(? AS UNSIGNED) AND folder='inbox'",[req.params.id]);return r[0];});res.json({message:m});
}));
router.post('/messages/:id/action',limiter({max:30}),handle(async(req,res)=>{
 const updates={star:'is_starred=1',unstar:'is_starred=0',archive:'archived_at=NOW()',unarchive:'archived_at=NULL',trash:'trashed_at=NOW()',restore:'trashed_at=NULL'};
 const action=req.body?.action;if(!Object.hasOwn(updates,action))throw error('Action invalide.');
 await tx(async c=>{const [r]=await c.query('SELECT id,trashed_at FROM taskly_admin_mail_messages WHERE id=CAST(? AS UNSIGNED) FOR UPDATE',[id(req.params.id)]);if(!r[0])throw error('Message introuvable.',404);if(r[0].trashed_at && action!=='restore')throw error('Restaurez le message auparavant.',409);await c.query(`UPDATE taskly_admin_mail_messages SET ${updates[action]} WHERE id=CAST(? AS UNSIGNED)`,[req.params.id]);});res.json({ok:true});
}));
router.get('/recipients',limiter({max:60}),handle(async(req,res)=>{
 const q=String(req.query.q||'').trim();if(q.length>100)throw error('Recherche invalide.');
 const [rows]=await db.query(`SELECT m.address,u.role,u.nom,u.prenom FROM taskly_professional_mailboxes m JOIN users u ON u.id=m.user_id LEFT JOIN artisans a ON a.user_id=u.id LEFT JOIN clients c ON c.user_id=u.id JOIN taskly_professional_mail_requests r ON r.user_id=u.id AND r.proposed_address=m.address WHERE m.activated_at IS NOT NULL AND m.suspended_at IS NULL AND u.statut_compte='actif' AND u.email_verified=1 AND r.status='approved_pending_provider' AND ((u.role='client' AND c.id=r.client_id) OR (u.role='artisan' AND a.id=r.artisan_id AND a.service_id=r.service_id AND a.verification_statut='approuve')) AND (?='' OR LOCATE(LOWER(?),LOWER(CONCAT_WS(' ',m.address,u.nom,u.prenom)))>0) ORDER BY m.address LIMIT 30`,[q,q]);res.json({recipients:rows});
}));
// One saved draft for administrative mailbox. Server-side, never another user's draft.
router.get('/draft',limiter({max:60}),handle(async(req,res)=>{
 const [rows]=await db.query('SELECT recipient AS `to`,subject,body FROM taskly_admin_mail_draft WHERE id=1');
 res.json({draft:rows[0]||{to:'',subject:'',body:''}});
}));
router.put('/draft',limiter({max:30}),handle(async(req,res)=>{
 const {to='',subject='',body=''}=req.body||{};
 if(typeof to!=='string'||typeof subject!=='string'||typeof body!=='string'||to.length>254||subject.length>200||body.length>10000)throw error('Brouillon invalide.');
 await db.query('INSERT INTO taskly_admin_mail_draft (id,recipient,subject,body) VALUES (1,?,?,?) ON DUPLICATE KEY UPDATE recipient=VALUES(recipient),subject=VALUES(subject),body=VALUES(body)',[to,subject,body]);
 res.json({ok:true});
}));
router.delete('/draft',limiter({max:30}),handle(async(req,res)=>{await db.query('DELETE FROM taskly_admin_mail_draft WHERE id=1');res.json({ok:true});}));
router.post('/send',limiter({max:12}),handle(async(req,res)=>{
 const {to,subject,body}=req.body||{};
 if(typeof to!=='string'||typeof subject!=='string'||typeof body!=='string'||!/^[-a-z0-9._]+@[a-z0-9-]+\.taskly\.(?:dz|test)$/i.test(to)||!subject.trim()||subject.length>200||!body.trim()||body.length>10000)throw error('Message invalide.');
 const messageId=crypto.randomUUID();
 await tx(async c=>{
  const [users]=await c.query(`SELECT m.user_id,m.address FROM taskly_professional_mailboxes m JOIN taskly_professional_mail_requests r ON r.user_id=m.user_id AND r.proposed_address=m.address JOIN users u ON u.id=m.user_id LEFT JOIN artisans a ON a.user_id=u.id LEFT JOIN clients c ON c.user_id=u.id WHERE m.address=? AND m.activated_at IS NOT NULL AND m.suspended_at IS NULL AND r.status='approved_pending_provider' AND u.statut_compte='actif' AND u.email_verified=1 AND ((u.role='client' AND c.id=r.client_id) OR (u.role='artisan' AND a.id=r.artisan_id AND a.service_id=r.service_id AND a.verification_statut='approuve')) FOR UPDATE`,[to.toLowerCase()]);
  if(!users[0])throw error('Destinataire non autorisé.',404);
  await c.query("INSERT INTO taskly_admin_mail_messages (message_id,folder,from_address,to_address,subject,body,is_read) VALUES (?,'sent','administration@taskly.dz',?,?,?,1)",[messageId,to.toLowerCase(),subject.trim(),body.trim()]);
  await c.query("INSERT INTO taskly_professional_mail_messages (owner_user_id,message_id,folder,from_address,to_address,subject,body,is_read) VALUES (?,?,'inbox','administration@taskly.dz',?,?,?,0)",[users[0].user_id,messageId,to.toLowerCase(),subject.trim(),body.trim()]);
 });res.status(201).json({id:messageId,message:'Message interne enregistré.'});
}));
module.exports=router;
