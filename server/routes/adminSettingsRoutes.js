
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/db');

const {
  verifierConnexion,
  verifierAdmin
} = require('../middleware/authMiddleware');

const { limiter } = require('../middleware/securityMiddleware');
const { envoyerCourrielAdmin } = require('../services/adminMailService');

const router = express.Router();
const sql = db.promise();

const reEmail = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const reNom = /^[\p{L}\p{M}' -]{2,100}$/u;

const normaliserEmail = email =>
  String(email || '').trim().toLowerCase();

const nomValide = valeur =>
  typeof valeur === 'string' &&
  reNom.test(valeur.trim());

const motDePasseFort = valeur =>
  typeof valeur === 'string' &&
  valeur.length >= 12 &&
  Buffer.byteLength(valeur, 'utf8') <= 72 &&
  /[a-z]/.test(valeur) &&
  /[A-Z]/.test(valeur) &&
  /\d/.test(valeur) &&
  /[^A-Za-z0-9]/.test(valeur);

const hashInvitation = token =>
  crypto.createHash('sha256').update(token).digest('hex');

const hashCodeEmail = (id, email, code) =>
  crypto.createHmac('sha256', process.env.SESSION_SECRET)
    .update(`change-email:${id}:${email}:${code}`)
    .digest('hex');

const comparerHash = (a, b) =>
  crypto.timingSafeEqual(
    Buffer.from(a, 'hex'),
    Buffer.from(b, 'hex')
  );

function erreurServeur(res, erreur, message) {
  if (erreur.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      message: 'Cette adresse e-mail est déjà utilisée.'
    });
  }

  if (erreur.code === 'ER_NO_SUCH_TABLE' || erreur.code === 'ER_BAD_FIELD_ERROR') {
    return res.status(503).json({message:'Migration de la base requise. Appliquez npm run db:migrate après sauvegarde ; les autorisations restent verrouillées.'});
  }
  console.error('Administration :', erreur.code || 'erreur');

  return res.status(erreur.status || 500).json({
    message: erreur.status ? erreur.message : message
  });
}

const limiteNormale = limiter({ max: 25 });
const limiteSensible = limiter({
  max: 10,
  fenetre: 15 * 60 * 1000
});

// =====================================
// INVITATIONS PUBLIQUES
// =====================================

