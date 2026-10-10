const express=require('express');const bcrypt=require('bcrypt');
const model=require('../models/userModel');const {limiter}=require('../middleware/securityMiddleware');
const {genererCode,verifierCode}=require('../services/codeService');const {envoyerCode,estConfigure}=require('../services/emailService');
const router=express.Router();const limite=limiter({max:8});
router.post('/login',limite,async(req,res)=>{
  try{
    const {email,motDePasse}=req.body;
    if(!email || !motDePasse || !estConfigure()) return res.status(503).json({message:'Identifiants incomplets ou messagerie SMTP non configuree.'});
    const user=await model.trouverUtilisateurParEmail(String(email).trim().toLowerCase());
    if(!user || user.role!=='admin' || user.statut_compte==='bloque' || !await bcrypt.compare(motDePasse,user.mot_de_passe))
      return res.status(401).json({message:'Identifiants invalides.'});
    req.session.regenerate(async(error)=>{
      if(error) return res.status(500).json({message:'Erreur session.'});
      try{
        req.session.adminPendingUserId=user.id;
        const code=await genererCode(user.id,'admin_login');await envoyerCode(user.email,code,'admin_login');
        res.json({message:'Un code de verification a ete envoye par email.',codeRequis:true});
      }catch(e){console.error('Code admin :',e.message);res.status(e.status||500).json({message:'Envoi impossible. Verifiez votre configuration SMTP.'});}
    });
  }catch(e){console.error('Login admin :',e.message);res.status(500).json({message:'Erreur serveur.'});}
});
router.post('/verify',limite,async(req,res)=>{
  try{
    const id=req.session.adminPendingUserId;
    if(!id || !await verifierCode(id,'admin_login',String(req.body.code||''))) return res.status(401).json({message:'Code invalide ou expire.'});
    const user=await model.trouverUtilisateurParId(id);
    if(!user || user.role!=='admin' || user.statut_compte==='bloque') return res.status(403).json({message:'Acces refuse.'});
    await require('../config/db').promise().query('UPDATE users SET email_verified=1 WHERE id=?',[id]);
    req.session.regenerate(err=>{
      if(err) return res.status(500).json({message:'Erreur session.'});
      req.session.utilisateur={id:user.id,nom:user.nom,prenom:user.prenom,email:user.email,role:user.role,photo_profil:user.photo_profil};
      req.session.adminVerified=true;
      req.session.adminSessionVersion=user.admin_session_version;
      req.session.save(e=>e?res.status(500).json({message:'Erreur session.'}):res.json({message:'Connexion administrateur confirmee.'}));
    });
  }catch(e){console.error('Verification admin :',e.message);res.status(500).json({message:'Erreur serveur.'});}
});
module.exports=router;
