require('dotenv').config({path:require('path').join(__dirname,'../server/.env')});
const pool=require('../server/config/db');
const fs=require('fs'),path=require('path');
(async()=>{let conn;try{
 conn=await pool.promise().getConnection();
 const fichier=process.argv[2]||'migration_taskly_integrated.sql';
 if(!['migration_taskly_integrated.sql','migration_comptes_support.sql','migration_parametres_site.sql','migration_multi_espaces.sql','migration_notifications_taskly.sql','migration_confirmation_prestation.sql'].includes(fichier))throw Error('Migration inconnue.');
 if(fichier==='migration_multi_espaces.sql'){
  const [[schema]]=await conn.query('SHOW CREATE TABLE users');
  const dossier=path.join(__dirname,'../.taskly-private/migrations');fs.mkdirSync(dossier,{recursive:true});
  const sauvegarde=path.join(dossier,'schema-users-before-multi-'+Date.now()+'.sql');
  fs.writeFileSync(sauvegarde,schema['Create Table']+';\n',{flag:'wx'});
  console.log('Schéma users sauvegardé avant migration : '+sauvegarde);
 }
 const source=fs.readFileSync(path.join(__dirname,'../database',fichier),'utf8').replace(/^--.*$/gm,'');
 for(const statement of source.split(';').map(s=>s.trim()).filter(Boolean)) await conn.query(statement);
 console.log('Migration terminée : '+fichier+'. Les comptes et rôles administrateurs existants sont conservés.');
}finally{conn?.release();await pool.promise().end();}})().catch(e=>{console.error('Migration interrompue :',e.code||'erreur');process.exitCode=1;});
