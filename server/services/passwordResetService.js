'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/db').promise();
const { envoyerCode, estConfigure } = require('./emailService');

const CODE_TTL_MINUTES = 3;
const MAX_ATTEMPTS = 3;
const RESEND_SECONDS = 60;
const RESET_TTL_MINUTES = 5;
const REGEX_EMAIL = /^[^\s@<>]{1,64}@[^\s@<>]+\.[^\s@<>]{2,}$/;

function erreur(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function normaliserEmail(value) {
  const email = typeof value === 'string'
    ? value.trim().toLowerCase()
    : '';

  if (email.length > 254 || !REGEX_EMAIL.test(email)) {
    throw erreur('Veuillez saisir une adresse e-mail valide.');
  }

  return email;
}

function empreinte(type, ...parts) {
  const secret = process.env.SESSION_SECRET;

  if (!secret || Buffer.byteLength(secret) < 32) {
    throw erreur('Service de récupération indisponible.', 503);
  }

  return crypto.createHmac('sha256', secret)
    .update(JSON.stringify([
      'taskly-password-reset-v1',
      type,
      ...parts
    ]))
    .digest('hex');
}

function identite(value) {
  const email = normaliserEmail(value);

  return {
    email,
    key: empreinte('email', email)
  };
}

function egal(a, b) {
  if (
    !/^[a-f0-9]{64}$/i.test(String(a)) ||
    !/^[a-f0-9]{64}$/i.test(String(b))
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(a, 'hex'),
    Buffer.from(b, 'hex')
  );
}

async function transaction(fn) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const resultat = await fn(conn);

    await conn.commit();

    return resultat;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function lireCode(conn, key) {
  const [rows] = await conn.query(
    `SELECT code_hash, attempts, used_at,
            expires_at > NOW() AS vivant,
            TIMESTAMPDIFF(SECOND, issued_at, NOW()) AS age
     FROM password_reset_codes
     WHERE email_key = ?
     FOR UPDATE`,
    [key]
  );

  return rows[0];
}

async function comptePublicVerifie(conn, email) {
  const [rows] = await conn.query(
    `SELECT id FROM users
     WHERE email = ?
     AND role IN ('client', 'artisan')
     AND email_verified = 1
     LIMIT 1`,
    [email]
  );

  return rows.length > 0;
}

// 1. GENERER ET ENVOYER LE CODE

async function demanderCode(value) {
  const { email, key } = identite(value);

  if (!estConfigure()) {
    throw erreur('Service de récupération indisponible.', 503);
  }

  const code = crypto.randomInt(0, 1000000)
    .toString()
    .padStart(6, '0');

  const hash = empreinte('code', key, code);

  const envoyer = await transaction(async conn => {

    await conn.query(
      `INSERT INTO password_reset_codes
       (email_key, code_hash, expires_at, attempts,
        issued_at, used_at)
       VALUES (?, ?, NOW(), 0,
               '2000-01-01 00:00:00', NULL)
       ON DUPLICATE KEY UPDATE email_key = email_key`,
      [key, hash]
    );

    const row = await lireCode(conn, key);

    if (Number(row.age) < RESEND_SECONDS) {
      return false;
    }

    await conn.query(
      `UPDATE password_reset_codes
       SET code_hash = ?,
           expires_at = DATE_ADD(NOW(), INTERVAL 3 MINUTE),
           attempts = 0,
           issued_at = NOW(),
           used_at = NULL
       WHERE email_key = ?`,
      [hash, key]
    );

    return comptePublicVerifie(conn, email);
  });

  if (envoyer) {
    await envoyerCode(email, code, 'password_reset');
  }
}

// 2. VERIFIER LE CODE DE RECUPERATION

async function verifierCode(value, code) {
  const { email, key } = identite(value);

  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return null;
  }

  const hash = empreinte('code', key, code);
  const jeton = crypto.randomBytes(32).toString('hex');

  return transaction(async conn => {
    const row = await lireCode(conn, key);

    if (
      !row ||
      !Number(row.vivant) ||
      row.used_at ||
      Number(row.attempts) >= MAX_ATTEMPTS
    ) {
      return null;
    }

    const [essai] = await conn.query(
      `UPDATE password_reset_codes
       SET attempts = attempts + 1
       WHERE email_key = ?
       AND used_at IS NULL
       AND attempts < ?
       AND expires_at > NOW()`,
      [key, MAX_ATTEMPTS]
    );

    if (
      !essai.affectedRows ||
      !egal(row.code_hash, hash)
    ) {
      return null;
    }

    if (!await comptePublicVerifie(conn, email)) {
      return null;
    }

    const [resultat] = await conn.query(
      `UPDATE password_reset_codes
       SET code_hash = ?,
           used_at = NOW(),
           expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE)
       WHERE email_key = ?
       AND used_at IS NULL
       AND expires_at > NOW()`,
      [empreinte('jeton', key, jeton), key]
    );

    return resultat.affectedRows === 1 ? jeton : null;
  });
}

