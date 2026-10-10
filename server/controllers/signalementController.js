// Ce fichier contient la logique métier liée aux signalements.

const signalementModel = require("../models/signalementModel");

// Creer un signalement
async function creerSignalement(req, res) {
    try {
        const { demandeId, motif, description } = req.body;

        if (!demandeId || !motif) {
            return res.status(400).json({
            message: "La demande et le motif sont obligatoires."
            });
        }

        const demande = await signalementModel.trouverDemandePourSignalement(demandeId);

        if (!demande) {
            return res.status(404).json({
                message: "Demande introuvable."
            });
        }

        const userId = req.session.utilisateur.id;
        let signaleUserId = null;

        if (userId === demande.client_user_id) {    // si l'utilisateur qui signale est le client
            signaleUserId = demande.artisan_user_id;    // le signaleUserId est l'artisan
        } else if (userId === demande.artisan_user_id) {    // si l'utilisateur est l'artisan
            signaleUserId = demande.client_user_id; // le signaleUserId est le client
        } else {
            return res.status(403).json({
                message: "Vous ne pouvez signaler que les utilisateurs liés à vos demandes."
            });
        }

        const resultat = await signalementModel.creerSignalement(demandeId, userId, signaleUserId, motif, description || null);

        res.status(201).json({
            message: "Signalement envoyé avec succès.",
            signalementId: resultat.insertId
        });

    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(400).json({
                message: "Vous avez déjà signalé cet utilisateur pour cette demande."
            });
        }
        console.error("Erreur création signalement :", error.message);
        
        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

module.exports = {
    creerSignalement
};