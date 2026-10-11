'use strict';
const path=require('path');
const fs=require('fs/promises');
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
  // Seules les rubriques administrateur protégées peuvent être intégrées
  // dans un cadre du MEME site (la configuration globale reste DENY).
  res.set('X-Frame-Options','SAMEORIGIN');
  res.set('Content-Security-Policy',"frame-ancestors 'self'");
  // Le chrome (menu + défilement) vit dans une seule page persistante.
  // Les documents de rubrique restent inchangés, avec leurs propres scripts.
  res.set('Cache-Control','no-store, private');
  if(req.query.taskly_embed !== '1') {
   return res.sendFile(path.join(root,'admin','admin-shell.html'),{dotfiles:'allow'});
  }
  try {
   const original=await fs.readFile(path.join(root,'admin',page+'.html'),'utf8');
   // Seulement après authentification et vérification de niveau ci-dessus.
   const withFrameAssets=original.replace('</head>',
     '<link rel="stylesheet" href="/css/admin-embedded.css">'+
     '<script defer src="/js/admin-frame.js"></script></head>');
   res.type('html').send(withFrameAssets);
  } catch(error) {
   res.status(503).send('Impossible de charger la rubrique administrateur.');
  }
 });
};
module.exports.pages=pages;
