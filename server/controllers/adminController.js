// Ce fichier contient la logique liée à l'administration.
// Il permet à l'administrateur de consulter les données importantes du système.

const userModel = require("../models/userModel");// on importe le modèle de données des utilisateurs pour pouvoir récupérer les utilisateurs depuis la base de données
const demandeModel = require("../models/demandeModel"); // on importe le modèle de données des demandes pour pouvoir récupérer les demandes depuis la base de données
const serviceModel = require("../models/serviceModel"); // on importe le modèle de données des services pour pouvoir récupérer les services depuis la base de données
const artisanModel = require("../models/artisanModel"); // on importe le modèle de données des artisans pour pouvoir récupérer les artisans depuis la base de données
// Récupérer tous les utilisateurs
async function listerUtilisateurs(req, res) {
    try {
        const utilisateurs = await userModel.trouverTousLesUtilisateurs();

        res.status(200).json({
            utilisateurs: utilisateurs
        });
    } catch (error) {
        console.error("Erreur récupération utilisateurs :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Récupérer toutes les demandes
async function listerDemandes(req, res) {
    try {
        const demandes = await demandeModel.trouverToutesLesDemandesParAdmin();

        res.status(200).json({
            demandes: demandes
        });
    } catch (error) {
        console.error("Erreur récupération demandes admin :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Récupérer tous les services
async function listerServices(req, res) {
    try {
        const services = await serviceModel.trouverTousLesServices();

        res.status(200).json({
            services: services
        });
    } catch (error) {
        console.error("Erreur récupération services admin :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Récupérer tous les artisans
async function listerArtisans(req, res) {
    try {
        const artisans = await artisanModel.trouverTousLesArtisans();

        res.status(200).json({
            artisans: artisans
        });
    } catch (error) {
        console.error("Erreur récupération artisans admin :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Ajouter un nouveau service
async function ajouterService(req, res) {
    try {
        const { nom, description, image } = req.body;

        if (!nom) {
            return res.status(400).json({
                message: "Le nom du service est obligatoire."
            });
        }

        await serviceModel.ajouterService(
            nom,
            description || null,
            image || null
        );

        res.status(201).json({
            message: "Service ajouté avec succès."
        });
    } catch (error) {
        console.error("Erreur ajout service admin :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Modifier un service
async function modifierService(req, res) {
    try {
        const { id } = req.params;
        const { nom, description, image } = req.body;

        if (!nom) {
            return res.status(400).json({
                message: "Le nom du service est obligatoire."
            });
        }

        const resultat = await serviceModel.modifierService(
            id,
            nom,
            description || null,
            image || null
        );

        if (resultat.affectedRows === 0) {
            return res.status(404).json({
                message: "Service introuvable."
            });
        }

        res.status(200).json({
            message: "Service modifié avec succès."
        });
    } catch (error) {
        console.error("Erreur modification service admin :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Supprimer un service
async function supprimerService(req, res) {
    try {
        const { id } = req.params;

        const resultat = await serviceModel.supprimerService(id);

        if (resultat.affectedRows === 0) {
            return res.status(404).json({
                message: "Service introuvable."
            });
        }

        res.status(200).json({
            message: "Service supprimé avec succès."
        });
    } catch (error) {
        console.error("Erreur suppression service admin :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

module.exports = {
    listerUtilisateurs,
    listerDemandes,
    listerServices,
    listerArtisans,
    ajouterService,
    modifierService,
    supprimerService
};