router.get('/invitation', async (req, res) => {
  const token = String(req.query.token || '');

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({
      message: 'Invitation invalide.'
    });
  }

  try {
    const [rows] = await sql.query(
      `SELECT nom, prenom, email
       FROM admin_invitations
       WHERE token_hash = ?
         AND accepted_at IS NULL
         AND revoked_at IS NULL
         AND expires_at > NOW()`,
      [hashInvitation(token)]
    );

    if (!rows.length) {
      return res.status(410).json({
        message: 'Invitation expirée ou déjà utilisée.'
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({ invitation: rows[0] });
  } catch (erreur) {
    erreurServeur(res, erreur, 'Invitation indisponible.');
  }
});

router.post('/invitation/accept', limiteSensible, async (req, res) => {
  const token = String(req.body?.token || '');
  const motDePasse = req.body?.motDePasse;

  if (
    !/^[a-f0-9]{64}$/.test(token) ||
    !motDePasseFort(motDePasse)
  ) {
    return res.status(400).json({
      message: 'Invitation ou mot de passe invalide. Utilisez au moins 12 caractères, avec majuscule, minuscule, chiffre et symbole.'
    });
  }

  let connexion;

  try {
    const hash = await bcrypt.hash(motDePasse, 12);

    connexion = await db.promise().getConnection();
    await connexion.beginTransaction();

    const [invitations] = await connexion.query(
      `SELECT *
       FROM admin_invitations
       WHERE token_hash = ?
         AND accepted_at IS NULL
         AND revoked_at IS NULL
         AND expires_at > NOW()
       FOR UPDATE`,
      [hashInvitation(token)]
    );

    if (!invitations.length) {
      await connexion.rollback();

      return res.status(410).json({
        message: 'Invitation expirée ou déjà utilisée.'
      });
    }

    const invitation = invitations[0];

    const [existants] = await connexion.query(
      'SELECT id FROM users WHERE email = ?',
      [invitation.email]
    );

    if (existants.length) {
      await connexion.rollback();

      return res.status(409).json({
        message: 'Cette adresse e-mail est déjà utilisée.'
      });
    }

    const [ajout] = await connexion.query(
      `INSERT INTO users
       (nom, prenom, email, mot_de_passe, role, email_verified)
       VALUES (?, ?, ?, ?, 'admin', 1)`,
      [
        invitation.nom,
        invitation.prenom,
        invitation.email,
        hash
      ]
    );

    await connexion.query(
      `INSERT INTO admin_roles (user_id, niveau)
       VALUES (?, 'secondaire')`,
      [ajout.insertId]
    );

    await connexion.query(
      `UPDATE admin_invitations
       SET accepted_at = NOW()
       WHERE id = ?`,
      [invitation.id]
    );

    await connexion.query(
      `INSERT INTO admin_audit_logs
       (admin_user_id, action, cible_id, detail)
       VALUES (?, 'invitation_acceptee', ?, ?)`,
      [
        invitation.created_by,
        ajout.insertId,
        invitation.email
      ]
    );

    await connexion.commit();

    res.json({
      message: 'Compte administrateur créé. Vous pouvez maintenant vous connecter.'
    });
  } catch (erreur) {
    if (connexion) {
      await connexion.rollback().catch(() => {});
    }

    erreurServeur(
      res,
      erreur,
      'Impossible de créer le compte administrateur.'
    );
  } finally {
    if (connexion) connexion.release();
  }
});

// =====================================
// PROTECTION DES ROUTES PRIVEES
// =====================================

router.use(verifierConnexion, verifierAdmin);

async function chargerCompte(req) {
  const [rows] = await sql.query(
    `SELECT
       u.id,
       u.nom,
       u.prenom,
       u.email,
       u.mot_de_passe,
       u.email_verified,
       u.created_at,
       COALESCE(ar.niveau, 'secondaire') AS niveau
     FROM users u
     LEFT JOIN admin_roles ar ON ar.user_id = u.id
     WHERE u.id = ?
       AND u.role = 'admin'
       AND u.statut_compte = 'actif'`,
    [req.session.utilisateur.id]
  );

  return rows[0];
}

async function verifierAdminPrincipal(req, res, next) {
  try {
    const [rows] = await sql.query(
      `SELECT niveau
       FROM admin_roles
       WHERE user_id = ?`,
      [req.session.utilisateur.id]
    );

    if (rows[0]?.niveau !== 'principal') {
      return res.status(403).json({
        message: 'Réservé à l’administrateur principal.'
      });
    }

    next();
  } catch (erreur) {
    erreurServeur(
      res,
      erreur,
      'Impossible de vérifier les autorisations.'
    );
  }
}

async function journaliser(adminId, action, cibleId, detail) {
  await sql.query(
    `INSERT INTO admin_audit_logs
     (admin_user_id, action, cible_id, detail)
     VALUES (?, ?, ?, ?)`,
    [
      adminId,
      action,
      cibleId || null,
      detail || null
    ]
  );
}

// =====================================
// MON COMPTE
// =====================================

router.get('/me', async (req, res) => {
  try {
    const compte = await chargerCompte(req);

    if (!compte) {
      return res.status(404).json({
        message: 'Compte administrateur introuvable.'
      });
    }

    const { mot_de_passe, ...informations } = compte;

    res.setHeader('Cache-Control', 'no-store');
    res.json({ compte: informations });
  } catch (erreur) {
    erreurServeur(res, erreur, 'Impossible de charger le profil.');
  }
});

router.put('/me', limiteNormale, async (req, res) => {
  const nom = String(req.body?.nom || '').trim();
  const prenom = String(req.body?.prenom || '').trim();

  if (!nomValide(nom) || !nomValide(prenom)) {
    return res.status(400).json({
      message: 'Nom ou prénom invalide.'
    });
  }

  try {
    await sql.query(
      `UPDATE users
       SET nom = ?, prenom = ?
       WHERE id = ? AND role = 'admin'`,
      [nom, prenom, req.session.utilisateur.id]
    );

    req.session.utilisateur.nom = nom;
    req.session.utilisateur.prenom = prenom;

    await journaliser(
      req.session.utilisateur.id,
      'profil_modifie'
    );

    res.json({
      message: 'Informations personnelles enregistrées.'
    });
  } catch (erreur) {
    erreurServeur(res, erreur, 'Modification impossible.');
  }
});

// =====================================
// CHANGER LE MOT DE PASSE
// =====================================

router.put('/password', limiteSensible, async (req, res) => {
  const ancien = req.body?.ancienMotDePasse;
  const nouveau = req.body?.nouveauMotDePasse;

  if (!motDePasseFort(nouveau)) {
    return res.status(400).json({
      message: 'Le nouveau mot de passe doit contenir au moins 12 caractères, une majuscule, une minuscule, un chiffre et un symbole.'
    });
  }

  try {
    const compte = await chargerCompte(req);

    if (
      !compte ||
      typeof ancien !== 'string' ||
      !(await bcrypt.compare(ancien, compte.mot_de_passe))
    ) {
      return res.status(403).json({
        message: 'Mot de passe actuel incorrect.'
      });
    }

    if (await bcrypt.compare(nouveau, compte.mot_de_passe)) {
      return res.status(400).json({
        message: 'Choisissez un mot de passe différent.'
      });
    }

    const hash = await bcrypt.hash(nouveau, 12);

    await sql.query(
      `UPDATE users
       SET mot_de_passe = ?,
           admin_session_version = admin_session_version + 1
       WHERE id = ?`,
      [hash, compte.id]
    );

    await journaliser(compte.id, 'mot_de_passe_modifie');

    req.session.destroy(() => {
      res.json({
        message: 'Mot de passe modifié. Reconnectez-vous.',
        deconnexion: true
      });
    });
  } catch (erreur) {
    erreurServeur(
      res,
      erreur,
      'Changement de mot de passe impossible.'
    );
  }
});

// =====================================
// DEMANDER UN CHANGEMENT D'E-MAIL
// =====================================

router.post('/email/request', limiteSensible, async (req, res) => {
  const nouvelEmail = normaliserEmail(req.body?.nouvelEmail);
  const motDePasse = req.body?.motDePasse;

  if (!reEmail.test(nouvelEmail) || nouvelEmail.length > 255) {
    return res.status(400).json({
      message: 'Adresse e-mail invalide.'
    });
  }

  try {
    const compte = await chargerCompte(req);

    if (
      !compte ||
      typeof motDePasse !== 'string' ||
      !(await bcrypt.compare(motDePasse, compte.mot_de_passe))
    ) {
      return res.status(403).json({
        message: 'Mot de passe incorrect.'
      });
    }

    if (nouvelEmail === compte.email) {
      return res.status(400).json({
        message: 'Cette adresse est déjà utilisée par votre compte.'
      });
    }

    const [existants] = await sql.query(
      'SELECT id FROM users WHERE email = ?',
      [nouvelEmail]
    );

    if (existants.length) {
      return res.status(409).json({
        message: 'Cette adresse e-mail est déjà utilisée.'
      });
    }

    const code = crypto.randomInt(0, 1000000)
      .toString()
      .padStart(6, '0');

    const hash = hashCodeEmail(compte.id, nouvelEmail, code);

    await sql.query(
      `INSERT INTO admin_email_changes
       (user_id, nouveau_email, code_hash, expires_at, attempts, created_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 0, NOW())
       ON DUPLICATE KEY UPDATE
         nouveau_email = VALUES(nouveau_email),
         code_hash = VALUES(code_hash),
         expires_at = VALUES(expires_at),
         attempts = 0,
         created_at = NOW()`,
      [compte.id, nouvelEmail, hash]
    );

    try {
      await envoyerCourrielAdmin(
        nouvelEmail,
        'Taskly — confirmation de votre nouvel e-mail',
        `Votre code de confirmation Taskly : ${code}\nCe code expire dans 10 minutes.`
      );
    } catch (erreur) {
      await sql.query(
        `DELETE FROM admin_email_changes
         WHERE user_id = ? AND code_hash = ?`,
        [compte.id, hash]
      );

      throw erreur;
    }

    res.json({
      message: 'Code envoyé. Il expire dans 10 minutes.'
    });
  } catch (erreur) {
    erreurServeur(
      res,
      erreur,
      'Impossible d’envoyer le code de confirmation.'
    );
  }
});

// =====================================
// CONFIRMER LE CHANGEMENT D'E-MAIL
// =====================================

router.post('/email/verify', limiteSensible, async (req, res) => {
  const code = String(req.body?.code || '');

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({
      message: 'Un code à 6 chiffres est nécessaire.'
    });
  }

  let connexion;

  try {
    connexion = await db.promise().getConnection();
    await connexion.beginTransaction();

    const id = req.session.utilisateur.id;

    const [rows] = await connexion.query(
      `SELECT *
       FROM admin_email_changes
       WHERE user_id = ?
         AND expires_at > NOW()
         AND attempts < 3
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connexion.rollback();

      return res.status(410).json({
        message: 'Code expiré ou trop de tentatives.'
      });
    }

    const demande = rows[0];

    await connexion.query(
      `UPDATE admin_email_changes
       SET attempts = attempts + 1
       WHERE user_id = ?`,
      [id]
    );

    const hash = hashCodeEmail(
      id,
      demande.nouveau_email,
      code
    );

    if (!comparerHash(demande.code_hash, hash)) {
      await connexion.commit();

      return res.status(400).json({
        message: 'Code de vérification incorrect.'
      });
    }

    await connexion.query(
      `UPDATE users
       SET email = ?,
           email_verified = 1,
           admin_session_version = admin_session_version + 1
       WHERE id = ?`,
      [demande.nouveau_email, id]
    );

    await connexion.query(
      'DELETE FROM admin_email_changes WHERE user_id = ?',
      [id]
    );

    await connexion.query(
      `INSERT INTO admin_audit_logs
       (admin_user_id, action, detail)
       VALUES (?, 'email_modifie', 'confirmation_par_code')`,
      [id]
    );

    await connexion.commit();

    req.session.destroy(() => {
      res.json({
        message: 'Adresse e-mail modifiée. Reconnectez-vous.',
        deconnexion: true
      });
    });
  } catch (erreur) {
    if (connexion) {
      await connexion.rollback().catch(() => {});
    }

    erreurServeur(res, erreur, 'Confirmation impossible.');
  } finally {
    if (connexion) connexion.release();
  }
});

// =====================================
// LISTE DES ADMINISTRATEURS
// =====================================

router.get('/admins', verifierAdminPrincipal, async (req, res) => {
  try {
    const [admins] = await sql.query(
      `SELECT
         u.id,
         u.nom,
         u.prenom,
         u.email,
         u.statut_compte,
         ar.niveau,
         u.created_at
       FROM admin_roles ar
       JOIN users u ON u.id = ar.user_id
       WHERE u.role = 'admin'
       ORDER BY (ar.niveau = 'principal') DESC, u.id ASC`
    );

    const [invitations] = await sql.query(
      `SELECT id, nom, prenom, email, expires_at, created_at
       FROM admin_invitations
       WHERE accepted_at IS NULL
         AND revoked_at IS NULL
         AND expires_at > NOW()
       ORDER BY id DESC
       LIMIT 30`
    );

    const [historique] = await sql.query(
      `SELECT
         a.action,
         a.detail,
         a.created_at,
         u.prenom,
         u.nom
       FROM admin_audit_logs a
       JOIN users u ON a.admin_user_id = u.id
       ORDER BY a.id DESC
       LIMIT 12`
    );

    res.setHeader('Cache-Control', 'no-store');

    res.json({
      admins,
      invitations,
      historique
    });
  } catch (erreur) {
    erreurServeur(
      res,
      erreur,
      'Impossible de charger les administrateurs.'
    );
  }
});

// =====================================
// INVITER UN NOUVEL ADMINISTRATEUR
// =====================================

router.post(
  '/admins/invite',
  verifierAdminPrincipal,
  limiteSensible,
  async (req, res) => {
    const nom = String(req.body?.nom || '').trim();
    const prenom = String(req.body?.prenom || '').trim();
    const email = normaliserEmail(req.body?.email);
    const motDePasse = req.body?.motDePasse;

    if (
      !nomValide(nom) ||
      !nomValide(prenom) ||
      !reEmail.test(email) ||
      email.length > 255
    ) {
      return res.status(400).json({
        message: 'Nom, prénom ou adresse e-mail invalide.'
      });
    }

    try {
      const compte = await chargerCompte(req);

      if (
        !compte ||
        typeof motDePasse !== 'string' ||
        !(await bcrypt.compare(motDePasse, compte.mot_de_passe))
      ) {
        return res.status(403).json({
          message: 'Mot de passe administrateur incorrect.'
        });
      }

      const [existants] = await sql.query(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );

      if (existants.length) {
        return res.status(409).json({
          message: 'Un compte existe déjà avec cet e-mail.'
        });
      }

      const site =
        process.env.PUBLIC_SITE_URL ||
        (
          process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
            : ''
        );

      if (!/^https:\/\/[a-z0-9][a-z0-9.-]+(?::443)?$/i.test(site)) {
        return res.status(503).json({
          message: 'PUBLIC_SITE_URL doit contenir une adresse HTTPS valide.'
        });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashInvitation(token);

      await sql.query(
        `UPDATE admin_invitations
         SET revoked_at = NOW()
         WHERE email = ?
           AND accepted_at IS NULL
           AND revoked_at IS NULL`,
        [email]
      );

      const [resultat] = await sql.query(
        `INSERT INTO admin_invitations
         (nom, prenom, email, token_hash, created_by, expires_at)
         VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
        [
          nom,
          prenom,
          email,
          tokenHash,
          compte.id
        ]
      );

      const lien = `${site}/admin-invitation.html#token=${token}`;

      try {
        await envoyerCourrielAdmin(
          email,
          'Taskly — invitation administrateur',
          `Bonjour ${prenom},

Vous êtes invité(e) à rejoindre l'administration de Taskly.

Ouvrez ce lien privé dans les 24 heures :
${lien}

Vous choisirez votre propre mot de passe.

Connexion après activation :
${site}${process.env.ADMIN_ENTRY_PATH || ''}

Si vous n'attendiez pas cette invitation, ignorez ce message.`
        );
      } catch (erreur) {
        await sql.query(
          `UPDATE admin_invitations
           SET revoked_at = NOW()
           WHERE id = ?`,
          [resultat.insertId]
        );

        throw erreur;
      }

      await journaliser(
        compte.id,
        'admin_invite',
        null,
        email
      );

      res.status(201).json({
        message: 'Invitation envoyée. Elle expire dans 24 heures.'
      });
    } catch (erreur) {
      erreurServeur(
        res,
        erreur,
        'Impossible d’envoyer l’invitation.'
      );
    }
  }
);

// =====================================
// ANNULER UNE INVITATION
// =====================================

router.delete(
  '/admins/invitations/:id',
  verifierAdminPrincipal,
  limiteSensible,
  async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        message: 'Invitation invalide.'
      });
    }

    try {
      const [resultat] = await sql.query(
        `UPDATE admin_invitations
         SET revoked_at = NOW()
         WHERE id = ?
           AND accepted_at IS NULL
           AND revoked_at IS NULL`,
        [id]
      );

      if (!resultat.affectedRows) {
        return res.status(404).json({
          message: 'Invitation introuvable.'
        });
      }

      await journaliser(
        req.session.utilisateur.id,
        'invitation_revoquee',
        null,
        String(id)
      );

      res.json({
        message: 'Invitation annulée.'
      });
    } catch (erreur) {
      erreurServeur(res, erreur, 'Annulation impossible.');
    }
  }
);

