// Ce fichier contient la logique liée à l'administration.
// Il permet à l'administrateur de consulter les données importantes du système.

const userModel = require("../models/userModel");// on importe le modèle de données des utilisateurs pour pouvoir récupérer les utilisateurs depuis la base de données
const demandeModel = require("../models/demandeModel"); // on importe le modèle de données des demandes pour pouvoir récupérer les demandes depuis la base de données
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

module.exports = {
    listerUtilisateurs,
    listerDemandes
};