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
    const [rows]=await conn.query(`SELECT m.user_id,m.address,m.provider_id,u.role,u.statut_compte,
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
  const service=createServiceThreads({transaction,userMailbox,
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
  // Uses server-chosen admin route context, never user supplied fields.
  const adminContext=req=>({userId:Number(req.session.utilisateur.id),verified:req.session.adminVerified===true,
    serverAdmin:req.tasklyAdminContext===true && req.session.utilisateur.role==='admin'});
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
  admin.post('/support/threads/:id/replies',limiter({max:20}),handle(async(req,res)=>{
    res.status(201).json(await service.replyAsAdmin(adminContext(req),req.params.id,req.body?.body));
  }));
  return {user,admin};
}
module.exports={createRouters};
