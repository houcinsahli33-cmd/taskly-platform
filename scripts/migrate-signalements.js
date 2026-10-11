'use strict';
// Migration additive et rejouable ; aucun signalement existant n'est supprimé.
require('dotenv').config({path:require('path').join(__dirname,'../server/.env')});
const db=require('../server/config/db');
(async()=>{
 const conn=await db.promise().getConnection();
 try{
  const [cols]=await conn.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='signalements'`);
  if(!cols.length)throw new Error('La table signalements est absente ; initialisez la base avant cette migration.');
  const existantes=new Set(cols.map(r=>r.COLUMN_NAME.toLowerCase()));
  if(!existantes.has('statut')){
   // Tous les anciens dossiers deviennent « non traités », sans supposer une décision déjà prise.
   await conn.query("ALTER TABLE signalements ADD COLUMN statut ENUM('nouveau','non_traite','en_cours','traite') NOT NULL DEFAULT 'non_traite'");
   await conn.query("ALTER TABLE signalements MODIFY COLUMN statut ENUM('nouveau','non_traite','en_cours','traite') NOT NULL DEFAULT 'nouveau'");
  }
  if(!existantes.has('priorite'))await conn.query("ALTER TABLE signalements ADD COLUMN priorite ENUM('basse','moyenne','haute') NOT NULL DEFAULT 'moyenne'");
  if(!existantes.has('date_traitement'))await conn.query('ALTER TABLE signalements ADD COLUMN date_traitement DATETIME NULL');
  if(!existantes.has('traite_par_user_id'))await conn.query('ALTER TABLE signalements ADD COLUMN traite_par_user_id INT NULL');
  await conn.query(`CREATE TABLE IF NOT EXISTS signalement_suivi_historique (
   id INT AUTO_INCREMENT PRIMARY KEY, signalement_id INT NOT NULL, admin_user_id INT NULL,
   ancien_statut VARCHAR(24),nouveau_statut VARCHAR(24),
   ancienne_priorite VARCHAR(24),nouvelle_priorite VARCHAR(24),
   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
   INDEX idx_signalement_historique(signalement_id,id),
   FOREIGN KEY (signalement_id) REFERENCES signalements(id) ON DELETE CASCADE
  )`);
  await conn.query(`CREATE TABLE IF NOT EXISTS signalement_suivi_notifications (
   id INT AUTO_INCREMENT PRIMARY KEY,signalement_id INT NOT NULL,admin_user_id INT NULL,
   destination VARCHAR(255) NOT NULL,sujet VARCHAR(160) NOT NULL,corps TEXT NOT NULL,
   statut ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,envoyee_at DATETIME NULL,
   INDEX idx_signalement_notifications(signalement_id,id),
   FOREIGN KEY (signalement_id) REFERENCES signalements(id) ON DELETE CASCADE
  )`);
  console.log('Migration du suivi des signalements terminée. Aucun dossier supprimé.');
 }finally{conn.release();await db.promise().end();}
})().catch(err=>{console.error('Migration signalements échouée :',err.code||err.message);process.exitCode=1;});
