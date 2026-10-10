// Ce fichier vérifie que le client a le droit de laisser un avis avant d'appeler le model.

const avisModel = require("../models/avisModel");
const clientModel = require("../models/clientModel");
const artisanModel = require("../models/artisanModel");

// Créer un avis par un client
async function creerAvis (req, res) {
    try {
        const { demandeId, note, commentaire } = req.body;
        const noteNombre = Number(note);

        if (!demandeId || !noteNombre || noteNombre < 1 || noteNombre > 5) {
            return res.status(400).json({
                message: "La demande est obligatoire."
            });
        }

        const client = await clientModel.trouverClientParUserId(req.session.utilisateur.id);

        if (!client) {
            return res.status(404).json({
                message: "Profil client introuvable."
            });
        }

        const demande = await avisModel.trouverDemandeTermineeClient(demandeId, client.id);

        if (!demande) {
            return res.status(400).json({
                message: "Vous pouvez laisser un avis uniquement sur une demande terminée."
            });
        }

        const avisExistant = await avisModel.trouverAvisParDemande(demandeId);

        if (avisExistant) {
            return res.status(400).json({
                message: "Un avis existe déjà pour cette demande."
            });
        }

        await avisModel.creerAvis(demandeId, client.id, demande.artisan_id, noteNombre, commentaire || null);

        res.status(201).json({
            message: "Votre avis est ajouté avec succès."
        });

    } catch (error) {
        console.error("Erreur lors de la création de l'avis :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Lister les avis publics d'un artisan
async function listerAvisArtisan(req, res) {
    try {
        const artisan = await artisanModel.trouverArtisanParId(req.params.artisanId);

        if (!artisan) {
            return res.status(404).json({
                message: "Artisan introuvable."
            });
        }

        const avis = await avisModel.listerAvisArtisan(req.params.artisanId);
        const statistiques = await avisModel.statistiquesAvisArtisan(req.params.artisanId);

        res.status(200).json({
            avis,
            statistiques
        });

    } catch (error) {
        console.error("Erreur lors de la liste des avis artisan :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

module.exports = {
    creerAvis,
    listerAvisArtisan
};