// Ce fichier contient les requêtes SQL liées à la table demandes.
// Il permet de créer une demande, lister les demandes et modifier leur statut

const db = require("../config/db"); // on importe la connexion à la base de données depuis db.js

// Les demandes non cloturees bloquent uniquement le couple client/artisan.
async function trouverDemandeOuverte(clientId, artisanId, conn = db.promise(), verrou = false) {
    const [rows] = await conn.query(`SELECT id, statut FROM demandes
        WHERE client_id = ? AND artisan_id = ?
          AND statut IN ('en_attente','acceptee','attente_confirmation','conteste')
        ORDER BY id DESC LIMIT 1${verrou ? ' FOR UPDATE' : ''}`, [clientId, artisanId]);
    return rows[0] || null;
}

// Le verrou sur le client serialise les creations, meme quand aucune demande n'existe.
async function creerDemande(clientId, artisanId, message, adresse, dateSouhaitee, heureSouhaitee) {
    const conn = await db.promise().getConnection();
    try {
        const [versions] = await conn.query('SELECT VERSION() AS version');
        if (/tidb/i.test(String(versions[0]?.version || ''))) {
            await conn.query('BEGIN PESSIMISTIC');
        } else {
            await conn.beginTransaction();
        }
        const [clients] = await conn.query('SELECT id FROM clients WHERE id = ? FOR UPDATE', [clientId]);
        if (clients.length !== 1) throw new Error('Profil client introuvable.');
        const existante = await trouverDemandeOuverte(clientId, artisanId, conn, true);
        if (existante) {
            const error = new Error('Une demande est déjà en cours avec cet artisan.');
            error.code = 'TASKLY_DEMANDE_OUVERTE'; error.demande = existante; throw error;
        }
        const calendrier = controlesCalendrier(conn);
        let proposition = null;
        if (heureSouhaitee !== undefined && heureSouhaitee !== null && heureSouhaitee !== '') {
            const creneaux = require('../helpers/creneauxIntervention');
            proposition = creneaux.normaliserHeureSouhaitee(heureSouhaitee);
            creneaux.verifierFutur(dateSouhaitee,proposition.debut);
            // Même verrou artisan que l’acceptation : contrôle avant insertion, non réservation.
            const [artisans] = await conn.query('SELECT id FROM artisans WHERE id=? FOR UPDATE',[artisanId]);
            if (artisans.length !== 1) throw Object.assign(Error('Artisan introuvable.'),{code:'TASKLY_CRENEAU_INVALIDE'});
            if ((await creneaux.occupations(conn,artisanId,dateSouhaitee,0)).some(x=>creneaux.conflit(proposition,x)))
                throw Object.assign(Error('Ce créneau est déjà occupé.'),{code:'TASKLY_CRENEAU_OCCUPE'});
        } else if (dateSouhaitee && await calendrier.jourReserveArtisan(artisanId,dateSouhaitee)) {
            const error=new Error('Date déjà réservée.');error.code='TASKLY_DATE_OCCUPEE';throw error;
        }
        // En attente : l’heure proposée n’est pas un créneau réservé, la fin reste NULL.
        const [resultat] = proposition ? await conn.query(`
            INSERT INTO demandes (client_id, artisan_id, message, adresse, date_souhaitee, creneau_debut_minute)
            VALUES (?, ?, ?, ?, ?, ?)`, [clientId, artisanId, message, adresse, dateSouhaitee, proposition.debut]) : await conn.query(`
            INSERT INTO demandes (client_id, artisan_id, message, adresse, date_souhaitee)
            VALUES (?, ?, ?, ?, ?)`, [clientId, artisanId, message, adresse, dateSouhaitee]);
        await conn.commit();
        return resultat;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally { conn.release(); }
}

// Seules les missions déjà acceptées/en cours bloquent un jour. Aucune donnée client n'est exposée.
async function datesReserveesArtisan(artisanId, aPartirDe) {
    const [lignes] = await db.promise().query(`
        SELECT DISTINCT DATE_FORMAT(date_souhaitee, '%Y-%m-%d') AS jour
        FROM demandes
        WHERE artisan_id = ? AND date_souhaitee >= ?
          AND statut IN ('acceptee','attente_confirmation','conteste')
          AND (creneau_debut_minute IS NULL OR creneau_fin_minute IS NULL OR creneau_blocage_minute IS NULL
               OR creneau_debut_minute >= creneau_fin_minute OR creneau_fin_minute >= creneau_blocage_minute OR creneau_blocage_minute > 1440)
        ORDER BY jour`, [artisanId, aPartirDe]);
    return lignes.map(l => String(l.jour));
}
// Seuls les débuts possibles sont transmis : ni identité ni adresse des autres clients.
async function heuresProposablesArtisan(artisanId, jour) {
    const creneaux = require('../helpers/creneauxIntervention');
    const autres = await creneaux.occupations(db.promise(),artisanId,jour);
    return {heures:creneaux.heuresProposables(jour,autres)};
}

// Le calendrier est lie a la connexion qui effectue le controle.
// L'API publique conserve la signature a deux arguments.
function controlesCalendrier(conn) {
    return {
        async jourReserveArtisan(artisanId, date) {
            const [lignes] = await conn.query(`
                SELECT id FROM demandes WHERE artisan_id = ? AND date_souhaitee = ?
                  AND statut IN ('acceptee','attente_confirmation','conteste') LIMIT 1`, [artisanId,date]);
            return lignes.length > 0;
        }
    };
}
async function jourReserveArtisan(artisanId, date) {
    return controlesCalendrier(db.promise()).jourReserveArtisan(artisanId,date);
}
// Lister les demandes envoyees par un client
async function listerDemandesClient(clientId) {
    const sql = `
        SELECT
            demandes.id,
            demandes.client_id,
            demandes.artisan_id,
            demandes.message,
            demandes.adresse,
            demandes.date_souhaitee,
            demandes.creneau_debut_minute,
            demandes.creneau_fin_minute,
            demandes.creneau_blocage_minute,
            demandes.intervention_debut_utc,
            demandes.intervention_fin_utc,
            demandes.statut,
            demandes.annulee_par,
            demandes.motif_annulation,
            demandes.date_traitement,
            demandes.date_annulation,
            demandes.created_at,

            users.nom AS artisan_nom,
            users.prenom AS artisan_prenom,
            users.photo_profil AS artisan_photo_profil,

            artisans.ville AS artisan_ville,
            CASE WHEN artisans.afficher_telephone = 1 AND artisans.verification_statut = 'approuve'
                 AND users.statut_compte = 'actif' AND users.email_verified = 1
                 THEN artisans.telephone ELSE NULL END AS artisan_telephone,
            artisans.experience AS artisan_experience,

            services.nom AS service_nom,

            avis.id AS avis_id,
            avis.note AS avis_note
        FROM demandes
        JOIN artisans ON demandes.artisan_id = artisans.id
        JOIN users ON artisans.user_id = users.id
        JOIN services ON artisans.service_id = services.id
        LEFT JOIN avis ON demandes.id = avis.demande_id
        WHERE demandes.client_id = ?
        ORDER BY demandes.created_at DESC
    `;

    const [resultats] = await db.promise().query(sql, [clientId]);

    return resultats;
}

// Lister les demandes recues par un artisan
async function listerDemandesArtisan(artisanId) {
    const sql = `
        SELECT
            demandes.id,
            demandes.client_id,
            demandes.artisan_id,
            demandes.message,
            CASE WHEN demandes.statut IN ('acceptee','attente_confirmation','terminee','conteste') THEN demandes.adresse ELSE NULL END AS adresse,
            demandes.date_souhaitee,
            demandes.creneau_debut_minute,
            demandes.creneau_fin_minute,
            demandes.creneau_blocage_minute,
            demandes.intervention_debut_utc,
            demandes.intervention_fin_utc,
            demandes.statut,
            demandes.annulee_par,
            demandes.motif_annulation,
            demandes.date_traitement,
            demandes.date_annulation,
            demandes.created_at,

            users.nom AS client_nom,
            users.prenom AS client_prenom,
            users.photo_profil AS client_photo_profil,

            CASE WHEN demandes.statut IN ('acceptee','attente_confirmation','terminee','conteste') THEN clients.telephone ELSE NULL END AS client_telephone,
            clients.ville AS client_ville,
            CASE WHEN demandes.statut IN ('acceptee','attente_confirmation','terminee','conteste') THEN clients.adresse ELSE NULL END AS client_adresse
        FROM demandes
        JOIN clients ON demandes.client_id = clients.id
        JOIN users ON clients.user_id = users.id
        WHERE demandes.artisan_id = ?
        ORDER BY demandes.created_at DESC
    `;

    const [resultats] = await db.promise().query(sql, [artisanId]);

    return resultats;
}

// Modifier le statut d'une demande par un artisan : accepter ou refuser
async function modifierStatutDemande(id, artisanId, statut, horaire) {
    if (statut === 'acceptee') {
        return require('../helpers/creneauxIntervention').accepter(db.promise(),id,artisanId,horaire);
    }
    const sql = `
        UPDATE demandes
        SET statut = ?,
        date_traitement = NOW()
        WHERE id = ?
        AND artisan_id = ?
        AND statut = 'en_attente'
    `;

    const [resultat] = await db.promise().query(sql, [
        statut,
        id,
        artisanId
    ]);

    return resultat;
}

// Annuler une demande par le client
async function annulerDemandeClient(id, clientId) {
    const sql = `
        UPDATE demandes
        SET statut = 'annulee',
            annulee_par = 'client',
            date_annulation = NOW()
        WHERE id = ?
        AND client_id = ?
        AND statut = 'en_attente'
    `;

    const [resultat] = await db.promise().query(sql, [
        id,
        clientId
    ]);

    return resultat;
}

// Annuler une demande acceptée par l'artisan avec un motif
async function annulerDemandeArtisan(id, artisanId, motifAnnulation) {
    const sql = `
        UPDATE demandes
        SET statut = 'annulee',
            annulee_par = 'artisan',
            motif_annulation = ?,
            intervention_fin_utc = CASE WHEN intervention_debut_utc IS NOT NULL THEN UTC_TIMESTAMP() ELSE NULL END,
            date_annulation = NOW()
        WHERE id = ?
        AND artisan_id = ?
        AND statut = 'acceptee'
    `;

    const [resultat] = await db.promise().query(sql, [
        motifAnnulation,
        id,
        artisanId
    ]);

    return resultat;
}

// Démarrage déclaré par le profil propriétaire. Le verrou commun sérialise les démarrages.
async function demarrerDemande(id, artisanId) {
    const conn = await db.promise().getConnection();
    try {
        const [versions] = await conn.query('SELECT VERSION() AS version');
        if (/tidb/i.test(String(versions[0]?.version || ''))) await conn.query('BEGIN PESSIMISTIC');
        else await conn.beginTransaction();
        const [artisans] = await conn.query('SELECT id FROM artisans WHERE id=? FOR UPDATE', [artisanId]);
        if (artisans.length !== 1) throw Object.assign(Error('Profil artisan introuvable.'), {code:'TASKLY_INTERVENTION_CONFLIT'});
        const [rows] = await conn.query(`SELECT id, intervention_debut_utc,
            CASE WHEN date_souhaitee IS NULL THEN 1
                 WHEN creneau_debut_minute IS NULL THEN date_souhaitee <= DATE(TIMESTAMPADD(HOUR,1,UTC_TIMESTAMP()))
                 ELSE TIMESTAMPADD(MINUTE,creneau_debut_minute,CAST(date_souhaitee AS DATETIME)) <= TIMESTAMPADD(HOUR,1,UTC_TIMESTAMP()) END AS peut_demarrer
            FROM demandes WHERE id=? AND artisan_id=? AND statut='acceptee' FOR UPDATE`, [id,artisanId]);
        if (rows.length !== 1 || rows[0].intervention_debut_utc != null || Number(rows[0].peut_demarrer) !== 1)
            throw Object.assign(Error('Cette intervention ne peut pas démarrer avant son rendez-vous ou a déjà démarré.'), {code:'TASKLY_INTERVENTION_CONFLIT'});
        const [actives] = await conn.query(`SELECT id FROM demandes WHERE artisan_id=? AND statut='acceptee'
            AND intervention_debut_utc IS NOT NULL AND intervention_fin_utc IS NULL LIMIT 1 FOR UPDATE`, [artisanId]);
        if (actives.length) throw Object.assign(Error('Terminez votre intervention en cours avant d’en démarrer une autre.'), {code:'TASKLY_INTERVENTION_CONFLIT'});
        const [resultat] = await conn.query(`UPDATE demandes SET intervention_debut_utc=UTC_TIMESTAMP()
            WHERE id=? AND artisan_id=? AND statut='acceptee' AND intervention_debut_utc IS NULL AND intervention_fin_utc IS NULL`, [id,artisanId]);
        if (resultat.affectedRows !== 1) throw Object.assign(Error('Cette demande a changé. Actualisez la page.'), {code:'TASKLY_INTERVENTION_CONFLIT'});
        await conn.commit();
        return resultat;
    } catch (error) { await conn.rollback(); throw error; }
    finally { conn.release(); }
}

// Marquer une demande acceptee comme terminee
async function terminerDemande(id, artisanId) {
    const sql = `
        UPDATE demandes
        SET statut = 'attente_confirmation',
            intervention_fin_utc = UTC_TIMESTAMP(),
            date_traitement = NOW()
        WHERE id = ?
        AND artisan_id = ?
        AND statut = 'acceptee'
        AND (intervention_debut_utc IS NOT NULL OR creneau_debut_minute IS NULL)
    `;

    const [resultat] = await db.promise().query(sql, [
        id,
        artisanId
    ]);

    return resultat;
}



// Lecture ciblée : impossible de consulter la demande d'un autre artisan.
async function detailArtisan(id, artisanId) {
    const [lignes] = await db.promise().query(`
        SELECT d.*, u.nom AS client_nom, u.prenom AS client_prenom,
            u.email AS client_email, c.telephone AS client_telephone,
            c.ville AS client_ville, s.nom AS service_nom
        FROM demandes d
        JOIN clients c ON c.id = d.client_id
        JOIN users u ON u.id = c.user_id
        JOIN artisans a ON a.id = d.artisan_id
        LEFT JOIN services s ON s.id = a.service_id
        WHERE d.id = ? AND d.artisan_id = ? LIMIT 1
    `, [id, artisanId]);
    return lignes[0] || null;
}


// Les destinataires viennent de la demande réellement enregistrée, pas du corps HTTP.
async function trouverDestinataires(id) {
    const [rows] = await db.promise().query(`
        SELECT d.id,
            uc.id AS client_user_id, uc.email AS client_email,
            uc.prenom AS client_prenom, uc.nom AS client_nom,
            ua.id AS artisan_user_id, ua.email AS artisan_email,
            ua.prenom AS artisan_prenom, ua.nom AS artisan_nom
        FROM demandes d
        JOIN clients c ON c.id = d.client_id
        JOIN users uc ON uc.id = c.user_id
        JOIN artisans a ON a.id = d.artisan_id
        JOIN users ua ON ua.id = a.user_id
        WHERE d.id = ? LIMIT 1
    `, [id]);
    return rows[0] || null;
}

// Le compte client connecté ne peut agir que sur ses propres demandes.
async function confirmerFinClient(id, clientId) {
    const [resultat] = await db.promise().query(`UPDATE demandes
        SET statut='terminee', date_traitement=NOW()
        WHERE id=? AND client_id=? AND statut='attente_confirmation'`,[id,clientId]);
    return resultat;
}
async function contesterFinClient(id, clientId) {
    const [resultat] = await db.promise().query(`UPDATE demandes
        SET statut='conteste',date_traitement=NOW()
        WHERE id=? AND client_id=? AND statut='attente_confirmation'`,[id,clientId]);
    return resultat;
}
module.exports = {
    datesReserveesArtisan, heuresProposablesArtisan, jourReserveArtisan, trouverDemandeOuverte,
    confirmerFinClient,
    contesterFinClient,
    trouverDestinataires,
    detailArtisan,
    creerDemande,
    listerDemandesClient,
    listerDemandesArtisan,
    modifierStatutDemande,
    annulerDemandeClient,
    annulerDemandeArtisan,
    demarrerDemande,
    terminerDemande
};
