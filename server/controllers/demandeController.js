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

// Récupérer les demandes envoyées par le client connecté
async function listerDemandesClient(req, res) {
    try {
        const clientId = req.session.utilisateur.id;

        const demandes = await demandeModel.trouverDemandesParClient(clientId);

        res.status(200).json({
            demandes: demandes
        });
    } catch (error) {
        console.error("Erreur récupération demandes client :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Récupérer les demandes reçues par l'artisan connecté
async function listerDemandesArtisan(req, res) {
    try {
        const artisanUserId = req.session.utilisateur.id;

        const demandes = await demandeModel.trouverDemandesParArtisan(artisanUserId);

        res.status(200).json({
            demandes: demandes
        });
    } catch (error) {
        console.error("Erreur récupération demandes artisan :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

module.exports = {
    creerDemande,
    listerDemandesArtisan,
    listerDemandesClient
};