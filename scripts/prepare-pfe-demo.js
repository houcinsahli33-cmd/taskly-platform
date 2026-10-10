require('dotenv').config({path:require('path').join(__dirname,'../server/.env')});
const pool=require('../server/config/db');
const {candidat}=require('./pfe-cleanup-rules');
(async()=>{let conn;try{conn=await pool.promise().getConnection();
 if(process.argv.includes('--prepare')){
  await conn.query('CREATE TABLE IF NOT EXISTS pfe_demo_snapshot (user_id INT PRIMARY KEY, action VARCHAR(20) NOT NULL, email VARCHAR(255) NOT NULL)');
  await conn.query('CREATE TABLE IF NOT EXISTS pfe_demo_state (id INT PRIMARY KEY, prepared_at DATETIME NOT NULL, applied_at DATETIME NULL)');
  await conn.beginTransaction();
  const [state]=await conn.query('SELECT id FROM pfe_demo_state WHERE id=1 FOR UPDATE');
  if(!state.length){
   const [users]=await conn.query("SELECT id,email,role,statut_compte FROM users WHERE role IN ('client','artisan') FOR UPDATE");
   for(const u of users){const action=candidat(u)?'supprimer':u.role==='artisan'&&u.statut_compte==='actif'?'conserver':null;if(action)await conn.query('INSERT INTO pfe_demo_snapshot(user_id,action,email) VALUES (?,?,?)',[u.id,action,u.email]);}
   await conn.query('INSERT INTO pfe_demo_state(id,prepared_at) VALUES (1,NOW())');
  }
  await conn.commit();
 }
 const [tables]=await conn.query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='pfe_demo_snapshot'");
 if(!tables.length){
  const [users]=await conn.query("SELECT id,email,role,statut_compte FROM users WHERE role IN ('client','artisan')");
  console.table(users.filter(u=>candidat(u)||u.role==='artisan'&&u.statut_compte==='actif').map(u=>({user_id:u.id,email:u.email,action:candidat(u)?'supprimer':'conserver'})));
  if(process.argv.includes('--apply')||process.argv.includes('--restore'))throw Error('Préparez un instantané avec --prepare après sauvegarde. Aucun changement.');
  console.log('Aperçu lecture seule. Après sauvegarde, préparer avec --prepare puis vérifier avant --apply.');return;
 }
 const [snapshot]=await conn.query('SELECT * FROM pfe_demo_snapshot ORDER BY action,user_id');console.table(snapshot);
 if(!process.argv.includes('--apply')&&!process.argv.includes('--restore')){console.log('Aperçu seulement. Après sauvegarde et contrôle des e-mails, relancer avec --apply.');return;}
 await conn.beginTransaction();const [state]=await conn.query('SELECT * FROM pfe_demo_state WHERE id=1 FOR UPDATE');
 if(!state[0]||(state[0].applied_at&&!process.argv.includes('--restore'))||(!state[0].applied_at&&process.argv.includes('--restore')))throw Error('Instantané absent ou déjà appliqué. Aucun changement.');
 for(const u of snapshot){
  if(process.argv.includes('--restore')&&u.action!=='conserver')continue;
  const [current]=await conn.query('SELECT id,email,role,statut_compte FROM users WHERE id=? FOR UPDATE',[u.user_id]);
  const user=current[0];if(!user||user.role==='admin'||user.email!==u.email)continue;
  if(u.action==='supprimer')await require('../server/services/accountDeletion').supprimer(conn,user.id,null,{operateur:true});
  else if(user.role==='artisan'&&user.statut_compte==='actif'){
   await conn.query('UPDATE users SET email_verified=1 WHERE id=?',[user.id]);
   await conn.query("UPDATE artisans SET verification_statut='approuve',verification_commentaire='Compte de démonstration PFE conservé à partir de l’instantané.' WHERE user_id=?",[user.id]);
  }
 }
 if(!process.argv.includes('--restore'))await conn.query('UPDATE pfe_demo_state SET applied_at=NOW() WHERE id=1');await conn.commit();console.log('Instantané appliqué. Les comptes administrateurs et les inscriptions ultérieures sont exclus.');
 }catch(e){if(conn)await conn.rollback().catch(()=>{});throw e;}finally{conn?.release();await pool.promise().end();}})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
