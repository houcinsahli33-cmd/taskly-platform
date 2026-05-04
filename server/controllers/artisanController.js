// Ce fichier contient la logique liée aux artisans.
// Il utilise artisanModel.js pour récupérer les artisans depuis la base de données.

const artisanModel = require("../models/artisanModel");

// Récupérer tous les artisans
async function listerArtisans(req, res) {
    try {
        const artisans = await artisanModel.trouverTousLesArtisans();

        res.status(200).json({
            artisans: artisans
        });
    } catch (error) {
        console.error("Erreur récupération artisans :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

module.exports = {
    listerArtisans
};