'use strict';
// Vérifie la forme de la configuration, sans afficher de valeurs ni contacter les services.
function verifier(env){
 const erreurs=[];const avertissements=[];
 const present=k=>typeof env[k]==='string'&&env[k].trim().length>0;
 const requireValue=k=>{if(!present(k))erreurs.push(k+' : manquant');};
 for(const k of ['DB_HOST','DB_USER','DB_PASSWORD','DB_NAME','REDIS_URL','SESSION_SECRET','ADMIN_ENTRY_PATH','PUBLIC_SITE_URL','SMTP_HOST','SMTP_USER','SMTP_PASS','MAIL_FROM'])requireValue(k);
 if(present('SESSION_SECRET')&&Buffer.byteLength(env.SESSION_SECRET)<32)erreurs.push('SESSION_SECRET : longueur insuffisante');
 if(present('ADMIN_ENTRY_PATH')&&!/^\/[a-z0-9][a-z0-9-]{30,100}$/.test(env.ADMIN_ENTRY_PATH))erreurs.push('ADMIN_ENTRY_PATH : format invalide');
 if(env.DB_SSL!=='true')erreurs.push('DB_SSL : TLS requis pour la préproduction distante');
 if(present('REDIS_URL')){try{const u=new URL(env.REDIS_URL);if(u.protocol!=='rediss:'||!u.hostname)throw Error();}catch{erreurs.push('REDIS_URL : URL TLS invalide');}}
 if(present('PUBLIC_SITE_URL')){try{const u=new URL(env.PUBLIC_SITE_URL);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||u.hostname==='taskly-platform-sigma.vercel.app')throw Error();}catch{erreurs.push('PUBLIC_SITE_URL : URL HTTPS de préproduction requise (production interdite)');}}
 for(const k of ['DB_PORT','SMTP_PORT'])if(present(k)&&(!/^\d+$/.test(env[k])||Number(env[k])<1||Number(env[k])>65535))erreurs.push(k+' : port invalide');
 for(const k of ['TASKLY_MAIL_PILOT_ENABLED','TASKLY_MAIL_GATEWAY_ENABLED'])if(env[k]!=='false')erreurs.push(k+' : doit être explicitement false');
 if(env.VERCEL_ENV==='production')erreurs.push('VERCEL_ENV : production interdite');
 if(env.TRUST_PROXY!=='1')avertissements.push('TRUST_PROXY : vérifier le proxy de confiance Vercel avant déploiement');
 if(env.TASKLY_DISABLE_LOCAL_EXPIRY_WORKER!=='1')avertissements.push('TASKLY_DISABLE_LOCAL_EXPIRY_WORKER : recommander 1 pendant les tests isolés');
 if(present('CRON_SECRET'))avertissements.push('CRON_SECRET : vérifier que le cron de production ne cible pas la préproduction');
 return {erreurs,avertissements};
}
if(require.main===module){
 // Seul un fichier explicitement fourni via node --env-file est lu par Node.
 const {erreurs,avertissements}=verifier(process.env);
 for(const m of erreurs)console.error('ERREUR '+m);
 for(const m of avertissements)console.warn('ATTENTION '+m);
 console.log(erreurs.length?'Configuration à corriger.':'Forme de configuration compatible. Isolation réelle des services à confirmer manuellement.');
 process.exitCode=erreurs.length?1:0;
}
module.exports={verifier};
