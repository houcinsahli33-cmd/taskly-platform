'use strict';
// Explicit, opt-in database migration. Run first on a TEST database.
const fs=require('node:fs'),path=require('node:path');
require('dotenv').config({path:path.join(__dirname,'../server/.env')});
if(process.env.TASKLY_V10_MIGRATION_ACK!=='YES'){
 console.error('Migration refusée. Définir TASKLY_V10_MIGRATION_ACK=YES après sauvegarde et choix de la base de TEST.');
 process.exit(2);
}
const db=require('../server/config/db').promise();
(async()=>{
 let c;
 try{
  c=await db.getConnection();
  const [[schema]]=await c.query('SELECT DATABASE() AS database_name');
  if(!schema?.database_name)throw Error('Aucune base SQL sélectionnée.');
  const required=['taskly_professional_mailboxes','taskly_professional_mail_messages'];
  for(const table of required){const [rows]=await c.query('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?',[table]);if(Number(rows[0].n)!==1)throw Error('Table préexistante manquante : '+table);}
  const [columns]=await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='taskly_professional_mail_messages' AND column_name='is_starred'");
  if(!columns.length)throw Error('Migration des dossiers/favoris Taskly Mail requise avant V10.');
  const sql=fs.readFileSync(path.join(__dirname,'../database/migration_taskly_admin_mail_v10.sql'),'utf8').replace(/^--.*$/gm,'');
  for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean)){
   if(/^ALTER TABLE taskly_professional_mailboxes/i.test(statement)){
    const [exist]=await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='taskly_professional_mailboxes' AND column_name='suspended_at'");
    if(exist.length)continue;
   }
   await c.query(statement);
  }
  console.log('V10 : schéma vérifié et migration appliquée à la base configurée.');
 }finally{c?.release();await db.end();}
})().catch(e=>{console.error('Migration interrompue :',e.code||e.message);process.exitCode=1;});
