'use strict';
// Audit lecture seule, sans afficher les identifiants, mots de passe ou contenus.
require('dotenv').config({path:require('path').join(__dirname,'../server/.env')});
const pool=require('../server/config/db').promise();
const attendus={
  users:['id','nom','prenom','email','mot_de_passe','photo_profil','role','statut_compte','motif_blocage','date_blocage','email_verified','admin_session_version'],
  clients:['id','user_id','telephone','ville','adresse'],
  artisans:['id','user_id','service_id','telephone','ville','description','experience','created_at','verification_statut','verification_commentaire'],
  services:['id','nom','description','image'],
  demandes:['id','client_id','artisan_id','statut'],
  avis:['id','demande_id','client_id','artisan_id'],
  signalements:['id','demande_id','signaleur_user_id','signale_user_id'],
  artisan_documents:['id','artisan_id','type_document','stored_name','original_name'],
  verification_audit:['id','artisan_id','admin_user_id','ancien_statut','nouveau_statut','commentaire'],
  contacts_support:['id','user_id','contexte','login_verified_at','message','statut'],
  account_notifications:['id','user_id','statut','destinataire','sujet','corps','attempts','attempted_at','sent_at','created_at'],
  stored_files:['id','media_type','prive','contenu'],
  admin_roles:['user_id','niveau'],
  account_email_changes:['user_id','nouveau_email','code_hash','expires_at','attempts'],
  admin_invitations:['id','email','token_hash','created_by','expires_at','accepted_at','revoked_at'],
  admin_email_changes:['user_id','nouveau_email','code_hash','expires_at','attempts'],
  admin_audit_logs:['id','admin_user_id','action','cible_id','detail'],
  verification_codes:['user_id','purpose','code_hash','expires_at','attempts','issued_at']
};
(async()=>{
 try {
   const [rows]=await pool.query('SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()');
   const present=new Map();
   for(const row of rows){const nom=row.TABLE_NAME;if(!present.has(nom))present.set(nom,new Set());present.get(nom).add(row.COLUMN_NAME);}
   let erreurs=0;
   for(const [table,colonnes] of Object.entries(attendus)){
     if(!present.has(table)) {console.log(`MANQUANTE : table ${table}`);erreurs++;continue;}
     for(const col of colonnes) if(!present.get(table).has(col)){console.log(`MANQUANTE : ${table}.${col}`);erreurs++;}
   }
   if(erreurs){console.log(`Diagnostic : ${erreurs} élément(s) de schéma manquant(s). Faire une sauvegarde et lire DEPLOIEMENT.md avant toute migration.`);process.exitCode=1;}
   else console.log('Diagnostic lecture seule : colonnes principales présentes. Vérifier ensuite les droits et les scénarios réels dans le navigateur.');
 }catch(error){console.error('Diagnostic MySQL impossible :', error.code || 'erreur de connexion');process.exitCode=1;}
 finally {await pool.end();}
})();
