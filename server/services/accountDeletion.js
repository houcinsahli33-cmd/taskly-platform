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
 const [deleted]=await conn.query("DELETE FROM users WHERE id=? AND role IN ('client','artisan')",[userId]);
 if(!deleted.affectedRows)throw Error('Suppression non effectuée.');
 for(const d of docs)await conn.query('DELETE FROM stored_files WHERE id=? AND prive=1',[d.stored_name]);
 const photo=/^\/api\/media\/([a-f0-9]{64})$/.exec(user.photo_profil||'');
 if(photo)await conn.query('DELETE FROM stored_files WHERE id=? AND prive=0',[photo[1]]);
}
module.exports={supprimer};
