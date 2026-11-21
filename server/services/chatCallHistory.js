"use strict";

// Historique durable : seules les metadonnees d'appels sont sauvegardees.
// Aucun audio/video, SDP, jeton LiveKit ou numero de telephone n'est conserve.
const db = require('../config/db');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647;
}
function dateUtc(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0,23).replace('T',' ');
}

async function enregistrerTransition(acces, action, result) {
  const call = result && result.call;
  if (!validId(acces?.demandeId) || !['client','artisan'].includes(acces?.role) ||
      !call || typeof call.id !== 'string' || !UUID.test(call.id) ||
      !['client','artisan'].includes(call.callerRole) ||
      !['audio','video'].includes(call.mode) || !dateUtc(call.startedAt) ||
      ![200,201].includes(Number(result.code))) return false;

  // INSERT IGNORE evite les doublons en cas de repetiton/reconnexion.
  // La meme ligne peut etre creee lors d'un evenement tardif si le premier a echoue.
  await db.promise().query(
    `INSERT IGNORE INTO taskly_call_history
      (id,demande_id,caller_role,mode,etat,started_at)
     VALUES (?,?,?,?,'ringing',?)`,
    [call.id,Number(acces.demandeId),call.callerRole,call.mode,dateUtc(call.startedAt)]
  );
  const params = [call.id, Number(acces.demandeId)];
  if (action === 'accept' && call.state === 'accepted' && dateUtc(call.acceptedAt)) {
    await db.promise().query(
      `UPDATE taskly_call_history SET etat='answered',accepted_at=COALESCE(accepted_at,?)
       WHERE id=? AND demande_id=? AND etat IN ('ringing','answered')`,
      [dateUtc(call.acceptedAt), ...params]
    );
  } else if (action === 'reject' && call.state === 'rejected') {
    await db.promise().query(
      `UPDATE taskly_call_history SET etat='declined',ended_at=COALESCE(ended_at,?)
       WHERE id=? AND demande_id=? AND etat='ringing'`,
      [dateUtc(call.endedAt) || dateUtc(Date.now()),...params]
    );
  } else if ((action === 'end' || action === 'heartbeat') && call.state === 'ended') {
    const acceptedAt = dateUtc(call.acceptedAt);
    const etat = acceptedAt ? 'completed' : 'cancelled';
    await db.promise().query(
      `UPDATE taskly_call_history SET etat=?,
        accepted_at=COALESCE(accepted_at,?),ended_at=COALESCE(ended_at,?)
       WHERE id=? AND demande_id=? AND etat IN ('ringing','answered')`,
      [etat,acceptedAt,dateUtc(call.endedAt) || dateUtc(Date.now()),...params]
    );
  }
  return true;
}

async function listerPourDemande(demandeId) {
  if (!validId(demandeId)) throw new Error('Demande invalide.');
  // Le controle de propriete est fait AVANT cet appel, dans verifierParticipant().
  const [rows] = await db.promise().query(
    `SELECT id,caller_role AS callerRole,mode,
       CASE
         WHEN etat='ringing' AND started_at < DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 90 SECOND) THEN 'missed'
         WHEN etat='answered' AND accepted_at < DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 2 HOUR) THEN 'interrupted'
         ELSE etat END AS status,
       DATE_FORMAT(started_at,'%Y-%m-%dT%H:%i:%sZ') AS startedAt,
       CASE WHEN accepted_at IS NOT NULL AND ended_at IS NOT NULL
         THEN GREATEST(0,TIMESTAMPDIFF(SECOND,accepted_at,ended_at))
         ELSE NULL END AS durationSeconds
     FROM taskly_call_history WHERE demande_id=?
     ORDER BY started_at DESC,id DESC LIMIT 50`,
    [Number(demandeId)]
  );
  return rows;
}

module.exports = { enregistrerTransition, listerPourDemande };
