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
// Récupérer un artisan par son id
async function detailsArtisan(req, res) {
    try {
        const { id } = req.params;

        const artisan = await artisanModel.trouverArtisanParId(id);

        if (!artisan) {
            return res.status(404).json({
                message: "Artisan introuvable."
            });
        }

        res.status(200).json({
            artisan: artisan
        });
    } catch (error) {
        console.error("Erreur récupération artisan :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

module.exports = {
    listerArtisans,
    detailsArtisan
};// Ce fichier contient la logique liée aux artisans.
// Il utilise artisanModel.js pour récupérer les artisans depuis la base de données.

const artisanModel = require("../models/artisanModel");

// Récupérer tous les artisans avec filtres possibles
async function listerArtisans(req, res) {
    try {
        const filtres = {
            serviceId: req.query.serviceId,
            ville: req.query.ville,
            recherche: req.query.recherche
        };

        const artisans = await artisanModel.trouverTousLesArtisans(filtres);

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

// Récupérer un artisan par son id
async function detailsArtisan(req, res) {
    try {
        const { id } = req.params;

        const artisan = await artisanModel.trouverArtisanParId(id);

        if (!artisan) {
            return res.status(404).json({
                message: "Artisan introuvable."
            });
        }

        res.status(200).json({
            artisan: artisan
        });
    } catch (error) {
        console.error("Erreur récupération artisan :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

module.exports = {
    listerArtisans,
    detailsArtisan
};