require('dotenv').config({path:require('path').join(__dirname,'../server/.env')});
const pool=require('../server/config/db');
const fs=require('fs'),path=require('path');
(async()=>{const conn=await pool.promise().getConnection();try{
 const source=fs.readFileSync(path.join(__dirname,'../database/migration_taskly_integrated.sql'),'utf8').replace(/^--.*$/gm,'');
 for(const statement of source.split(';').map(s=>s.trim()).filter(Boolean)) await conn.query(statement);
 console.log('Migration terminée. Attribuez explicitement le rôle principal au compte choisi.');
}finally{conn.release();await pool.promise().end();}})().catch(e=>{console.error('Migration interrompue :',e.code||'erreur');process.exitCode=1;});
