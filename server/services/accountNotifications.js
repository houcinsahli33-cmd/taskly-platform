const db=require('../config/db').promise();
async function envoyer(id) {
 const [claim]=await db.query("UPDATE account_notifications SET statut='sending',attempts=attempts+1,attempted_at=NOW() WHERE id=? AND (statut IN ('pending','failed') OR (statut='sending' AND attempted_at<DATE_SUB(NOW(),INTERVAL 5 MINUTE)))",[id]);
 if(!claim.affectedRows)return false;
 const [rows]=await db.query('SELECT * FROM account_notifications WHERE id=?',[id]);
 if(!rows[0])return false;
 try {
  await require('./adminMailService').envoyerCourrielAdmin(rows[0].destinataire,rows[0].sujet,rows[0].corps);
  await db.query("UPDATE account_notifications SET statut='sent',sent_at=NOW() WHERE id=?",[id]);return true;
 } catch(e) {
  await db.query("UPDATE account_notifications SET statut='failed' WHERE id=?",[id]);
  console.error('Notification non envoyée :',e.code||'SMTP');return false;
 }
}
module.exports={envoyer};
