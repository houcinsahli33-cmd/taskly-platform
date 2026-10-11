'use strict';
const path=require('path');
const fs=require('node:fs/promises');
const {verifierConnexion,verifierAdmin}=require('../middleware/authMiddleware');
const pages={client:['accueil','demandes','profil','support'],artisan:['accueil','demandes','avis','profil','support'],admin:['overview','users','reports','contacts','services','verification','account','admins','site']};
// Navigation persistante : la page d'origine reste la source unique du design.
// On reprend son <head> et son <aside> SANS en modifier le contenu.
function preparerCadreAdmin(original) {
 const head=original.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0];
 const body=original.match(/<body\b[^>]*>/i)?.[0];
 const aside=original.match(/<aside\b[^>]*class="[^"]*admin-sidebar[^"]*"[^>]*>[\s\S]*?<\/aside>/i)?.[0];
 if(!head||!body||!aside)throw Error('Structure de rubrique administrateur inconnue.');
 const cleanHead=head.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<\/head>/i,
  '<link rel="stylesheet" href="/css/admin-navigation-stable.css">'+
  '<script defer src="/js/api.js"></script><script defer src="/js/auth.js"></script>'+
  '<script defer src="/js/admin-settings.js"></script><script defer src="/js/admin-navigation-stable.js"></script></head>');
 const shellBody=body.replace(/>$/, ' data-taskly-shell="1">');
 return '<!DOCTYPE html>\n<html lang="fr">'+cleanHead+shellBody+
  '<main class="admin-layout">'+aside+'<section class="admin-content" aria-hidden="true"></section></main>'+
  '<iframe id="taskly-admin-content-frame" title="Contenu de la rubrique administrateur" aria-label="Contenu de la rubrique administrateur"></iframe>'+
  '</body></html>';
}
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
  // Les autorisations ci-dessus sont appliquées pour les deux variantes.
  // L'iframe affiche le document COMPLET original à la largeur du navigateur :
  // ni CSS responsive faussé, ni formulaire ou fenêtre reconstruit.
  if(req.query.taskly_embed==='1' || req.get('Sec-Fetch-Dest')==='iframe') {
   res.set('X-Frame-Options','SAMEORIGIN');
   res.set('Content-Security-Policy',"frame-ancestors 'self'");
   try {
    const original=await fs.readFile(path.join(root,'admin',page+'.html'),'utf8');
    // Le document sur disque reste intact. En iframe, seule la COPIE du menu
    // est cachee visuellement, sans supprimer sa largeur dans la grille.
    res.set('Cache-Control','no-store, private');
    return res.type('html').send(preparerPageIntegree(original));
   }catch(error){return res.status(503).send('Impossible de charger cette rubrique administrateur.');}
  }
  try {
   const original=await fs.readFile(path.join(root,'admin',page+'.html'),'utf8');
   res.type('html').send(preparerCadreAdmin(original));
  }catch(error) {
   res.status(503).send('Impossible de charger cette rubrique administrateur.');
  }
 });
};
module.exports.pages=pages;

// Les documents administrateur originaux ne sont pas edites.
function preparerPageIntegree(original) {
 if(!/<\/head>/i.test(original)||!/<body\b/i.test(original))throw Error('Document admin invalide.');
 return original.replace(/<\/head>/i,
  '<link rel="stylesheet" href="/css/admin-navigation-embedded.css"></head>')
  .replace(/<body\b([^>]*)>/i,'<body$1 data-taskly-embed="1">');
}
module.exports.preparerCadreAdmin=preparerCadreAdmin;
module.exports.preparerPageIntegree=preparerPageIntegree;
