'use strict';
const crypto = require('node:crypto');
const ACTIVITE_MS = 4*60*60*1000;
const taches = new Map();
const marque = identifiant => crypto.createHash('sha256').update(String(identifiant)).digest('hex');
const dateSQL = time => new Date(time).toISOString().slice(0,19).replace('T',' ');
function lien(admin) {
 const url=require('./tasklyMail').base();
 return url ? url+(admin?String(process.env.ADMIN_ENTRY_PATH||''):'/login.html?session=expiree') : '';
}
async function enregistrerActivite(identifiant, utilisateur, derniere, admin=false, force=false) {
 if(!identifiant||!utilisateur?.id||!utilisateur?.email||!Number.isFinite(Number(derniere)))return;
 const cle=marque(identifiant),now=Date.now();
 if(!force && taches.get(cle)>now-120000) return;
 taches.set(cle,now);
 if(taches.size>20000)for(const [k,t] of taches)if(t<now-900000)taches.delete(k);
 try {
  const db=require('../config/db').promise();
  await db.query(`INSERT INTO taskly_session_activity (session_hash,user_id,email,role,expires_at)
    VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE
    expires_at=IF(notified_at IS NULL,VALUES(expires_at),expires_at)`,
    [cle,utilisateur.id,utilisateur.email,admin?'admin':utilisateur.role,dateSQL(Number(derniere)+ACTIVITE_MS)]);
 } catch(e){taches.delete(cle);throw e;}
}
async function oublier(identifiant) {
 if(!identifiant)return;
 const cle=marque(identifiant);taches.delete(cle);
 await require('../config/db').promise().query('DELETE FROM taskly_session_activity WHERE session_hash=?',[cle]);
}
async function traiterEcheances(limit=75) {
 const db=require('../config/db').promise(),mail=require('./tasklyMail');
 const [rows]=await db.query('SELECT session_hash,user_id,email,role FROM taskly_session_activity WHERE expires_at<=NOW() AND notified_at IS NULL ORDER BY expires_at LIMIT ?', [limit]);
 let nombre=0;
 for(const row of rows){
   try {
    await mail.mettreEnFile({userId:row.user_id,to:row.email,
     subject:'Votre session Taskly a expiré',
     message:'Votre session a été fermée après 4 heures consécutives sans activité. Si cette activité vous paraît inhabituelle, sécurisez votre compte.',
     link:lien(row.role==='admin'),button:'Se reconnecter',key:'session:'+row.session_hash+':expiration'});
    await db.query('UPDATE taskly_session_activity SET notified_at=NOW() WHERE session_hash=? AND notified_at IS NULL',[row.session_hash]);
    nombre++;
   }catch(e){console.error('Notification session expirée :',e.code||e.message);}
 }
 // Relancer également les e-mails déjà présents en file, sans doublon de session.
 for(let i=0;i<5;i++) {
   let sent=0;
   try {sent=await mail.traiterLot();} catch(e){console.error('Envoi session expirée :',e.code||e.message);break;}
   if(sent<10)break;
 }
 return nombre;
}
async function notifierFin(identifiant,utilisateur,admin=false){
 // Si la session n'avait pas encore été suivie, enregistrer son échéance passée.
 await enregistrerActivite(identifiant,utilisateur,Date.now()-ACTIVITE_MS-1000,admin,true);
 return traiterEcheances();
}
function demarrerSurServeur(){
 if(process.env.VERCEL || process.env.TASKLY_DISABLE_LOCAL_EXPIRY_WORKER==='1')return;
 const run=()=>traiterEcheances().catch(e=>console.error('Surveillance sessions :',e.code||e.message));
 const timer=setInterval(run,10*60*1000);timer.unref?.();run();
}
module.exports={enregistrerActivite,oublier,traiterEcheances,notifierFin,demarrerSurServeur,ACTIVITE_MS};
