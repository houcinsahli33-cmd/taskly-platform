'use strict';
const crypto=require('node:crypto');
const {configured,origin}=require('../services/professionalMailNotifications');
const script=`(() => {
 const token=location.hash.slice(1);
 history.replaceState(null,'',location.pathname);
 const button=document.getElementById('open-message'),status=document.getElementById('read-status');
 if(!/^[a-f0-9]{64}$/.test(token)){button.disabled=true;status.textContent='Lien manquant ou invalide. Connectez-vous à Taskly.';return;}
 button.addEventListener('click', async()=>{
  button.disabled=true;status.textContent='Vérification du lien…';
  try{
   const r=await fetch('/api/taskly-mail/consultation',{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
   if(!r.ok){if(r.status===429||r.status>=500){button.disabled=false;throw Error('Service temporairement indisponible. Réessayez.');}throw Error('Lien invalide, expiré ou déjà utilisé. Connectez-vous à Taskly.');}
   const {message:m}=await r.json();
   for(const key of ['subject','from','to','body'])document.getElementById('read-'+key).textContent=m[key]||'';
   document.getElementById('read-date').textContent=new Date(m.date).toLocaleString('fr-FR',{timeZone:'Africa/Algiers'});
   document.getElementById('read-message').hidden=false;button.hidden=true;status.textContent='Message consulté. Pour répondre ou le relire, connectez-vous.';
  }catch(e){status.textContent=e.message||'Consultation indisponible.'; if(e instanceof TypeError)button.disabled=false;}
 });
})();`;
const scriptHash=crypto.createHash('sha256').update(script).digest('base64');
const page=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>Consultation sécurisée — Taskly Mail</title><style>
*{box-sizing:border-box}body{margin:0;background:#eef5f1;color:#193b35;font:16px/1.6 system-ui,sans-serif}header{background:#fff;border-bottom:1px solid #dce8e2;padding:16px max(24px,calc((100% - 940px)/2));display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}header img{width:120px;height:auto}header span{font-size:13px;color:#087e63}main{width:min(940px,calc(100% - 32px));margin:32px auto}section{background:white;border:1px solid #dce8e2;border-radius:18px;padding:clamp(18px,4vw,34px);box-shadow:0 6px 28px #153f3210}h1{font-size:clamp(23px,4vw,32px);line-height:1.3;margin:0 0 12px}h2{font-size:23px;overflow-wrap:anywhere}p{margin:8px 0 16px}button,a.action{display:inline-block;border:0;border-radius:10px;padding:12px 20px;background:#087e63;color:#fff;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}button:disabled{opacity:.55;cursor:default}button:focus-visible,a:focus-visible{outline:3px solid #36b69b;outline-offset:3px}article{border-top:1px solid #dce8e2;margin-top:20px;padding-top:16px;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.7;background:#f6faf8;border-radius:12px;padding:18px}small{color:#526f64}footer{margin-top:16px;color:#526f64;font-size:13px}[hidden]{display:none!important}</style></head><body><header><img src="/images/logo/taskly-logo.svg" alt="Taskly"><span>Taskly Mail · Consultation sécurisée</span></header><main><section><h1>Consulter votre message</h1><p>Ce lien temporaire donne accès à un seul message. Il ne vous connecte pas à votre compte.</p><button type="button" id="open-message">Afficher mon message</button><p id="read-status" role="status" aria-live="polite"></p><article id="read-message" hidden><h2 id="read-subject"></h2><div>De : <strong id="read-from"></strong></div><div>À : <span id="read-to"></span></div><small id="read-date"></small><pre id="read-body"></pre></article><a class="action" href="/login.html">Se connecter à Taskly</a></section><footer>Ne partagez pas votre lien. Les codes de sécurité ne sont jamais consultables sur cette page.</footer></main><script>${script}</script></body></html>`;
function headers(res){res.set({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':`default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`});}
function mount(app,{redeem,retry,limiter,env=process.env}){
 if(!configured(env)||typeof redeem!=='function'||typeof retry!=='function')return;
 app.get('/taskly-mail/consulter',(req,res)=>{headers(res);res.type('html').send(page);});
 // Capability-only endpoint: does not accept or issue an authenticated session.
 app.post('/api/taskly-mail/consultation',limiter({max:25}),async(req,res)=>{
  headers(res);
  if(req.get('Origin')!==origin(env)||!req.is('application/json'))return res.status(403).json({message:'Accès refusé.'});
  try{res.json({message:await redeem(req.body?.token)});}catch(e){const code=e.status===404?404:503;res.status(code).json({message:code===404?'Lien invalide, expiré ou déjà utilisé.':'Service indisponible.'});}
 });
 app.get('/api/internal/taskly-mail-notifications',async(req,res)=>{
  headers(res);const secret=env.CRON_SECRET,provided=req.get('Authorization')||'';
  if(!secret||Buffer.byteLength(secret)<32||Buffer.byteLength(provided)!==Buffer.byteLength('Bearer '+secret)||!crypto.timingSafeEqual(Buffer.from(provided),Buffer.from('Bearer '+secret)))return res.status(404).end();
  try{res.json({notifications:await retry()});}catch(e){res.status(503).json({message:'Service indisponible.'});}
 });
}
module.exports={mount,page};
