'use strict';
const express=require('express');
const {verifierConnexion,verifierAdmin}=require('../middleware/authMiddleware');
const {limiter}=require('../middleware/securityMiddleware');
const {createService}=require('../services/tasklyAdminPrivateV17Service');
const service=createService({db:require('../config/db').promise()});
const admin=express.Router(),user=express.Router();
const on=(req,res,next)=>process.env.TASKLY_ADMIN_PRIVATE_V17_ENABLED==='true' ? next():res.status(404).json({message:'Route indisponible.'});
admin.use(on,verifierConnexion,verifierAdmin,(req,res,next)=>req.tasklyAdminContext===true&&req.session?.adminVerified===true?next():res.status(403).json({message:'Session admin requise.'}));
user.use(on,verifierConnexion,(req,res,next)=>req.tasklyAdminContext!==true&&['client','artisan'].includes(req.session?.utilisateur?.role)?next():res.status(403).json({message:'Acces refuse.'}));
for(const router of [admin,user])router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
const callsOn=(req,res,next)=>
  process.env.TASKLY_ADMIN_PRIVATE_V17_ENABLED==='true' &&
  process.env.TASKLY_ADMIN_PRIVATE_CALLS_V17_ENABLED==='true'
    ? next()
    : res.status(404).json({
        message:'Appels administratifs indisponibles.'
      });

const handle=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){res.status(e.status||503).json({message:e.status?e.message:'Messagerie indisponible.'});}};
admin.get('/contacts',limiter({max:30}),
  handle(async(req,res)=>res.json({
    contacts:await service.contacts(
      req.session.utilisateur.id,req.query.q
    )
  })));

admin.post('/threads',limiter({max:8}),handle(async(req,res)=>res.status(201).json({thread:await service.open(req.session.utilisateur.id,req.body?.memberUserId)})));
for(const [router,role] of [[admin,'admin'],[user,'user']]){
  // Administrative calls are isolated from legacy calls.

  router.post(
    '/threads/:id/calls',
    callsOn,
    limiter({max:10}),
    handle(async(req,res)=>{
      const body=req.body;

      if(!body ||
         Object.keys(body).length!==1 ||
         !['audio','video'].includes(body.kind)){
        return res.status(400).json({
          message:'Type appel invalide.'
        });
      }

      res.status(201).json({
        call:await service.calls.start(
          req.session.utilisateur.id,
          role,
          req.params.id,
          body.kind
        )
      });
    })
  );

  router.get(
    '/threads/:id/calls/current',
    callsOn,
    limiter({max:60}),
    handle(async(req,res)=>{
      res.json(await service.calls.current(
        req.session.utilisateur.id,
        role,
        req.params.id
      ));
    })
  );

  router.get(
    '/threads/:id/calls/:callId',
    callsOn,
    limiter({max:60}),
    handle(async(req,res)=>{
      res.json({
        call:await service.calls.get(
          req.session.utilisateur.id,
          role,
          req.params.id,
          req.params.callId
        )
      });
    })
  );

  router.post(
    '/threads/:id/calls/:callId/action',
    callsOn,
    limiter({max:20}),
    handle(async(req,res)=>{
      const body=req.body;

      if(!body ||
         Object.keys(body).length!==1 ||
         !['accept','reject','cancel','end'].includes(body.action)){
        return res.status(400).json({
          message:'Action invalide.'
        });
      }

      res.json({
        call:await service.calls.transition(
          req.session.utilisateur.id,
          role,
          req.params.id,
          req.params.callId,
          body.action
        )
      });
    })
  );

  router.get('/unread',limiter({max:60}),
    handle(async(req,res)=>res.json(
      await service.unread(
        req.session.utilisateur.id,
        role
      )
    )));

  router.post('/threads/:id/read',limiter({max:30}),
    handle(async(req,res)=>{
      const body=req.body;

      if(!body ||
         Object.keys(body).length!==1 ||
         !Array.isArray(body.messageIds)){
        return res.status(400).json({
          message:'Liste de messages requise.'
        });
      }

      res.json(await service.markRead(
        req.session.utilisateur.id,
        role,
        req.params.id,
        body.messageIds
      ));
    }));

  router.get('/threads/:id/keys',limiter({max:30}),
    handle(async(req,res)=>res.json({
      keys:await service.getPublicKeys(
        req.session.utilisateur.id,
        role,
        req.params.id
      )
    })));

  router.post('/threads/:id/keys',limiter({max:8}),
    handle(async(req,res)=>{
      const body=req.body;
      if(!body || Object.keys(body).length!==1 ||
         typeof body.publicKey!=='string'){
        return res.status(400).json({
          message:'Cle publique uniquement.'
        });
      }

      res.json(await service.publishPublicKey(
        req.session.utilisateur.id,
        role,
        req.params.id,
        body.publicKey
      ));
    }));
  router.get('/threads',limiter({max:60}),handle(async(req,res)=>res.json({threads:await service.list(req.session.utilisateur.id,role)})));
  router.get('/threads/:id',limiter({max:60}),handle(async(req,res)=>res.json({messages:await service.read(req.session.utilisateur.id,role,req.params.id)})));
  router.post('/threads/:id/messages',limiter({max:15}),handle(async(req,res)=>res.status(201).json({message:await service.send(req.session.utilisateur.id,role,req.params.id,req.body)})));
}
module.exports={admin,user};
