// Ce fichier contient la logique métier liée aux signalements.

const signalementModel = require("../models/signalementModel");
const clientModel = require("../models/clientModel");
const artisanModel = require("../models/artisanModel");

// Creer un signalement
async function creerSignalement(req, res) {
    try {
        const { artisanId, motif, description } = req.body;

        if (!artisanId || !motif) {
            return res.status(400).json({
                message: "L'artisan et le motif sont obligatoires."
            });
        }

        const client = await clientModel.trouverClientParUserId(req.session.utilisateur.id);

        if (!client) {
            return res.status(404).json({
                message: "Profil client introuvable."
            });
        }

        const artisan = await artisanModel.trouverArtisanParId(artisanId);

        if (!artisan) {
            return res.status(404).json({
                message: "Artisan introuvable."
            });
        }

        const resultat = await signalementModel.creerSignalement(client.id, artisanId, motif, description || null);

        res.status(201).json({
            message: "Signalement envoyé avec succès.",
            signalementId: resultat.insertId
        });

    } catch (error) {
        console.error("Erreur création signalement :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

module.exports = {
    creerSignalement
};