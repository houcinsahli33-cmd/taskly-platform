'use strict';
const path=require('node:path');
const fs=require('node:fs/promises');
const {verifierConnexion}=require('../middleware/authMiddleware');
const pages=new Set(['accueil','demandes','profil','support']);
const dossier=path.join(__dirname,'../../client/private/client');
function preparerCadreClient(original) {
 const head=original.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0];
 const body=original.match(/<body\b[^>]*>/i)?.[0];
 const aside=original.match(/<aside\b[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/aside>/i)?.[0];
 if(!head||!body||!aside)throw new Error('Document client non reconnu.');
 const shellHead=head.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<\/head>/i,
  '<link rel="stylesheet" href="/css/client-navigation-shell.css"><script defer src="/js/api.js"></script><script defer src="/js/auth.js"></script><script defer src="/js/client-navigation-stable.js"></script></head>');
 const shellBody=body.replace(/>$/, ' data-taskly-client-shell="1">');
 return '<!doctype html><html lang="fr">'+shellHead+shellBody+
  '<div id="site-header"></div><main class="dashboard-shell">'+aside+'<section class="dashboard-content" aria-hidden="true"></section></main>'+
  '<iframe id="taskly-client-content-frame" title="Contenu de l’espace client"></iframe></body></html>';
}
function preparerPageClientIntegree(original){
 if(!/<\/head>/i.test(original)||!/<body\b/i.test(original))throw new Error('Document client invalide.');
 return original.replace(/<\/head>/i,'<link rel="stylesheet" href="/css/client-navigation-embedded.css"></head>')
  .replace(/<body\b([^>]*)>/i,'<body$1 data-taskly-client-embedded="1">');
}
function monterNavigationClient(app){
 app.get('/espace/client/:page',verifierConnexion,async(req,res,next)=>{
  const {page}=req.params;
  if(!pages.has(page))return next();
  if(req.session.utilisateur.role!=='client')return res.status(403).json({message:'Accès refusé.'});
  try {
   const original=await fs.readFile(path.join(dossier,page+'.html'),'utf8');
   res.set('Cache-Control','no-store, private');
   if(req.query.taskly_client_embed==='1'||req.get('Sec-Fetch-Dest')==='iframe'){
    res.set('X-Frame-Options','SAMEORIGIN');res.set('Content-Security-Policy',"frame-ancestors 'self'");
    return res.type('html').send(preparerPageClientIntegree(original));
   }
   return res.type('html').send(preparerCadreClient(original));
  }catch(error){return res.status(503).send('Espace client temporairement indisponible.');}
 });
}
module.exports=monterNavigationClient;
module.exports.preparerCadreClient=preparerCadreClient;
module.exports.preparerPageClientIntegree=preparerPageClientIntegree;
