require('dotenv').config({path:require('path').join(__dirname,'../server/.env')});
const pool=require('../server/config/db');
const fs=require('fs'),path=require('path');
(async()=>{const conn=await pool.promise().getConnection();try{
 const fichier=process.argv[2]||'migration_taskly_integrated.sql';
 if(!['migration_taskly_integrated.sql','migration_comptes_support.sql'].includes(fichier))throw Error('Migration inconnue.');
 const source=fs.readFileSync(path.join(__dirname,'../database',fichier),'utf8').replace(/^--.*$/gm,'');
 for(const statement of source.split(';').map(s=>s.trim()).filter(Boolean)) await conn.query(statement);
 console.log('Migration terminée. Attribuez explicitement le rôle principal au compte choisi.');
}finally{conn.release();await pool.promise().end();}})().catch(e=>{console.error('Migration interrompue :',e.code||'erreur');process.exitCode=1;});