// 3. VERIFIER LE NOUVEAU MOT DE PASSE

function motDePasseValide(value) {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
    Buffer.byteLength(value, 'utf8') <= 72 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

// 4. REINITIALISER LE MOT DE PASSE

async function reinitialiserMotDePasse(
  value,
  jeton,
  motDePasse,
  confirmation
) {
  const { email, key } = identite(value);

  if (!motDePasseValide(motDePasse)) {
    throw erreur(
      '8 caractères minimum, majuscule, minuscule, chiffre et symbole ; 72 octets maximum.'
    );
  }

  if (motDePasse !== confirmation) {
    throw erreur('Les mots de passe ne correspondent pas.');
  }

  if (
    typeof jeton !== 'string' ||
    !/^[a-f0-9]{64}$/.test(jeton)
  ) {
    return false;
  }

  const hashJeton = empreinte('jeton', key, jeton);

  const [rows] = await db.query(
    `SELECT code_hash
     FROM password_reset_codes
     WHERE email_key = ?
     AND used_at IS NOT NULL
     AND expires_at > NOW()`,
    [key]
  );

  if (!rows.length || !egal(rows[0].code_hash, hashJeton)) {
    return false;
  }

  const nouveauHash = await bcrypt.hash(motDePasse, 12);

  return transaction(async conn => {

    const row = await lireCode(conn, key);

    if (
      !row ||
      !Number(row.vivant) ||
      !row.used_at ||
      !egal(row.code_hash, hashJeton)
    ) {
      return false;
    }

    if (!await comptePublicVerifie(conn, email)) {
      return false;
    }

    const [consomme] = await conn.query(
      `UPDATE password_reset_codes
       SET code_hash = ?,
           expires_at = NOW()
       WHERE email_key = ?
       AND used_at IS NOT NULL
       AND expires_at > NOW()
       AND code_hash = ?`,
      [
        empreinte(
          'consomme',
          key,
          crypto.randomBytes(32).toString('hex')
        ),
        key,
        hashJeton
      ]
    );

    if (consomme.affectedRows !== 1) {
      return false;
    }

    // Modifier uniquement les comptes publics.
    // Ne jamais modifier le compte administrateur.

    const [resultat] = await conn.query(
      `UPDATE users
       SET mot_de_passe = ?,
           admin_session_version = admin_session_version + 1
       WHERE email = ?
       AND role IN ('client', 'artisan')`,
      [nouveauHash, email]
    );

    return resultat.affectedRows > 0;
  });
}

// 5. EXPORTER LE SERVICE

module.exports = {
  demanderCode,
  verifierCode,
  reinitialiserMotDePasse,
  CODE_TTL_MINUTES,
  MAX_ATTEMPTS,
  RESEND_SECONDS,
  RESET_TTL_MINUTES
};
