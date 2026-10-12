'use strict';
const path=require('node:path');
const fs=require('node:fs/promises');
const {verifierConnexion}=require('../middleware/authMiddleware');
const pages=new Set(['accueil','demandes','avis','profil','support']);
const dossier=path.join(__dirname,'../../client/private/artisan');
function preparerCadreArtisan(original) {
 const head=original.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0];
 const body=original.match(/<body\b[^>]*>/i)?.[0];
 const aside=original.match(/<aside\b[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/aside>/i)?.[0];
 if(!head||!body||!aside)throw new Error('Document artisan non reconnu.');
 const shellHead=head.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<\/head>/i,
  '<link rel="stylesheet" href="/css/artisan-navigation-shell.css?v=20261012-navigation-11"><script defer src="/js/api.js"></script><script defer src="/js/auth.js"></script><script defer src="/js/artisan-navigation-stable.js"></script></head>');
 const shellBody=body.replace(/>$/, ' data-taskly-artisan-shell="1">');
 return '<!doctype html><html lang="fr">'+shellHead+shellBody+
  '<div id="site-header"></div><main class="dashboard-shell">'+aside+
  '<section class="artisan-frame-container" aria-label="Rubrique artisan"><iframe id="taskly-artisan-content-frame" title="Contenu de l’espace artisan"></iframe></section></main></body></html>';
}
function preparerPageArtisanIntegree(original){
 if(!/<\/head>/i.test(original)||!/<body\b/i.test(original))throw new Error('Document artisan invalide.');
 return original.replace(/<\/head>/i,'<link rel="stylesheet" href="/css/artisan-navigation-embedded.css?v=20261012-navigation-11"></head>')
  .replace(/<body\b([^>]*)>/i,'<body$1 data-taskly-artisan-embedded="1">');
}
function monterNavigationArtisan(app){
 app.get('/espace/artisan/:page',verifierConnexion,async(req,res,next)=>{
  const {page}=req.params;
  if(!pages.has(page))return next();
  if(req.session.utilisateur.role!=='artisan')return res.status(403).json({message:'Accès refusé.'});
  try {
   const original=await fs.readFile(path.join(dossier,page+'.html'),'utf8');
   res.set('Cache-Control','no-store, private');
   if(req.query.taskly_artisan_embed==='1'||req.get('Sec-Fetch-Dest')==='iframe'){
    res.set('X-Frame-Options','SAMEORIGIN');res.set('Content-Security-Policy',"frame-ancestors 'self'");
    return res.type('html').send(preparerPageArtisanIntegree(original));
   }
   return res.type('html').send(preparerCadreArtisan(original));
  }catch(error){return res.status(503).send('Espace artisan temporairement indisponible.');}
 });
}
module.exports=monterNavigationArtisan;
module.exports.preparerCadreArtisan=preparerCadreArtisan;
module.exports.preparerPageArtisanIntegree=preparerPageArtisanIntegree;
