const db=require('../config/db').promise();
// Le profil et son fichier durable changent dans la même transaction.
async function changer(userId,file=null){
 let conn;
 try{
  conn=await db.getConnection();await conn.beginTransaction();
  const [rows]=await conn.query('SELECT id,photo_profil FROM users WHERE id=? FOR UPDATE',[userId]);
  if(!rows[0])throw Object.assign(Error('Utilisateur introuvable.'),{status:404});
  const newId=file?await require('./fileStorage').enregistrer(file,false,conn):null;
  const photo=newId?'/api/media/'+newId:null;
  await conn.query('UPDATE users SET photo_profil=? WHERE id=?',[photo,userId]);
  const old=/^\/api\/media\/([a-f0-9]{64})$/.exec(rows[0].photo_profil||'');
  if(old)await conn.query('DELETE FROM stored_files WHERE id=? AND prive=0',[old[1]]);
  await conn.commit();return photo;
 }catch(error){if(conn)await conn.rollback().catch(()=>{});throw error;}
 finally{conn?.release();}
}
module.exports={changer};
