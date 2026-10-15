"use strict";

const chatModel = require("../models/chatModel");
const clientModel = require("../models/clientModel");
const artisanModel = require("../models/artisanModel");

const STATUTS_HISTORIQUE = new Set([
    "acceptee",
    "attente_confirmation",
    "terminee",
    "conteste"
]);

// Verifier que la demande appartient au profil connecte.
async function verifierParticipant(req, res) {
    const role = req.session?.utilisateur?.role;
    const userId = req.session?.utilisateur?.id;
    const idTexte = String(req.params.id || "");

    if (role !== "client" && role !== "artisan") {
        res.status(403).json({ message: "Acces refuse." });
        return null;
    }

    if (!/^[1-9]\d*$/.test(idTexte) ||
        Number(idTexte) > 2147483647) {
        res.status(400).json({ message: "Numero de demande invalide." });
        return null;
    }

    const demandeId = Number(idTexte);
    const demande = await chatModel.trouverDemande(demandeId);

    if (!demande) {
        res.status(404).json({ message: "Demande introuvable." });
        return null;
    }

    const profil = role === "client"
        ? await clientModel.trouverClientParUserId(userId)
        : await artisanModel.trouverArtisanParUserId(userId);

    const proprietaire = role === "client"
        ? demande.client_id
        : demande.artisan_id;

    if (!profil || Number(profil.id) !== Number(proprietaire)) {
        res.status(404).json({ message: "Demande introuvable." });
        return null;
    }

    if (role === "artisan" &&
        profil.verification_statut !== "approuve") {
        res.status(403).json({ message: "Profil artisan non autorise." });
        return null;
    }

    return { demandeId, demande, role, profilId: profil.id };
}

// Le chat est accessible apres acceptation.
// Une demande annulee apres acceptation conserve son historique.
function historiqueAutorise(demande) {
    return STATUTS_HISTORIQUE.has(demande.statut) ||
        (demande.statut === "annulee" && Boolean(demande.date_traitement));
}

// Lire les messages de sa demande.
async function lireChat(req, res) {
    try {
        res.set("Cache-Control", "private, no-store");

        const acces = await verifierParticipant(req, res);
        if (!acces) return;

        if (!historiqueAutorise(acces.demande)) {
            return res.status(403).json({
                message: "Le chat sera disponible apres acceptation."
            });
        }

        const messages = await chatModel.listerMessages(acces.demandeId);

        return res.json({
            demandeId: acces.demandeId,
            lectureSeule: acces.demande.statut !== "acceptee",
            messages
        });
    } catch (error) {
        console.error("Erreur lecture chat :", error.message);
        return res.status(500).json({
            message: "Impossible de charger la conversation."
        });
    }
}

// Envoyer un message seulement si la demande est acceptee.
async function envoyerChat(req, res) {
    try {
        res.set("Cache-Control", "private, no-store");

        const acces = await verifierParticipant(req, res);
        if (!acces) return;

        if (acces.demande.statut !== "acceptee") {
            return res.status(403).json({
                message: "Cette conversation est fermee."
            });
        }

        if (typeof req.body?.contenu !== "string") {
            return res.status(400).json({
                message: "Message invalide."
            });
        }

        const contenu = req.body.contenu.trim();

        if (!contenu || contenu.length > 4000) {
            return res.status(400).json({
                message: "Le message doit contenir entre 1 et 4000 caracteres."
            });
        }

        const messageId = await chatModel.envoyerMessage(
            acces.demandeId,
            acces.role,
            acces.profilId,
            contenu
        );

        if (!messageId) {
            return res.status(409).json({
                message: "La demande ne permet plus cet envoi."
            });
        }

        return res.status(201).json({
            message: "Message envoye.",
            id: messageId
        });
    } catch (error) {
        console.error("Erreur envoi chat :", error.message);
        return res.status(500).json({
            message: "Impossible d'envoyer le message."
        });
    }
}

module.exports = { lireChat, envoyerChat };