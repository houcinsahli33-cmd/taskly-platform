'use strict';
const path=require('node:path');
const fs=require('node:fs/promises');
const {verifierConnexion}=require('../middleware/authMiddleware');
const pages=new Set(['accueil','demandes','avis','profil','support']);
if(process.env.TASKLY_MAIL_PILOT_ENABLED==='true')pages.add('taskly-mail');
const callsPilot=require('../services/chatCallPilot');
const chatEnabled=process.env.TASKLY_CHAT_WORKSPACE_ENABLED==='true';
if(chatEnabled)pages.add('messagerie');
function menuChat(original){
 if(!chatEnabled)return original;
 const link='<a href="/espace/artisan/messagerie" data-dashboard-link="messagerie"><svg class="chat-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11a8 8 0 0 1-8 8H4l2-5a8 8 0 1 1 15-3Z"/><path d="M8 11h8"/></svg><span>Messagerie privée</span><span class="chat-nav-count" data-chat-unread hidden></span></a>';
 return original.replace(/<a href="\/espace\/artisan\/profil"/,link+'<a href="/espace/artisan/profil"');
}
const dossier=path.join(__dirname,'../../client/private/artisan');
const {modeGeneral}=require('../services/professionalMailAccess');

function mailAutorise(id){
 if(modeGeneral(process.env))return true;
 if(process.env.TASKLY_MAIL_PILOT_ENABLED!=='true')return false;
 if(process.env.TASKLY_MAIL_INTERNAL_ENABLED!=='true')return true;
 return String(process.env.TASKLY_MAIL_PILOT_USER_IDS||'')
  .split(',')
  .map(v=>v.trim())
  .filter(v=>/^[1-9][0-9]*$/.test(v))
  .includes(String(id));
}

function menuMail(original,id) {
 if(!mailAutorise(id))return original;
 return original.replace(/<a href="\/espace\/artisan\/support"/, '<a href="/espace/artisan/taskly-mail" data-dashboard-link="taskly-mail"><svg class="artisan-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg>Taskly Mail</a><a href="/espace/artisan/support"').replace('Taskly Mail — prochainement.', '<a href="/espace/artisan/taskly-mail">Taskly Mail — demande d’adresse</a>');
}
function preparerCadreArtisan(original,id) {
 original=menuChat(original);
 original=menuMail(original,id);
 const head=original.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0];
 const body=original.match(/<body\b[^>]*>/i)?.[0];
 const aside=original.match(/<aside\b[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/aside>/i)?.[0];
 if(!head||!body||!aside)throw new Error('Document artisan non reconnu.');
 const maison='<svg class="chat-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/></svg>';

 const grille='<svg class="chat-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';

 const menuAside=chatEnabled?aside
  .replace(/(<p\b[^>]*class="[^"]*\bsidebar-title\b[^"]*"[^>]*>)\s*Espace artisan/i,'$1'+maison+'<span>Espace artisan</span>')
  .replace(/(<a\b[^>]*data-dashboard-link="accueil"[^>]*>)\s*(?:<svg\b[^>]*>[\s\S]*?<\/svg>\s*)?/i,'$1'+grille)
  :aside;

 const shellHead=head.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<head\b[^>]*>/i,match=>match+'<style>@media(max-width:800px){body[data-taskly-client-shell="1"] .dashboard-shell>.sidebar,body[data-taskly-artisan-shell="1"] .dashboard-shell>.sidebar{visibility:hidden!important}body.taskly-mobile-ready[data-taskly-client-shell="1"] .dashboard-shell>.sidebar,body.taskly-mobile-ready[data-taskly-artisan-shell="1"] .dashboard-shell>.sidebar{visibility:visible!important}}</style>').replace(/<\/head>/i,
  '<link rel="stylesheet" href="/css/artisan-navigation-shell.css?v=20261119-audit1"><script defer src="/js/api.js"></script><script defer src="/js/auth.js"></script><script defer src="/js/artisan-navigation-stable.js?v=chat-calls1"></script></head>');
 const finalHead=chatEnabled?shellHead.replace('</head>','<link rel="stylesheet" href="/css/taskly-chat-workspace.css?v=5"><script defer src="/js/taskly-chat-notifications.js?v=2"></script></head>'):shellHead;
 const callHead=chatEnabled&&callsPilot.autoriseCompte('artisan',id)
  ?finalHead.replace('</head>','<link rel="stylesheet" href="/css/taskly-call.css?v=2"><script defer src="/js/taskly-call-notifications.js?v=6"></script></head>')
  :finalHead;
 const mobileHead=callHead.replace('</head>', '<link rel="stylesheet" href="/css/taskly-mobile-sidebar.css?v=4"><script defer src="/js/taskly-mobile-sidebar.js?v=4"></script></head>');
 const shellBody=body.replace(/>$/, ' data-taskly-artisan-shell="1">');
 return '<!doctype html><html lang="fr">'+mobileHead+shellBody+
  '<div id="site-header"></div><main class="dashboard-shell">'+menuAside+
  '<section class="artisan-frame-container" aria-label="Rubrique artisan"><iframe id="taskly-artisan-content-frame"'+(chatEnabled&&callsPilot.autoriseCompte('artisan',id)?' allow="camera \'self\'; microphone \'self\'"':'')+' title="Contenu de l’espace artisan"></iframe></section></main></body></html>';
}
function preparerPageArtisanIntegree(original,id){
 original=menuChat(original);
 original=menuMail(original,id);
 if(!/<\/head>/i.test(original)||!/<body\b/i.test(original))throw new Error('Document artisan invalide.');
 return original.replace(/<\/head>/i,'<link rel="stylesheet" href="/css/artisan-navigation-embedded.css?v=20261012-navigation-11"></head>')
  .replace(/<body\b([^>]*)>/i,'<body$1 data-taskly-artisan-embedded="1"'+(chatEnabled?' data-taskly-chat-workspace="1"':'')+(chatEnabled&&callsPilot.autoriseCompte('artisan',id)?' data-taskly-chat-calls="1" data-taskly-chat-call-demande="'+callsPilot.interfaceDemande()+'"':'')+'>');
}
function monterNavigationArtisan(app){
 app.get('/espace/artisan/:page',verifierConnexion,async(req,res,next)=>{
  const {page}=req.params;
  if(!pages.has(page))return next();
  if(req.session.utilisateur.role!=='artisan')return res.status(403).json({message:'Accès refusé.'});
  if(page==='taskly-mail'&&!mailAutorise(req.session.utilisateur.id)){
   return res.status(403).send('Taskly Mail : test prive.');
  }
  try {
   const original=await fs.readFile(path.join(dossier,page+'.html'),'utf8');
   res.set('Cache-Control','no-store, private');
   if(req.query.taskly_artisan_embed==='1'||req.get('Sec-Fetch-Dest')==='iframe'){
    res.set('X-Frame-Options','SAMEORIGIN');res.set('Content-Security-Policy',"frame-ancestors 'self'");
    return res.type('html').send(preparerPageArtisanIntegree(original,req.session.utilisateur.id));
   }
   return res.type('html').send(preparerCadreArtisan(original,req.session.utilisateur.id));
  }catch(error){return res.status(503).send('Espace artisan temporairement indisponible.');}
 });
}
module.exports=monterNavigationArtisan;
module.exports.preparerCadreArtisan=preparerCadreArtisan;
module.exports.preparerPageArtisanIntegree=preparerPageArtisanIntegree;
