// Ce fichier contient la logique métier liée aux demandes.
// Il vérifie les données, récupère le client ou l'artisan connecté puis appelle demandeModel pour communiquer avec MySQL.

const demandeModel = require("../models/demandeModel");
const clientModel = require("../models/clientModel");
const artisanModel = require("../models/artisanModel");

// Récupérer le profil client lie à l'utilisateur connecte
async function obtenirClientConnecte(req, res) {
    const userId = req.session.utilisateur.id;
    const client = await clientModel.trouverClientParUserId(userId);

    if (!client) {
        res.status(404).json({
            message: "Profil client introuvable."
        });

        return null;
    }
    return client;
}

// Récupérer le profil artisan lie à l'utilisateur connecte
async function obtenirArtisanConnecte(req, res) {
    const userId = req.session.utilisateur.id;

    const artisan = await artisanModel.trouverArtisanParUserId(userId);

    if (!artisan) {
        res.status(404).json({
            message: "Profil artisan introuvable."
        });

        return null;
    }

    return artisan;
}

// Creer une demande par un client
async function creerDemande(req, res) {
    try {
        const { artisanId, message, adresse, dateSouhaitee } = req.body;
        
        if (!artisanId || !message || !adresse) {
            return res.status(400).json({
                message: "Certains champs sont obligatoires."
            });
        }

        const client = await obtenirClientConnecte(req, res);

        if (!client) {
            return;
        }

        const artisan = await artisanModel.trouverArtisanParId(artisanId);

        if (!artisan) {
            return res.status(404).json({
            message: "Artisan introuvable."
            });
        }

        const resultat = await demandeModel.creerDemande(
            client.id,
            artisanId,
            message,
            adresse,
            dateSouhaitee || null
        );

        res.status(201).json({
            message: "Demande envoyée avec succès.",
            demandeId: resultat.insertId
        });

    } catch (error) {
        console.error("Erreur création demande :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Lister les demandes envoyees par le client
async function listerDemandesClient(req, res) {
    try {
        const client = await obtenirClientConnecte(req, res);

        if (!client) {
            return;
        }

        const demandes = await demandeModel.listerDemandesClient(client.id);

        res.status(200).json({
            demandes
        });

    } catch (error) {
        console.error("Erreur lors de la liste des demandes du client :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Lister les demandes recues par l'artisan 
async function listerDemandesArtisan(req, res) {
    try {
        const artisan = await obtenirArtisanConnecte(req, res);

        if (!artisan) {
            return;
        }

        const demandes = await demandeModel.listerDemandesArtisan(artisan.id);

        res.status(200).json({
            demandes
        });

    } catch (error) {
        console.error("Erreur lors de la liste des demandes de l'artisan :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Accepter ou refuser une demande par un artisan
async function modifierStatutDemande(req, res) {
    try {
        const { statut } = req.body;

        if (statut !== "acceptee" && statut !== "refusee") {
            return res.status(400).json({
                message: "Statut invalide."
            });
        }

        const artisan = await obtenirArtisanConnecte(req, res);

        if (!artisan) {
            return;
        }

        const resultat = await demandeModel.modifierStatutDemande(
            req.params.id,
            artisan.id,
            statut
        );

        if (resultat.affectedRows === 0) {
            return res.status(400).json({
                message: "Modification impossible pour cette demande."
            });
        }

        res.status(200).json({
            message: "Statut mis à jour avec succès."
        });

    } catch (error) {
        console.error("Erreur modification statut demande :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Annuler une demande par un client
async function annulerDemandeClient(req, res) {
    try {
        const client = await obtenirClientConnecte(req, res);

        if (!client) {
            return;
        }

        const resultat = await demandeModel.annulerDemandeClient(
            req.params.id,
            client.id
        );

        if (resultat.affectedRows === 0) {
            return res.status(400).json({
                message: "Annulation impossible pour cette demande."
            });
        }

        res.status(200).json({
            message: "Demande annulée avec succès."
        });

    } catch (error) {
        console.error("Erreur annulation demande client :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Annuler une demande acceptee
async function annulerDemandeArtisan(req, res) {
    try {
        const { motifAnnulation } = req.body;

        if (!motifAnnulation || motifAnnulation.trim().length < 5) {
            return res.status(400).json({
                message: "Motif d'annulation obligatoire."
            });
        }

        const artisan = await obtenirArtisanConnecte(req, res);

        if (!artisan) {
            return;
        }

        const resultat = await demandeModel.annulerDemandeArtisan(
            req.params.id,
            artisan.id,
            motifAnnulation.trim()
        );

        if (resultat.affectedRows === 0) {
            return res.status(400).json({
                message: "Annulation artisan impossible pour cette demande."
            });
        }

        res.status(200).json({
            message: "Demande annulée par l'artisan."
        });

    } catch (error) {
        console.error("Erreur annulation demande artisan :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Marquer une demande comme terminee
async function terminerDemande(req, res) {
    try {
        const artisan = await obtenirArtisanConnecte(req, res);

        if (!artisan) {
            return;
        }

        const resultat = await demandeModel.terminerDemande(
            req.params.id,
            artisan.id
        );

        if (resultat.affectedRows === 0) {
            return res.status(400).json({
                message: "Cette demande ne peut pas être terminée."
            });
        }

        res.status(200).json({
            message: "Travail marqué comme terminé."
        });

    } catch (error) {
        console.error("Erreur finalisation demande :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

module.exports = {
    creerDemande,
    listerDemandesClient,
    listerDemandesArtisan,
    modifierStatutDemande,
    annulerDemandeClient,
    annulerDemandeArtisan,
    terminerDemande
};
