"use strict";

const db = require("../config/db");

// Retrouver la demande et ses participants.
async function trouverDemande(demandeId) {
    const [rows] = await db.promise().query(
        `SELECT
            d.id,
            d.client_id,
            d.artisan_id,
            d.statut,
            d.date_traitement,
            d.date_souhaitee,
            d.adresse,
            NULLIF(TRIM(CONCAT_WS(' ', uc.prenom, uc.nom)), '') AS client_nom,
            NULLIF(TRIM(CONCAT_WS(' ', ua.prenom, ua.nom)), '') AS artisan_nom,
            c.telephone AS client_telephone,
            CASE WHEN a.afficher_telephone = 1 AND a.verification_statut = 'approuve'
                  AND ua.statut_compte = 'actif' AND ua.email_verified = 1
                 THEN a.telephone ELSE NULL END AS artisan_telephone,
            CASE WHEN a.autoriser_messagerie = 1 THEN 0 ELSE 1 END AS messagerie_bloquee,
            s.nom AS service_nom
         FROM demandes d
         LEFT JOIN clients c ON c.id = d.client_id
         LEFT JOIN users uc ON uc.id = c.user_id
         LEFT JOIN artisans a ON a.id = d.artisan_id
         LEFT JOIN users ua ON ua.id = a.user_id
         LEFT JOIN services s ON s.id = a.service_id
         WHERE d.id = ?
         LIMIT 1`,
        [demandeId]
    );

    return rows[0] || null;
}

// Lire les 50 derniers messages dans l'ordre chronologique.
async function listerMessages(demandeId) {
    const piecesJointes = process.env.TASKLY_CHAT_ATTACHMENTS_ENABLED === 'true';
    const [rows] = await db.promise().query(
        piecesJointes
        ? `SELECT CAST(m.id AS CHAR) AS id, m.demande_id, m.auteur_type,
             m.auteur_profil_id, m.contenu, m.created_at, m.lu_at,
             a.filename AS fichier_nom, a.media_type AS fichier_type, a.byte_size AS fichier_taille
           FROM taskly_chat_messages m
           LEFT JOIN taskly_chat_attachments a ON a.message_id=m.id
           WHERE m.demande_id=? ORDER BY m.id DESC LIMIT 50`
        : `SELECT CAST(id AS CHAR) AS id, demande_id, auteur_type,
                 auteur_profil_id, contenu, created_at, lu_at
           FROM taskly_chat_messages WHERE demande_id=? ORDER BY id DESC LIMIT 50`,
        [demandeId]
    );

    return rows.reverse();
}

// Enregistrer uniquement pour le participant de la demande acceptee.
async function envoyerMessage(demandeId, auteurType, profilId, contenu) {
    if (!["client", "artisan"].includes(auteurType)) {
        throw new Error("Type d'auteur invalide.");
    }

    const [resultat] = await db.promise().query(
        `INSERT INTO taskly_chat_messages
            (demande_id, auteur_type, auteur_profil_id, contenu)
         SELECT d.id, ?, ?, ?
         FROM demandes d
         WHERE d.id = ?
           AND d.statut = 'acceptee'
           AND EXISTS (SELECT 1 FROM artisans a WHERE a.id=d.artisan_id AND a.autoriser_messagerie=1)
           AND (
                (? = 'client' AND d.client_id = ?)
                OR
                (? = 'artisan' AND d.artisan_id = ?)
           )`,
        [
            auteurType, profilId, contenu,
            demandeId,
            auteurType, profilId,
            auteurType, profilId
        ]
    );

    return resultat.affectedRows === 1
        ? resultat.insertId
        : null;
}

