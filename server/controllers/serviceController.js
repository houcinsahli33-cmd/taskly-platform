// Ce fichier contient la logique liée aux services.
// Il utilise serviceModel.js pour récupérer les services depuis la base de données.

const serviceModel = require("../models/serviceModel");

// Récupérer tous les services
async function listerServices(req, res) {
    try {
        const services = await serviceModel.trouverTousLesServices();

        res.status(200).json({
            services: services
        });
    } catch (error) {
        console.error("Erreur récupération services :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

module.exports = {
    listerServices
};