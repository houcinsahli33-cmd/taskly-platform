// Ce fichier contient la logique liée aux services.
// Il utilise serviceModel.js pour récupérer les services depuis la base de données.

const serviceModel = require("../models/serviceModel"); // on importe les fonctions du fichier serviceModel.js pour interagir avec la table services

// recuperer tous les services
async function listerServices(req, res) {
    try{
        const services = await serviceModel.trouverTousLesServices();   // on recupere tous les services

        res.status(200).json({  // la requete a ete acceptee, on renvoie les services
            services: services
        });

    } catch (error){    // si une erreur arrive dans le try, on l'affiche dans la console (terminal)
        console.error(error);
        res.status(500).json({  
            message: "Une erreur est survenue lors de la recherche des services."
        });
    }
}

// Recuperer un service par son id
async function obtenirServiceParId(req, res) {
    try {
        const service = await serviceModel.trouverServiceParId(req.params.id);

        if (!service) {
            return res.status(404).json({
                message: "Service introuvable."
            });
        }

        res.status(200).json({
            service
        });

    } catch (error) {
        console.error("Erreur récupération service :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

module.exports = {
    listerServices,
    obtenirServiceParId
};