// Ce fichier contient la logique métier liée au formulaire de contact/support.

const contactModel = require("../models/contactModel");

// Envoyer un message au support
async function envoyerMessageContact(req, res) {
    try {
        const { nom, email, sujet, message } = req.body;

        if (typeof nom!=='string' || nom.trim().length<2 || nom.length>100 || typeof email!=='string' || email.length>255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof sujet!=='string' || !sujet.trim() || sujet.length>255 || typeof message!=='string' || message.trim().length<10 || message.length>5000) {
            return res.status(400).json({
                message: "Tous les champs sont obligatoires."
            });
        }

        let resultat;
        const identite = req.session?.utilisateur;
        // Le formulaire public conserve son fonctionnement. Dans un espace connecte,
        // l'auteur est force par la session, et jamais par les champs transmis.
        if (identite && ['client','artisan'].includes(identite.role)) {
            const user = await require('../models/userModel').trouverUtilisateurParId(identite.id);
            if (!user || user.role !== identite.role || user.statut_compte !== 'actif' || !user.email_verified)
                return res.status(401).json({message:'Veuillez vous reconnecter.'});
            resultat = await contactModel.creerMessageCompte(
                [user.prenom, user.nom].filter(Boolean).join(' '), user.email, sujet, message, user.id
            );
        } else {
            resultat = await contactModel.creerMessageContact(nom, email, sujet, message);
        }

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

// Historique prive : seule l'identite de session est utilisee pour le filtrage.
async function mesMessagesSupport(req, res) {
    try {
        const user = req.session?.utilisateur;
        if (!user || !['client','artisan'].includes(user.role))
            return res.status(403).json({message:'Espace client ou artisan requis.'});
        const page = Number(req.query.page || 1);
        if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
            return res.status(400).json({message:'Page invalide.'});
        const limit = 20;
        const rows = await contactModel.listerMessagesCompte(user.id, limit + 1, (page - 1) * limit);
        res.set('Cache-Control','no-store, private');
        res.json({messages:rows.slice(0,limit),page,hasMore:rows.length > limit});
    } catch (error) {
        console.error('Historique support indisponible :',error.code || error.name);
        res.status(503).json({message:'Historique momentanement indisponible.'});
    }
}

module.exports = {
    envoyerMessageContact,
    mesMessagesSupport,
    consulterMessageContact
};