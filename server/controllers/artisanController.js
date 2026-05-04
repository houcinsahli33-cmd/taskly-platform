// Ce fichier contient la logique liée aux artisans.
// Il utilise artisanModel.js pour récupérer les artisans depuis la base de données.

const artisanModel = require("../models/artisanModel"); // on importe les fonctions du fichier artisanModel.js pour interagir avec la table artisans

// recuperer tous les artisans
async function listerArtisans(req, res) {
    try {
        // on recupere les filtres, req.query contient les filtres envoyes dans l'URL apres le ?
        const filtres = {
            serviceId: req.query.serviceId,
            ville: req.query.ville,
            recherche: req.query.recherche
        };

        const artisans = await artisanModel.trouverTousLesArtisans(filtres);   // on recupere tous les artisans

        res.status(200).json({  // la requete a ete acceptee, on renvoie les artisans
            artisans: artisans 
        });

    } catch (error) {
        // si une erreur arrive dans le try, on l'affiche dans la console (terminal)
        console.error("Erreur récupération artisans :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// recuperer details d'un artisan
async function detailArtisan(req, res) {
    try {
        const id = req.params.id;   // on recupere l'id de l'artisan depuis l'url

        const artisan = await artisanModel.trouverArtisanParId(id);   // on recupere l'artisan par son id

        if (!artisan) {
            return res.status(404).json({
                message: "Artisan introuvable."
            });
        }

        res.status(200).json({  // la requete a ete acceptee, on renvoie l'artisan
            artisan: artisan
        });

    } catch (error) {   // si une erreur arrive dans le try, on l'affiche dans la console (terminal)
        console.error("Erreur lors de la récupération des détails de l'artisan :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

module.exports = {
    listerArtisans,
    detailArtisan
};