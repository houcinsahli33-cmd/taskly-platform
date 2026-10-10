const bcrypt=require('bcrypt');
async function supprimer(conn,userId,motDePasse,{operateur=false}={}) {
 const [users]=await conn.query('SELECT id,role,mot_de_passe,photo_profil FROM users WHERE id=? FOR UPDATE',[userId]);
 const user=users[0];
 if(!user || !['client','artisan'].includes(user.role)){const e=Error('Compte client ou artisan introuvable. Les administrateurs sont exclus.');e.status=403;throw e;}
 if(!operateur && (typeof motDePasse!=='string' || !await bcrypt.compare(motDePasse,user.mot_de_passe))){const e=Error('Mot de passe actuel incorrect.');e.status=403;throw e;}
 const [docs]=await conn.query('SELECT d.stored_name FROM artisan_documents d JOIN artisans a ON a.id=d.artisan_id WHERE a.user_id=?',[userId]);
 await conn.query('DELETE v FROM verification_audit v JOIN artisans a ON a.id=v.artisan_id WHERE a.user_id=?',[userId]);
 await conn.query('DELETE FROM contacts_support WHERE user_id=?',[userId]);
 await conn.query('DELETE FROM account_notifications WHERE user_id=?',[userId]);
 // Supprimer les dépendances explicitement : les anciennes bases TiDB peuvent
 // ne pas disposer des cascades du schéma actuel. Tout reste transactionnel.
 await conn.query(`DELETE FROM signalements WHERE signaleur_user_id=? OR signale_user_id=?
  OR demande_id IN (SELECT d.id FROM demandes d LEFT JOIN clients c ON c.id=d.client_id
   LEFT JOIN artisans a ON a.id=d.artisan_id WHERE c.user_id=? OR a.user_id=?)`,[userId,userId,userId,userId]);
 await conn.query(`DELETE FROM avis WHERE client_id IN (SELECT id FROM clients WHERE user_id=?)
  OR artisan_id IN (SELECT id FROM artisans WHERE user_id=?)
  OR demande_id IN (SELECT d.id FROM demandes d LEFT JOIN clients c ON c.id=d.client_id
   LEFT JOIN artisans a ON a.id=d.artisan_id WHERE c.user_id=? OR a.user_id=?)`,[userId,userId,userId,userId]);
 await conn.query(`DELETE FROM demandes WHERE client_id IN (SELECT id FROM clients WHERE user_id=?)
  OR artisan_id IN (SELECT id FROM artisans WHERE user_id=?)`,[userId,userId]);
 await conn.query('DELETE FROM artisan_documents WHERE artisan_id IN (SELECT id FROM artisans WHERE user_id=?)',[userId]);
 await conn.query('DELETE FROM verification_codes WHERE user_id=?',[userId]);
 await conn.query('DELETE FROM account_email_changes WHERE user_id=?',[userId]);
 await conn.query('DELETE FROM clients WHERE user_id=?',[userId]);
 await conn.query('DELETE FROM artisans WHERE user_id=?',[userId]);
 const [deleted]=await conn.query("DELETE FROM users WHERE id=? AND role IN ('client','artisan')",[userId]);
 if(!deleted.affectedRows)throw Error('Suppression non effectuée.');
 for(const d of docs)await conn.query('DELETE FROM stored_files WHERE id=? AND prive=1',[d.stored_name]);
 const photo=/^\/api\/media\/([a-f0-9]{64})$/.exec(user.photo_profil||'');
 if(photo)await conn.query('DELETE FROM stored_files WHERE id=? AND prive=0',[photo[1]]);
}
module.exports={supprimer};
