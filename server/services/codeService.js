const crypto = require('crypto');
const db = require('../config/db').promise();
const SECRET = process.env.SESSION_SECRET;
const CODE_TTL_MINUTES = 3;
const MAX_ATTEMPTS = 3;

function empreinte(userId, purpose, code) {
  return crypto.createHmac('sha256', SECRET).update(`${userId}:${purpose}:${code}`).digest('hex');
}

async function genererCode(userId, purpose) {
  const [rows] = await db.query(
    'SELECT TIMESTAMPDIFF(SECOND, issued_at, NOW()) AS age_seconds FROM verification_codes WHERE user_id=? AND purpose=?',
    [userId, purpose]
  );
  if (rows.length && rows[0].age_seconds < 60) {
    const erreur = new Error('Veuillez attendre une minute avant un nouveau code.');
    erreur.status = 429;
    throw erreur;
  }
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  await db.query(
    `INSERT INTO verification_codes (user_id,purpose,code_hash,expires_at,attempts,issued_at)
     VALUES (?,?,?,DATE_ADD(NOW(), INTERVAL 3 MINUTE),0,NOW())
     ON DUPLICATE KEY UPDATE code_hash=VALUES(code_hash),expires_at=VALUES(expires_at),attempts=0,issued_at=NOW()`,
    [userId, purpose, empreinte(userId, purpose, code)]
  );
  return code;
}

// La mise à jour SQL est atomique : même des requêtes simultanées ne peuvent
// pas dépasser la limite de 3 essais pour ce code.
async function verifierCode(userId, purpose, code) {
  if (!/^\d{6}$/.test(String(code || ''))) return false;
  const [resultat] = await db.query(
    'UPDATE verification_codes SET attempts=attempts+1 WHERE user_id=? AND purpose=? AND attempts<? AND expires_at>NOW()',
    [userId, purpose, MAX_ATTEMPTS]
  );
  if (!resultat.affectedRows) return false;
  const [rows] = await db.query(
    'SELECT code_hash FROM verification_codes WHERE user_id=? AND purpose=? AND expires_at>NOW()',
    [userId, purpose]
  );
  if (!rows.length) return false;
  const attendu = Buffer.from(rows[0].code_hash, 'hex');
  const recu = Buffer.from(empreinte(userId, purpose, code), 'hex');
  const valid = attendu.length === recu.length && crypto.timingSafeEqual(attendu, recu);
  if (valid) {
    const [resultatSuppression] = await db.query(
      'DELETE FROM verification_codes WHERE user_id=? AND purpose=? AND code_hash=?',
      [userId, purpose, rows[0].code_hash]
    );
    return resultatSuppression.affectedRows === 1;
  }
  return false;
}

async function obtenirEtatCode(userId, purpose) {
  const [rows] = await db.query(
    'SELECT GREATEST(0,TIMESTAMPDIFF(SECOND,NOW(),expires_at)) AS secondesRestantes,attempts FROM verification_codes WHERE user_id=? AND purpose=?',
    [userId, purpose]
  );
  if (!rows.length) return {secondesRestantes:0,tentativesRestantes:0};
  return {
    secondesRestantes:Math.max(0, Number(rows[0].secondesRestantes)||0),
    tentativesRestantes:Math.max(0,MAX_ATTEMPTS-(Number(rows[0].attempts)||0))
  };
}

module.exports = { genererCode, verifierCode, obtenirEtatCode, CODE_TTL_MINUTES, MAX_ATTEMPTS };