// =====================================
// DESACTIVER UN ADMIN SECONDAIRE
// =====================================

router.put(
  '/admins/:id/disable',
  verifierAdminPrincipal,
  limiteSensible,
  async (req, res) => {
    const id = Number(req.params.id);

    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      id === req.session.utilisateur.id
    ) {
      return res.status(400).json({
        message: 'Cette action est impossible.'
      });
    }

    try {
      const [resultat] = await sql.query(
        `UPDATE users u
         JOIN admin_roles ar ON ar.user_id = u.id
         SET
           u.statut_compte = 'bloque',
           u.admin_session_version = u.admin_session_version + 1
         WHERE u.id = ?
           AND u.role = 'admin'
           AND ar.niveau = 'secondaire'`,
        [id]
      );

      if (!resultat.affectedRows) {
        return res.status(403).json({
          message: 'Cet administrateur ne peut pas être désactivé.'
        });
      }

      await journaliser(
        req.session.utilisateur.id,
        'admin_desactive',
        id
      );

      res.json({
        message: 'Administrateur secondaire désactivé.'
      });
    } catch (erreur) {
      erreurServeur(res, erreur, 'Désactivation impossible.');
    }
  }
);

// =====================================
// REACTIVER UN ADMIN SECONDAIRE
// =====================================

