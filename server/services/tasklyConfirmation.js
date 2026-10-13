"use strict";
const crypto = require('node:crypto');
const pool = require('../config/db').promise();
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
function tokenValide(token) {return typeof token==='string' && /^[a-f0-9]{64}$/.test(token);}
async function creer(demandeId) {
    const token=crypto.randomBytes(32).toString('hex');
    await pool.query(`INSERT INTO taskly_confirmations(demande_id,token_hash,expires_at,used_at)
        VALUES(?,?,DATE_ADD(NOW(),INTERVAL 7 DAY),NULL)
        ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash),expires_at=VALUES(expires_at),used_at=NULL`,
        [demandeId,hash(token)]);
    return token;
}
async function confirmer(token) {
    if(!tokenValide(token))return false;
    const connection=await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [rows]=await connection.query(`SELECT t.demande_id,d.statut FROM taskly_confirmations t
            JOIN demandes d ON d.id=t.demande_id
            WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at>NOW() FOR UPDATE`,[hash(token)]);
        if(rows.length!==1 || rows[0].statut!=='attente_confirmation') {await connection.rollback();return false;}
        const [result]=await connection.query(`UPDATE demandes SET statut='terminee',date_traitement=NOW()
            WHERE id=? AND statut='attente_confirmation'`,[rows[0].demande_id]);
        if(result.affectedRows!==1) {await connection.rollback();return false;}
        await connection.query(`UPDATE taskly_confirmations SET used_at=NOW() WHERE demande_id=?`,[rows[0].demande_id]);
        await connection.commit();return true;
    }catch(err){await connection.rollback();throw err;}
    finally {connection.release();}
}
module.exports={creer,confirmer,tokenValide};
