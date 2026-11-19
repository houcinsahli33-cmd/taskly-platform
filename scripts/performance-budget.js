'use strict';
// Uniquement préproduction isolée autorisée. Ne jamais utiliser les cookies de production.
const {performance} = require('node:perf_hooks');
const {setTimeout:pause} = require('node:timers/promises');
const fs = require('node:fs');
const ROUTES = Object.freeze([
  {nom:'csrf',path:'/api/auth/csrf',method:'GET',status:200,budget:200},
  {nom:'authentification',path:'/api/auth/me',method:'GET',status:200,budget:300},
  {nom:'artisan',path:'/api/demandes/artisan',method:'GET',status:200,budget:400},
  {nom:'parametres',path:'/api/site-settings',method:'GET',status:200,budget:200},
  {nom:'activite',path:'/api/auth/activity',method:'POST',status:204,budget:300}
]);
function cible(env) {
  const base=String(env.TARGET_URL||'').replace(/\/$/,'');
  const local=/^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(base);
  const preview=/^https:\/\/([a-z0-9][a-z0-9.-]*\.vercel\.app)$/.exec(base);
  if(env.TASKLY_PERF_TEST!=='ISOLATED_PREVIEW_ONLY'||(!local&&(!preview||preview[1]!==env.PREVIEW_HOST||preview[1]==='taskly-platform-sigma.vercel.app')))
    throw Error('Cible refusée : localhost ou hôte Preview Vercel explicitement autorisé, avec base et Redis de test.');
  return base;
}
function entier(v,min,max,defaut) {
  const n=Number(v??defaut); if(!Number.isInteger(n)||n<min||n>max)throw Error('Paramètre de charge hors limites.');return n;
}
function sessionsValides(liste) {
  if(!Array.isArray(liste)||liste.length<1||liste.length>25||new Set(liste).size!==liste.length||liste.some(c=>typeof c!=='string'||!/^artisans\.sid=[A-Za-z0-9._%+\/=~-]{1,512}$/.test(c)))
    throw Error('Fournir 1 à 25 cookies Artisan distincts de préproduction, sans autre en-tête.');
  return liste;
}
function percentile(valeurs,p) {
  if(!valeurs.length)return null;
  const tri=[...valeurs].sort((a,b)=>a-b);return tri[Math.max(0,Math.ceil(p*tri.length)-1)];
}
function bilan(route, mesures) {
  const ok=mesures.filter(m=>m.ok).map(m=>m.ms), erreurs=mesures.length-ok.length;
  const p95=percentile(ok,.95);
  return {route:route.nom,budget_ms:route.budget,n:mesures.length,erreurs,p50_ms:percentile(ok,.5),p95_ms:p95,p99_ms:percentile(ok,.99),respecte:mesures.length>=20&&erreurs===0&&p95!==null&&p95<=route.budget};
}
async function parcours({base,cookie,fetcher=fetch,horloge=()=>performance.now()}) {
  let csrf=null;const resultats=[];
  for(const route of ROUTES){
    const debut=horloge();let ok=false;let status=0;
    try {
      if(route.method==='POST'&&!csrf)throw Error('CSRF absent');
      const headers={Cookie:cookie,Accept:'application/json'};
      if(route.method==='POST')headers['X-CSRF-Token']=csrf;
      const reponse=await fetcher(base+route.path,{method:route.method,headers,redirect:'manual',signal:AbortSignal.timeout(10000)});
      status=reponse.status;
      // Consommer la réponse entière, pas seulement les en-têtes.
      const texte=await reponse.text();
      if(status===route.status){
        if(route.nom==='activite')ok=texte.length===0;
        else {
          const data=JSON.parse(texte);
          if(route.nom==='csrf'){csrf=/^[a-f0-9]{64}$/.test(data.csrfToken||'')?data.csrfToken:null;ok=!!csrf;}
          else if(route.nom==='authentification')ok=data.utilisateur?.role==='artisan';
          else if(route.nom==='artisan')ok=Array.isArray(data.demandes);
          else ok=typeof data.parametres?.email==='string';
        }
      }
    }catch{} // Ne jamais imprimer de réponse, cookie ou exception réseau brute.
    resultats.push({nom:route.nom,ok,status,ms:Math.max(0,horloge()-debut)});
    // En cas d'authentification incorrecte, ne pas envoyer d'activité à la mauvaise session.
    if(route.nom==='authentification'&&!ok)csrf=null;
  }
  return resultats;
}
async function main(env=process.env){
  const base=cible(env), tours=entier(env.TASKLY_PERF_ROUNDS,20,60,20);
  if(!env.TASKLY_PERF_SESSIONS_FILE)throw Error('Fichier local de sessions de test requis (voir docs).');
  let cookies;try{cookies=sessionsValides(JSON.parse(fs.readFileSync(env.TASKLY_PERF_SESSIONS_FILE,'utf8')));}catch{throw Error('Fichier privé de sessions invalide ou inaccessible.');}
  const mesures=[];
  await Promise.all(cookies.map(async cookie=>{
    const warm=await parcours({base,cookie});
    if(warm.some(r=>!r.ok))throw Error('Préchauffage refusé : session, API ou données de test invalides.');
  }));
  await Promise.all(cookies.map(async(cookie,i)=>{
    await pause(i*100);
    for(let n=0;n<tours;n++){
      mesures.push(...await parcours({base,cookie}));
      if(n<tours-1)await pause(1000);
    }
  }));
  const rapport=ROUTES.map(route=>bilan(route,mesures.filter(m=>m.nom===route.nom)));
  console.table(rapport);console.log(`Sessions : ${cookies.length}; tours : ${tours}; échauffement exclu. Résultats bruts en ms, sans données privées.`);
  if(rapport.some(r=>!r.respecte))process.exitCode=1;
}
if(require.main===module)main().catch(()=>{console.error('Test arrêté : configuration de préproduction ou préchauffage invalide. Voir docs/PERFORMANCE_BUDGET.md.');process.exitCode=1;});
module.exports={ROUTES,cible,sessionsValides,percentile,bilan,parcours};
