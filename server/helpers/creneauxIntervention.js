'use strict';

// Les minutes sont locales (Africa/Algiers), relatives à date_souhaitee.
// La réservation et sa marge doivent rester dans la même journée.
const MARGE_MINUTES = 30;
function erreur(code, message) { return Object.assign(new Error(message), {code}); }
function normaliserCreneau(horaire) {
    if (horaire === undefined) return null; // compatibilité des anciennes demandes
    if (!horaire || typeof horaire !== 'object' || Array.isArray(horaire) ||
        typeof horaire.heureDebut !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaire.heureDebut) ||
        !Number.isInteger(horaire.dureeMinutes) || horaire.dureeMinutes < 15 ||
        horaire.dureeMinutes > 720 || horaire.dureeMinutes % 15 !== 0) {
        throw erreur('TASKLY_CRENEAU_INVALIDE', 'Heure HH:mm et durée de 15 à 720 minutes (par pas de 15) requises.');
    }
    const [h,m] = horaire.heureDebut.split(':').map(Number);
    const debut = h * 60 + m, fin = debut + horaire.dureeMinutes;
    if (debut % 15 !== 0 || fin + MARGE_MINUTES > 1440)
        throw erreur('TASKLY_CRENEAU_INVALIDE', 'Choisissez un début au quart d’heure et laissez 30 minutes de déplacement avant minuit.');
    return {debut, fin, blocage:fin + MARGE_MINUTES};
}
// Le client propose une heure, pas une durée. Le minimum testé est 15 min + trajet.
function normaliserHeureSouhaitee(heure) {
    return normaliserCreneau({heureDebut:heure,dureeMinutes:15});
}
function heuresProposables(jour, autres, now = new Date()) {
    const heures = [];
    if (autres.some(x=>!x)) return heures;
    for(let debut=0;debut+15+MARGE_MINUTES<=1440;debut+=15) {
        try { verifierFutur(jour,debut,now); } catch(e) { if(e.code==='TASKLY_CRENEAU_INVALIDE') continue; throw e; }
        const slot={debut,fin:debut+15,blocage:debut+15+MARGE_MINUTES};
        if(!autres.some(x=>conflit(slot,x))) heures.push(debut);
    }
    return heures;
}
function verifierFutur(jour, debut, now = new Date()) {
    if (typeof jour !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(jour))
        throw erreur('TASKLY_CRENEAU_INVALIDE', 'Une date de rendez-vous est nécessaire.');
    const [y,m,d] = jour.split('-').map(Number);
    const date = new Date(Date.UTC(y,m-1,d));
    if (date.toISOString().slice(0,10) !== jour)
        throw erreur('TASKLY_CRENEAU_INVALIDE', 'Date invalide.');
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone:'Africa/Algiers',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }).formatToParts(now).map(p=>[p.type,p.value]));
    const aujourdHui = `${parts.year}-${parts.month}-${parts.day}`;
    if (jour < aujourdHui || (jour === aujourdHui && debut <= Number(parts.hour)*60+Number(parts.minute)))
        throw erreur('TASKLY_CRENEAU_INVALIDE','Le début du rendez-vous doit être dans le futur.');
}
function intervalle(row) {
    const {creneau_debut_minute:d,creneau_fin_minute:f,creneau_blocage_minute:b} = row;
    if (![d,f,b].every(Number.isInteger) || d < 0 || d >= f || f >= b || b > 1440) return null;
    return {debut:d,fin:f,blocage:b};
}
function conflit(a,b) { return !a || !b || (a.debut < b.blocage && b.debut < a.blocage); }
// Une prestation planifiée, déclarée terminée, libère son temps de travail.
// Une ancienne prestation sans horaires garde la règle précédente.
const OCCUPATION = `(statut='acceptee' OR (statut IN ('attente_confirmation','conteste') AND (creneau_debut_minute IS NULL OR creneau_fin_minute IS NULL OR creneau_blocage_minute IS NULL)))`;
const CHAMPS = 'creneau_debut_minute, creneau_fin_minute, creneau_blocage_minute';
async function occupations(conn, artisanId, jour, exclu = null) {
    const [rows] = await conn.query(`SELECT ${CHAMPS} FROM demandes
        WHERE artisan_id=? AND date_souhaitee=? AND ${OCCUPATION}${exclu === null ? '' : ' AND id<>? FOR UPDATE'}`,
        exclu === null ? [artisanId,jour] : [artisanId,jour,exclu]);
    return rows.map(intervalle);
}
async function accepter(pool,id,artisanId,horaire) {
    const slot = normaliserCreneau(horaire);
    const conn = await pool.getConnection();
    try {
        const [versions] = await conn.query('SELECT VERSION() AS version');
        if (/tidb/i.test(String(versions[0]?.version || ''))) await conn.query('BEGIN PESSIMISTIC');
        else await conn.beginTransaction();
        // Verrou commun à toutes les acceptations, y compris les anciennes sans horaire.
        const [artisans] = await conn.query('SELECT id FROM artisans WHERE id=? FOR UPDATE',[artisanId]);
        if (artisans.length !== 1) throw erreur('TASKLY_CRENEAU_INVALIDE','Profil artisan introuvable.');
        const [rows] = await conn.query(`SELECT id, DATE_FORMAT(date_souhaitee,'%Y-%m-%d') AS jour, creneau_debut_minute
            FROM demandes WHERE id=? AND artisan_id=? AND statut='en_attente' FOR UPDATE`,[id,artisanId]);
        if (rows.length !== 1) { await conn.rollback(); return {affectedRows:0}; }
        const jour = rows[0].jour;
        const souhaite = rows[0].creneau_debut_minute;
        if (souhaite != null && (!slot || slot.debut !== souhaite))
            throw erreur('TASKLY_CRENEAU_INVALIDE','Respectez l’heure demandée et choisissez la durée.');
        if (slot) verifierFutur(jour,slot.debut);
        if (jour && (await occupations(conn,artisanId,jour,id)).some(other=>conflit(slot,other)))
            throw erreur('TASKLY_CRENEAU_OCCUPE','Ce créneau ou cette journée est déjà réservé.');
        const [resultat] = await conn.query(`UPDATE demandes SET statut='acceptee', date_traitement=NOW(),
            creneau_debut_minute=?, creneau_fin_minute=?, creneau_blocage_minute=?
            WHERE id=? AND artisan_id=? AND statut='en_attente'`,
            [slot?.debut??null,slot?.fin??null,slot?.blocage??null,id,artisanId]);
        if (resultat.affectedRows !== 1) throw erreur('TASKLY_CRENEAU_OCCUPE','La demande a changé. Actualisez la page.');
        await conn.commit();
        return resultat;
    } catch(e) { await conn.rollback(); throw e; }
    finally { conn.release(); }
}
module.exports = {normaliserHeureSouhaitee,heuresProposables,normaliserCreneau,verifierFutur,intervalle,conflit,occupations,accepter,MARGE_MINUTES};
