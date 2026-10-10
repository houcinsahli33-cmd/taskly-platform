// Ce fichier contient la logique métier liée au formulaire de contact/support.

const contactModel = require("../models/contactModel");

// Envoyer un message au support
async function envoyerMessageContact(req, res) {
    try {
        const { nom, email, sujet, message } = req.body;

        if (!nom || !email || !sujet || !message) {
            return res.status(400).json({
                message: "Tous les champs sont obligatoires."
            });
        }

        const resultat = await contactModel.creerMessageContact(nom, email, sujet, message);

        res.status(201).json({
            message: "Votre message a été envoyé avec succès.",
            contactId: resultat.insertId
        });

    } catch (error) {
        console.error("Erreur envoi contact :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Consulter le statut d'un message de contact
async function consulterMessageContact(req, res) {
    try {
        const { contactId, email } = req.query;

    if (!contactId || !email) {
        return res.status(400).json({
            message: "Le numéro de suivi et l'email sont obligatoires."
        });
    }

    const contact = await contactModel.trouverMessageContactParIdEtEmail(contactId, email);

        if (!contact) {
            return res.status(404).json({
                message: "Message de contact introuvable."
            });
        }

        res.status(200).json({
            contact
        });

    } catch (error) {
        console.error("Erreur consultation contact :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

module.exports = {
    envoyerMessageContact,
    consulterMessageContact
};