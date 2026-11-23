'use strict';
const path=require('node:path');
const fs=require('node:fs/promises');
const {verifierConnexion}=require('../middleware/authMiddleware');
const pages=new Set(['accueil','demandes','profil','support']);
const callsPilot=require('../services/chatCallPilot');
const chatEnabled=process.env.TASKLY_CHAT_WORKSPACE_ENABLED==='true';
if(chatEnabled)pages.add('messagerie');

const mailClientEnabled=
 process.env.TASKLY_MAIL_CLIENT_ENABLED==='true'
 && require('../services/professionalMailAccess').modeClient(process.env);

if(mailClientEnabled)pages.add('taskly-mail');

function menuMail(original){
 if(!mailClientEnabled)return original;
 const link='<a href="/espace/client/taskly-mail" data-dashboard-link="taskly-mail"><svg class="chat-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg><span>Taskly Mail</span></a>';
 return original.replace(/<a href="\/espace\/client\/support"/,link+'<a href="/espace/client/support"');
}
function menuChat(original){
 if(!chatEnabled)return original;
 const link='<a href="/espace/client/messagerie" data-dashboard-link="messagerie"><svg class="chat-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11a8 8 0 0 1-8 8H4l2-5a8 8 0 1 1 15-3Z"/><path d="M8 11h8"/></svg><span>Messagerie privée</span><span class="chat-nav-count" data-chat-unread hidden></span></a>';
 return original.replace(/<a href="\/espace\/client\/profil"/,link+'<a href="/espace/client/profil"');
}
const dossier=path.join(__dirname,'../../client/private/client');
function preparerCadreClient(original,id) {
 original=menuChat(original);
 original=menuMail(original);
 const head=original.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0];
 const body=original.match(/<body\b[^>]*>/i)?.[0];
 const aside=original.match(/<aside\b[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/aside>/i)?.[0];
 if(!head||!body||!aside)throw new Error('Document client non reconnu.');
 // Icônes du menu mobile : ajout au cadre uniquement, sans toucher aux pages intégrées.
 const icones={
  accueil:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  demandes:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  profil:'<circle cx="12" cy="7" r="4"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8"/>',
  support:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17v1"/>'
 };
 const maison='<svg class="chat-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/></svg>';
 let menuAside=aside.replace(/(<p\b[^>]*class="[^"]*\bsidebar-title\b[^"]*"[^>]*>)\s*Espace client/i,'$1'+maison+'<span>Espace client</span>');
 menuAside=menuAside.replace(/(<a\b[^>]*data-dashboard-link="(accueil|demandes|profil|support)"[^>]*>)/gi,(match,tag,nom)=>
  tag+'<svg class="chat-nav-icon" viewBox="0 0 24 24" aria-hidden="true">'+icones[nom]+'</svg><span>');
 // Les liens du HTML source ne contiennent pas de span final.
 menuAside=menuAside.replace(/(<a\b[^>]*data-dashboard-link="(?:accueil|demandes|profil|support)"[^>]*>[\s\S]*?)(<\/a>)/gi,'$1</span>$2');
 const shellHead=head.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<head\b[^>]*>/i,match=>match+'<style>@media(max-width:800px){body[data-taskly-client-shell="1"] .dashboard-shell>.sidebar,body[data-taskly-artisan-shell="1"] .dashboard-shell>.sidebar{visibility:hidden!important}body.taskly-mobile-ready[data-taskly-client-shell="1"] .dashboard-shell>.sidebar,body.taskly-mobile-ready[data-taskly-artisan-shell="1"] .dashboard-shell>.sidebar{visibility:visible!important}}</style>').replace(/<\/head>/i,
  '<link rel="stylesheet" href="/css/client-navigation-shell.css?v=20261119-audit1"><script defer src="/js/api.js"></script><script defer src="/js/auth.js"></script><script defer src="/js/client-navigation-stable.js?v=taskly-mail1"></script></head>');
 const finalHead=chatEnabled?shellHead.replace('</head>','<link rel="stylesheet" href="/css/taskly-chat-workspace.css?v=5"><script defer src="/js/taskly-chat-notifications.js?v=2"></script></head>'):shellHead;
 const callHead=chatEnabled&&callsPilot.autoriseCompte('client',id)
  ?finalHead.replace('</head>','<link rel="stylesheet" href="/css/taskly-call.css?v=2"><script defer src="/js/taskly-call-notifications.js?v=7"></script></head>')
  :finalHead;
 const mobileHead=callHead.replace('</head>', '<link rel="stylesheet" href="/css/taskly-mobile-sidebar.css?v=6"><script defer src="/js/taskly-mobile-sidebar.js?v=4"></script></head>');
 const shellBody=body.replace(/>$/, ' data-taskly-client-shell="1">');
 return '<!doctype html><html lang="fr">'+mobileHead+shellBody+
  '<div id="site-header"></div><main class="dashboard-shell">'+menuAside+
  '<section class="client-frame-container" aria-label="Rubrique client"><iframe id="taskly-client-content-frame"'+(chatEnabled&&callsPilot.autoriseCompte('client',id)?' allow="camera \'self\'; microphone \'self\'"':'')+' title="Contenu de l’espace client"></iframe></section></main></body></html>';
}
function preparerPageClientIntegree(original,id){
 original=menuChat(original);
 original=menuMail(original);
 if(!/<\/head>/i.test(original)||!/<body\b/i.test(original))throw new Error('Document client invalide.');
 return original.replace(/<\/head>/i,'<link rel="stylesheet" href="/css/client-navigation-embedded.css?v=20261012-maquette"></head>')
  .replace(/<body\b([^>]*)>/i,'<body$1 data-taskly-client-embedded="1"'+(chatEnabled?' data-taskly-chat-workspace="1"':'')+(chatEnabled&&callsPilot.autoriseCompte('client',id)?' data-taskly-chat-calls="1" data-taskly-chat-call-demande="'+callsPilot.interfaceDemande()+'"':'')+'>');
}
function monterNavigationClient(app){
 app.get('/espace/client/:page',verifierConnexion,async(req,res,next)=>{
  const {page}=req.params;
  if(page==='taskly-mail'&&!mailClientEnabled){
   return res.status(404).send('Taskly Mail indisponible.');
  }
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
