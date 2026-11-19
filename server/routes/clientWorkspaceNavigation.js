'use strict';
const path=require('node:path');
const fs=require('node:fs/promises');
const {verifierConnexion}=require('../middleware/authMiddleware');
const pages=new Set(['accueil','demandes','profil','support']);
const callsPilot=require('../services/chatCallPilot');
const chatEnabled=process.env.TASKLY_CHAT_WORKSPACE_ENABLED==='true';
if(chatEnabled)pages.add('messagerie');
function menuChat(original){
 if(!chatEnabled)return original;
 const link='<a href="/espace/client/messagerie" data-dashboard-link="messagerie"><svg class="chat-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11a8 8 0 0 1-8 8H4l2-5a8 8 0 1 1 15-3Z"/><path d="M8 11h8"/></svg><span>Messagerie privée</span><span class="chat-nav-count" data-chat-unread hidden></span></a>';
 return original.replace(/<a href="\/espace\/client\/profil"/,link+'<a href="/espace/client/profil"');
}
const dossier=path.join(__dirname,'../../client/private/client');
function preparerCadreClient(original,id) {
 original=menuChat(original);
 const head=original.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0];
 const body=original.match(/<body\b[^>]*>/i)?.[0];
 const aside=original.match(/<aside\b[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/aside>/i)?.[0];
 if(!head||!body||!aside)throw new Error('Document client non reconnu.');
 const shellHead=head.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<\/head>/i,
  '<link rel="stylesheet" href="/css/client-navigation-shell.css?v=20261119-audit1"><script defer src="/js/api.js"></script><script defer src="/js/auth.js"></script><script defer src="/js/client-navigation-stable.js?v=chat-calls1"></script></head>');
 const finalHead=chatEnabled?shellHead.replace('</head>','<link rel="stylesheet" href="/css/taskly-chat-workspace.css?v=4"><script defer src="/js/taskly-chat-notifications.js?v=2"></script></head>'):shellHead;
 const callHead=chatEnabled&&callsPilot.autoriseCompte('client',id)
  ?finalHead.replace('</head>','<link rel="stylesheet" href="/css/taskly-call.css?v=2"><script defer src="/js/taskly-call-notifications.js?v=3"></script></head>')
  :finalHead;
 const shellBody=body.replace(/>$/, ' data-taskly-client-shell="1">');
 return '<!doctype html><html lang="fr">'+callHead+shellBody+
  '<div id="site-header"></div><main class="dashboard-shell">'+aside+
  '<section class="client-frame-container" aria-label="Rubrique client"><iframe id="taskly-client-content-frame"'+(chatEnabled&&callsPilot.autoriseCompte('client',id)?' allow="camera \'self\'; microphone \'self\'"':'')+' title="Contenu de l’espace client"></iframe></section></main></body></html>';
}
function preparerPageClientIntegree(original,id){
 original=menuChat(original);
 if(!/<\/head>/i.test(original)||!/<body\b/i.test(original))throw new Error('Document client invalide.');
 return original.replace(/<\/head>/i,'<link rel="stylesheet" href="/css/client-navigation-embedded.css?v=20261012-maquette"></head>')
  .replace(/<body\b([^>]*)>/i,'<body$1 data-taskly-client-embedded="1"'+(chatEnabled?' data-taskly-chat-workspace="1"':'')+(chatEnabled&&callsPilot.autoriseCompte('client',id)?' data-taskly-chat-calls="1" data-taskly-chat-call-demande="'+callsPilot.interfaceDemande()+'"':'')+'>');
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
    return res.type('html').send(preparerPageClientIntegree(original,req.session.utilisateur.id));
   }
   return res.type('html').send(preparerCadreClient(original,req.session.utilisateur.id));
  }catch(error){return res.status(503).send('Espace client temporairement indisponible.');}
 });
}
module.exports=monterNavigationClient;
module.exports.preparerCadreClient=preparerCadreClient;
module.exports.preparerPageClientIntegree=preparerPageClientIntegree;
