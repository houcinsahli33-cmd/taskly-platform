'use strict';
// Opt-in API, zero modification of existing mail routes or SMTP.
const express=require('express');
const {createServiceThreads}=require('../services/tasklyMailServiceThreads');
const {verifierConnexion,verifierAdmin}=require('../middleware/authMiddleware');
const {limiter}=require('../middleware/securityMiddleware');
const {modeClient}=require('../services/professionalMailAccess');

function createRouters({db,env=process.env}={}) {
  if(!db || typeof db.getConnection!=='function')throw new TypeError('Pool SQL requis');
  const user=express.Router(),admin=express.Router();
  const enabled=(req,res,next)=>env.TASKLY_MAIL_SERVICE_V3_ENABLED==='true' &&
    env.TASKLY_MAIL_INTERNAL_ENABLED==='true' &&
    env.TASKLY_MAIL_PILOT_ENABLED==='true' ? next():res.status(404).json({message:'Service indisponible.'});
  async function transaction(fn){
    let conn;
    try{
      conn=await db.getConnection();await conn.beginTransaction();
      const result=await fn(conn);await conn.commit();return result;
    }catch(e){if(conn)await conn.rollback();throw e;}
    finally{conn?.release();}
  }
  // The caller ID comes ONLY from the server session; account validity and
  // professional-mail ownership are rechecked against the live database.
  async function userMailbox(conn,uid){
    const [rows]=await conn.query(`SELECT m.user_id,m.address,m.provider_id,${env.TASKLY_ADMIN_MAIL_V10_ENABLED==='true'?'m.suspended_at':'NULL AS suspended_at'},u.role,u.statut_compte,
      u.email_verified,r.status,r.confirmed_at,r.proposed_address,
      r.client_id,r.artisan_id,r.service_id,
      c.id AS actual_client_id,a.id AS actual_artisan_id,
      a.service_id AS actual_service_id,a.verification_statut
      FROM taskly_professional_mailboxes m
      JOIN users u ON u.id=m.user_id
      JOIN taskly_professional_mail_requests r ON r.user_id=m.user_id
      LEFT JOIN clients c ON c.user_id=u.id
      LEFT JOIN artisans a ON a.user_id=u.id
      WHERE m.user_id=? AND m.activated_at IS NOT NULL`,[uid]);
    const m=rows[0];
    if(env.TASKLY_ADMIN_MAIL_V10_ENABLED==='true'&&m?.suspended_at)return null;
    if(!m||m.statut_compte!=='actif'||Number(m.email_verified)!==1||
       m.status!=='approved_pending_provider'||!m.confirmed_at||
       m.address!==m.proposed_address||!/^internal:[a-f0-9]{64}$/.test(m.provider_id)||
       !/^[^\s@]+@[a-z0-9-]+\.taskly\.(?:dz|test)$/i.test(m.address))return null;
    if(m.role==='client'){
      if(!modeClient(env)||!m.actual_client_id||Number(m.client_id)!==Number(m.actual_client_id)||
         m.artisan_id!=null||m.service_id!=null)return null;
    }else if(m.role==='artisan'){
      if(!m.actual_artisan_id||!m.actual_service_id||m.verification_statut!=='approuve'||
         Number(m.artisan_id)!==Number(m.actual_artisan_id)||Number(m.service_id)!==Number(m.actual_service_id)||
         m.client_id!=null)return null;
    }else return null;
    return {user_id:m.user_id,address:m.address};
  }
  async function contactAccount(conn,uid){
    const [rows]=await conn.query(`SELECT u.id AS user_id,u.email AS account_email,u.role,u.statut_compte,
       m.address AS mailbox_address
       FROM users u LEFT JOIN taskly_professional_mailboxes m ON m.user_id=u.id
       AND m.activated_at IS NOT NULL
       WHERE u.id=? AND u.role IN ('client','artisan') AND u.statut_compte='actif' AND u.email_verified=1`,[uid]);
    const row=rows[0];if(!row)return null;
    return {user_id:row.user_id,address:row.mailbox_address||row.account_email};
  }
  const service=createServiceThreads({transaction,userMailbox,contactAccount,
    authorizeAdmin:async ctx=>Boolean(ctx?.verified===true && ctx?.serverAdmin===true && Number.isSafeInteger(ctx?.userId)&&ctx.userId>0)});
  const handle=fn=>async(req,res)=>{
    try{await fn(req,res);}catch(e){
      console.error('Taskly Mail V3 :',e.code||e.status||e.name);
      res.status(e.status||503).json({message:e.status?e.message:'Service temporairement indisponible.'});
    }
  };
  user.use(enabled,verifierConnexion,(req,res,next)=>
    ['client','artisan'].includes(req.session?.utilisateur?.role)?next():res.status(403).json({message:'Acces refuse.'}));
  admin.use(enabled,verifierConnexion,verifierAdmin);
  admin.use((req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
  // Uses server-chosen admin route context, never user supplied fields.
  const adminContext=req=>({userId:Number(req.session.utilisateur.id),verified:req.session.adminVerified===true,
    serverAdmin:req.tasklyAdminContext===true && req.session.utilisateur.role==='admin'});
  user.get('/support/threads',limiter({max:60}),handle(async(req,res)=>{
    res.json(await service.listForUser(req.session.utilisateur.id));
  }));
  // Directory: account names only for a verified administrator, never private messages.
  admin.get('/support/contacts',limiter({max:30}),handle(async(req,res)=>{
    if(!adminContext(req).verified || !adminContext(req).serverAdmin) return res.status(403).json({message:'Administration non autorisée.'});
    const q=String(req.query.q||'').trim();
    const page=Number(req.query.page||0);
    if(q.length>100||!Number.isSafeInteger(page)||page<0||page>10000)return res.status(400).json({message:'Recherche invalide.'});
    const [contacts]=await db.query(`SELECT id,nom,prenom,email,role FROM users
      WHERE role IN ('client','artisan') AND statut_compte='actif' AND email_verified=1
      AND (?='' OR LOCATE(LOWER(?),LOWER(CONCAT_WS(' ',nom,prenom,email,CAST(id AS CHAR))))>0)
      ORDER BY id DESC LIMIT 51 OFFSET ?`,[q,q,page*50]);
    res.json({contacts:contacts.slice(0,50),hasMore:contacts.length>50,page});
  }));
  admin.get('/support/threads',limiter({max:60}),handle(async(req,res)=>{
    res.json(await service.listForAdmin(adminContext(req)));
  }));
  user.post('/support/threads',limiter({max:8}),handle(async(req,res)=>{
    const result=await service.createFromUser(req.session.utilisateur.id,req.body?.to,req.body?.subject,req.body?.body);
    res.status(201).json(result);
  }));
  user.get('/support/threads/:id',limiter({max:60}),handle(async(req,res)=>{
    res.json(await service.readForUser(req.session.utilisateur.id,req.params.id));
  }));
  admin.get('/support/threads/:id',limiter({max:60}),handle(async(req,res)=>{
    res.json(await service.readForAdmin(adminContext(req),req.params.id));
  }));
  admin.post('/support/threads',limiter({max:8}),handle(async(req,res)=>{
    res.status(201).json(await service.createFromAdmin(adminContext(req),req.body?.userId,req.body?.subject,req.body?.body));
  }));
  user.post('/support/threads/:id/replies',limiter({max:20}),handle(async(req,res)=>{
    res.status(201).json(await service.replyAsUser(req.session.utilisateur.id,req.params.id,req.body?.body));
  }));
  admin.post('/support/threads/:id/replies',limiter({max:20}),handle(async(req,res)=>{
    res.status(201).json(await service.replyAsAdmin(adminContext(req),req.params.id,req.body?.body));
  }));
  return {user,admin};
}
module.exports={createRouters};
