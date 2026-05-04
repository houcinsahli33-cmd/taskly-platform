// Ce fichier contient la logique liée aux demandes.
// Il utilise demandeModel.js pour créer une demande.

const demandeModel = require("../models/demandeModel");

// Créer une nouvelle demande
async function creerDemande(req, res) {
    try {
        const clientId = req.session.utilisateur.id;

        const { artisanId, message, adresse, dateSouhaitee } = req.body;

        if (!artisanId) {
            return res.status(400).json({
                message: "Artisan requis."
            });
        }

        await demandeModel.creerDemande(
            clientId,
            artisanId,
            message,
            adresse,
            dateSouhaitee
        );

        res.status(201).json({
            message: "Demande envoyée avec succès."
        });
    } catch (error) {
        console.error("Erreur création demande :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

module.exports = {
    creerDemande
};