// Stocker le message et le fichier prive dans une transaction unique.
async function envoyerFichier(demandeId,auteurType,profilId,contenu,file,info){
 if(!['client','artisan'].includes(auteurType))throw new Error('Rôle invalide.');
 const conn=await db.promise().getConnection();
 try{
  await conn.beginTransaction();
  const [result]=await conn.query(`INSERT INTO taskly_chat_messages
   (demande_id,auteur_type,auteur_profil_id,contenu)
   SELECT d.id,?,?,? FROM demandes d
   WHERE d.id=? AND d.statut='acceptee'
   AND EXISTS (SELECT 1 FROM artisans a WHERE a.id=d.artisan_id AND a.autoriser_messagerie=1)
   AND ((?='client' AND d.client_id=?) OR (?='artisan' AND d.artisan_id=?))`,
   [auteurType,profilId,contenu,demandeId,auteurType,profilId,auteurType,profilId]);
  if(result.affectedRows!==1){await conn.rollback();return null;}
  const fileId=await require('../services/fileStorage').enregistrer(file,true,conn);
  await conn.query(`INSERT INTO taskly_chat_attachments
    (message_id,file_id,filename,media_type,byte_size,sha256) VALUES (?,?,?,?,?,?)`,
   [result.insertId,fileId,info.filename,info.mime,info.size,info.sha256]);
  await conn.commit();
  return result.insertId;
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}

// Les conversations appartiennent uniquement au profil courant. Jamais à son e-mail.
const presenceActive = () => typeof process !== 'undefined' && process.env?.TASKLY_CHAT_PRESENCE_ENABLED === 'true';
async function enregistrerPresence(userId) {
 if (!Number.isSafeInteger(Number(userId)) || Number(userId) < 1) throw Error('Identifiant invalide.');
 await db.promise().query(`INSERT INTO taskly_chat_presence (user_id, seen_at)
 VALUES (?, NOW(3)) ON DUPLICATE KEY UPDATE seen_at=NOW(3)`, [userId]);
}
const historiqueSQL="(d.statut IN ('acceptee','attente_confirmation','terminee','conteste') OR (d.statut='annulee' AND d.date_traitement IS NOT NULL))";
function scope(role){
 if(role==='client')return {owner:'d.client_id',other:'artisan',join:'JOIN artisans p ON p.id=d.artisan_id JOIN users u ON u.id=p.user_id',otherId:'d.artisan_id'};
 if(role==='artisan')return {owner:'d.artisan_id',other:'client',join:'JOIN clients p ON p.id=d.client_id JOIN users u ON u.id=p.user_id',otherId:'d.client_id'};
 throw Error('Rôle non autorisé.');
}
async function conversations(role,profilId,{q='',unread=false,offset=0}={}){
 const a=scope(role);
 const presence = presenceActive();
 const [rows]=await db.promise().query(`SELECT d.id,d.statut,d.date_souhaitee,s.nom AS service_nom,
  NULLIF(TRIM(CONCAT_WS(' ',u.prenom,u.nom)),'') AS nom,u.photo_profil,
  ${presence ? 'IF(tp.user_id IS NOT NULL, 1, 0)' : '0'} AS en_ligne,
  m.contenu AS dernier_message, m.created_at AS dernier_at,
  (SELECT COUNT(*) FROM taskly_chat_messages n WHERE n.demande_id=d.id AND n.auteur_type=? AND n.auteur_profil_id=${a.otherId} AND n.lu_at IS NULL) AS non_lus
  FROM demandes d ${a.join} JOIN artisans ap ON ap.id=d.artisan_id JOIN services s ON s.id=ap.service_id
  ${presence ? 'LEFT JOIN taskly_chat_presence tp ON tp.user_id=u.id AND tp.seen_at >= NOW(3) - INTERVAL 120 SECOND' : ''}
  LEFT JOIN (
    SELECT x.id, x.demande_id, x.contenu, x.created_at,
           ROW_NUMBER() OVER (
               PARTITION BY x.demande_id
               ORDER BY x.created_at DESC, x.id DESC
           ) AS rn
    FROM taskly_chat_messages x
    JOIN demandes dx ON dx.id=x.demande_id
    WHERE ${a.owner.replace('d.','dx.')}=?
) m ON m.demande_id=d.id AND m.rn=1
  WHERE ${a.owner}=? AND ${historiqueSQL}
  AND (?='' OR LOCATE(LOWER(?),LOWER(CONCAT_WS(' ',u.prenom,u.nom,s.nom,d.id,m.contenu)))>0)
  HAVING (?=0 OR non_lus>0)
  ORDER BY COALESCE(m.created_at,d.created_at) DESC,d.id DESC LIMIT 51 OFFSET ?`,
  [a.other,profilId,profilId,q,q,unread?1:0,offset]);
 return {conversations:rows.slice(0,50).map(r=>({...r,non_lus:Number(r.non_lus)})),next:rows.length>50?offset+50:null};
}
async function compterNonLus(role,profilId){
 const a=scope(role);
 const [rows]=await db.promise().query(`SELECT COUNT(*) AS total FROM demandes d JOIN taskly_chat_messages m ON m.demande_id=d.id
 WHERE ${a.owner}=? AND ${historiqueSQL} AND m.auteur_type=? AND m.auteur_profil_id=${a.otherId} AND m.lu_at IS NULL`,[profilId,a.other]);
 return Number(rows[0]?.total||0);
}
async function marquerLus(demandeId,role,profilId,throughId){
 const a=scope(role);
 const [result]=await db.promise().query(`UPDATE taskly_chat_messages m JOIN demandes d ON d.id=m.demande_id
 SET m.lu_at=NOW() WHERE d.id=? AND ${a.owner}=? AND ${historiqueSQL}
 AND m.auteur_type=? AND m.auteur_profil_id=${a.otherId} AND m.id<=CAST(? AS UNSIGNED) AND m.lu_at IS NULL`,[demandeId,profilId,a.other,throughId]);
 return Number(result.affectedRows||0);
}

async function participantsAppelActifs(demandeId) {

    const [rows] = await db.promise().query(
        `SELECT d.id
         FROM demandes d
         JOIN clients c ON c.id=d.client_id
         JOIN artisans a ON a.id=d.artisan_id
         JOIN users uc ON uc.id=c.user_id
         JOIN users ua ON ua.id=a.user_id
         WHERE d.id=?
         AND d.statut='acceptee'
         AND a.verification_statut='approuve'
         AND uc.statut_compte='actif'
         AND ua.statut_compte='actif'
         AND uc.email_verified=1
         AND ua.email_verified=1
         LIMIT 1`,
        [demandeId]
    );

    return rows.length === 1;
}

module.exports = { enregistrerPresence, participantsAppelActifs, trouverDemande,listerMessages,envoyerMessage,envoyerFichier,conversations,compterNonLus,marquerLus };