router.put(
  '/admins/:id/enable',
  verifierAdminPrincipal,
  limiteSensible,
  async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        message: 'Compte administrateur invalide.'
      });
    }

    try {
      const [resultat] = await sql.query(
        `UPDATE users u
         JOIN admin_roles ar ON ar.user_id = u.id
         SET u.statut_compte = 'actif'
         WHERE u.id = ?
           AND u.role = 'admin'
           AND ar.niveau = 'secondaire'`,
        [id]
      );

      if (!resultat.affectedRows) {
        return res.status(403).json({
          message: 'Cet administrateur ne peut pas être réactivé.'
        });
      }

      await journaliser(
        req.session.utilisateur.id,
        'admin_reactive',
        id
      );

      res.json({
        message: 'Administrateur secondaire réactivé.'
      });
    } catch (erreur) {
      erreurServeur(res, erreur, 'Réactivation impossible.');
    }
  }
);

// Coordonnées publiques : écriture réservée au principal, journalisée atomiquement.
function erreurParametresSite(res,error,message) {
  if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR')
    return res.status(503).json({message:'Migration des paramètres du site requise : après sauvegarde, exécutez npm run db:migrate -- migration_parametres_site.sql.'});
  return erreurServeur(res,error,message);
}
router.get('/site', async (req,res) => {
  try {res.json({parametres:await require('../services/siteSettings').lire(sql)});}
  catch (error) {erreurParametresSite(res,error,'Impossible de lire les coordonnées du site.');}
});
router.put('/site', limiteNormale, verifierAdminPrincipal, async (req,res) => {
  try {
    const parametres=await require('../services/siteSettings').enregistrer(sql,req.body,req.session.utilisateur.id);
    res.json({message:'Coordonnées du site enregistrées.',parametres});
  } catch (error) {erreurParametresSite(res,error,'Impossible d’enregistrer les coordonnées du site.');}
});
module.exports = router;
