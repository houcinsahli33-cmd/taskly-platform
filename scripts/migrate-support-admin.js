'use strict';
// Sauvegarder la base avant execution ! Migration additive du support, rejouable.
require('dotenv').config({path:require('path').join(__dirname,'../server/.env')});
const db=require('../server/config/db');
(async()=>{
 const conn=await db.promise().getConnection();
 try{
  const [cols]=await conn.query("SELECT COLUMN_NAME,COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='contacts_support'");
  if(!cols.length)throw new Error('Table contacts_support introuvable.');
  const presents=new Map(cols.map(r=>[r.COLUMN_NAME.toLowerCase(),r.COLUMN_TYPE]));
  if(!presents.has('user_id'))await conn.query('ALTER TABLE contacts_support ADD COLUMN user_id INT NULL');
  if(!presents.has('contexte'))await conn.query("ALTER TABLE contacts_support ADD COLUMN contexte VARCHAR(40) NOT NULL DEFAULT 'public'");
  if(!presents.has('login_verified_at'))await conn.query('ALTER TABLE contacts_support ADD COLUMN login_verified_at DATETIME NULL');
  if(!presents.get('statut')?.includes('en_cours'))await conn.query("ALTER TABLE contacts_support MODIFY COLUMN statut ENUM('nouveau','en_cours','traite') NOT NULL DEFAULT 'nouveau'");
  await conn.query(`CREATE TABLE IF NOT EXISTS support_reponses (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,contact_id INT NOT NULL,admin_user_id INT NULL,
    destination VARCHAR(255) NOT NULL,sujet VARCHAR(160) NOT NULL,corps TEXT NOT NULL,
    request_key CHAR(36) NOT NULL,statut ENUM('sending','sent','failed') NOT NULL DEFAULT 'sending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,envoyee_at DATETIME NULL,
    UNIQUE KEY uq_support_dedup(contact_id,request_key),INDEX idx_support_reply(contact_id,id),
    FOREIGN KEY(contact_id) REFERENCES contacts_support(id) ON DELETE RESTRICT)`);
  await conn.query(`CREATE TABLE IF NOT EXISTS support_suivi_historique (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,contact_id INT NOT NULL,admin_user_id INT NULL,
    ancien_statut VARCHAR(24),nouveau_statut VARCHAR(24),created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_support_history(contact_id,id),
    FOREIGN KEY(contact_id) REFERENCES contacts_support(id) ON DELETE RESTRICT)`);
  console.log('Migration support admin terminee. Aucun message existant supprime.');
 }finally{conn.release();await db.promise().end();}
})().catch(e=>{console.error('Migration support echouee :',e.code||e.message);process.exitCode=1;});
