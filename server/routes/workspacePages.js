'use strict';
const path=require('path');
const {verifierConnexion,verifierAdmin}=require('../middleware/authMiddleware');
const pages={client:['accueil','demandes','profil','support'],artisan:['accueil','demandes','avis','profil','support'],admin:['overview','users','reports','contacts','services','verification','account','admins','site']};
module.exports=function monterPages(app,{adminEntryPath,headersAdminPrive}){
 const root=path.join(__dirname,'../../client/private');
 app.get(['/artisan-dashboard.html','/client-dashboard.html'],verifierConnexion,(req,res)=>{
  const role=req.path.startsWith('/artisan-')?'artisan':'client';
  if(req.session.utilisateur.role!==role)return res.status(403).send('Accès refusé.');
  const page=pages[role].includes(req.query.page)?req.query.page:'accueil';
  res.redirect(302,`/espace/${role}/${page}`);
 });
 app.get('/espace/:role/:page',verifierConnexion,(req,res)=>{
  const {role,page}=req.params;
  if(!['client','artisan'].includes(role)||!pages[role].includes(page))return res.status(404).send('Page introuvable.');
  if(req.session.utilisateur.role!==role)return res.status(403).send('Accès refusé.');
  res.set('Cache-Control','no-store, private');
  res.sendFile(path.join(root,role,page+'.html'),{dotfiles:'allow'});
 });
 app.get(adminEntryPath+'/dashboard',headersAdminPrive,verifierConnexion,verifierAdmin,(req,res)=>{
  res.redirect(302,adminEntryPath+'/dashboard/'+(pages.admin.includes(req.query.page)?req.query.page:'overview'));
 });
 app.get(adminEntryPath+'/dashboard/:page',headersAdminPrive,verifierConnexion,verifierAdmin,async(req,res)=>{
  const {page}=req.params;
  if(!pages.admin.includes(page))return res.status(404).send('Page introuvable.');
  if(['site','admins'].includes(page)){
   try {const [rows]=await require('../config/db').promise().query('SELECT niveau FROM admin_roles WHERE user_id=?',[req.session.utilisateur.id]);
    if(rows[0]?.niveau!=='principal')return res.status(403).send('Cette page est réservée à l’administrateur principal.');
   }catch(error){return res.status(503).send('Vérification des autorisations indisponible.');}
  }
  res.sendFile(path.join(root,'admin',page+'.html'),{dotfiles:'allow'});
 });
};
module.exports.pages=pages;
