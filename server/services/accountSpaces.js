'use strict';
const bcrypt=require('bcrypt');
function erreur(message,status=409){const e=Error(message);e.status=status;return e;}
function choisirSlot(comptes,role,serviceId){
 if(comptes.some(c=>c.role==='admin'))throw erreur('Cette adresse est réservée à un compte administrateur.');
 if(role==='client'){
  if(comptes.some(c=>c.role==='client'))throw erreur('Cette adresse possède déjà un compte client.');
  return 0;
 }
 const artisans=comptes.filter(c=>c.role==='artisan');
 if(artisans.some(c=>Number(c.service_id)===Number(serviceId)))throw erreur('Vous possédez déjà un compte artisan pour ce métier.');
 if(artisans.length>=2)throw erreur('Une adresse e-mail peut posséder au maximum deux comptes artisan de métiers différents.');
 return artisans.some(c=>Number(c.compte_slot)===1)?2:1;
}
async function verrouiller(conn,email){
 const [rows]=await conn.query('SELECT u.*,a.service_id FROM users u LEFT JOIN artisans a ON a.user_id=u.id WHERE u.email=? ORDER BY u.id FOR UPDATE',[email]);
 return rows;
}
async function preparerInscription(conn,email,role,serviceId,motDePasse){
 const comptes=await verrouiller(conn,email);
 const [schema]=await conn.query("SELECT COUNT(*) AS present FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name='compte_slot'");
 const multiEspaces=Number(schema[0]?.present)===1;
 if(!multiEspaces && comptes.length)throw erreur('L’ajout d’un espace nécessite l’activation du multi-compte dans la base de données.',503);
 const slot=choisirSlot(comptes,role,serviceId);
 if(comptes.length && !await bcrypt.compare(motDePasse,comptes[0].mot_de_passe))throw erreur('Pour ajouter un espace, utilisez le mot de passe actuel de cette adresse e-mail.',403);
 return {slot,multiEspaces,hash:comptes.length?comptes[0].mot_de_passe:await bcrypt.hash(motDePasse,12)};
}
function choixValide(pending,user){
 return !!pending && pending.expiresAt>Date.now() && user && user.email===pending.email && user.role!=='admin' && !!user.email_verified && pending.comptes.some(c=>Number(c.id)===Number(user.id)&&Number(c.version)===Number(user.admin_session_version||0));
}
module.exports={choisirSlot,preparerInscription,verrouiller,choixValide,erreur};
