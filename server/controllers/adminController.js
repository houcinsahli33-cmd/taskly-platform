// Ce fichier permet de récupérer les statistiques et de gérer les services.

const adminModel = require("../models/adminModel");
const serviceModel = require("../models/serviceModel");

// Stats generales de l'application
async function statistiques(req, res) {
    try {
        const [
            totalUsers,
            totalClients,
            totalArtisans,
            totalServices,
            totalDemandes,
            totalAvis,
            totalSignalements,
            demandesParStatut,
            derniersUtilisateurs,
            dernieresDemandes,
            derniersAvis
        ] = await Promise.all([
            adminModel.compter("users"),
            adminModel.compter("clients"),
            adminModel.compter("artisans"),
            adminModel.compter("services"),
            adminModel.compter("demandes"),
            adminModel.compter("avis"),
            adminModel.compter("signalements"),
            adminModel.demandesParStatut(),
            adminModel.derniersUtilisateurs(),
            adminModel.dernieresDemandes(),
            adminModel.derniersAvis()
        ]);

        res.status(200).json({
            statistiques: {
                totalUsers,
                totalClients,
                totalArtisans,
                totalServices,
                totalDemandes,
                totalAvis,
                totalSignalements
            },
            demandesParStatut,
            derniersUtilisateurs,
            dernieresDemandes,
            derniersAvis
        });
    } catch (error) {
        console.error("Erreur statistiques admin :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Creer un service
async function creerService(req, res) {
    try {
        const { nom, description, image } = req.body;

        if (!nom || !description) {
            return res.status(400).json({
                message: "Nom du service et description sont obligatoires."
            });
        }

        const resultat = await serviceModel.creerService(nom, description, image || null);
        
        res.status(201).json({
            message: "Service créé avec succès.",
            serviceId: resultat.insertId
        });
    } catch (error) {
        console.error("Erreur création service :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Modifier un service
async function modifierService(req, res) {
    try {
        const {nom, description, image } = req.body;

        if (!nom || !description) {
            return res.status(400).json({
                message: "Nom du service et description sont obligatoires."
            });
        }

        const resultat = await serviceModel.modifierService(req.params.id, nom, description, image || null);

        if (resultat.affectedRows === 0) {
            return res.status(404).json({
                message: "Service introuvable."
            });
        } else {
            res.status(200).json({
                message: "Service modifié avec succès."
            });
        }

    } catch (error) {
        console.error("Erreur modification service :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Supprimer un service
async function supprimerService(req, res) {
    try {
        const resultat = await serviceModel.supprimerService(req.params.id);

        if (resultat.affectedRows === 0) {
            return res.status(404).json({
                message: "Service introuvable."
            });
        } else {
            res.status(200).json({
            message: "Service supprimé avec succès."
            });
        }

    } catch (error) {
        console.error("Erreur suppression service :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Lister les utilisateurs
async function listerUtilisateurs(req, res) {
    try {
        const utilisateurs = await adminModel.listerUtilisateurs();

        res.status(200).json({
            utilisateurs
        });

    } catch (error) {
        console.error("Erreur liste utilisateurs admin :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Lister les signalements
async function listerSignalements(req, res) {
    try {
        const signalements = await adminModel.listerSignalements();

        res.status(200).json({
            signalements
        });

    } catch (error) {
        console.error("Erreur liste signalements admin :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Bloquer un utilisateur
async function bloquerUtilisateur(req, res) {
    try {
        const { motifBlocage } = req.body;

        if (!motifBlocage || motifBlocage.trim().length < 5) {
            return res.status(400).json({
                message: "Le motif du blocage est obligatoire."
            });
        }

        const utilisateur = await adminModel.trouverUtilisateurParId(req.params.id);

        if (!utilisateur) {
            return res.status(404).json({
                message: "Utilisateur introuvable."
            });
        }

        if (utilisateur.role === "admin") {
            return res.status(400).json({
                message: "Impossible de bloquer un administrateur."
            });
        }

        const resultat = await adminModel.bloquerUtilisateur(
            req.params.id,
            motifBlocage.trim()
        );

        if (resultat.affectedRows === 0) {
            return res.status(400).json({
                message: "Blocage impossible."
            });
        }

        res.status(200).json({
            message: "Utilisateur bloqué avec succès."
        });

    } catch (error) {
        console.error("Erreur blocage utilisateur :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Débloquer un utilisateur
async function debloquerUtilisateur(req, res) {
    try {
        const utilisateur = await adminModel.trouverUtilisateurParId(req.params.id);

        if (!utilisateur) {
            return res.status(404).json({
                message: "Utilisateur introuvable."
            });
        }

        if (utilisateur.role === "admin") {
            return res.status(400).json({
                message: "Impossible de débloquer un administrateur."
            });
        }

        const resultat = await adminModel.debloquerUtilisateur(req.params.id);

        if (resultat.affectedRows === 0) {
            return res.status(400).json({
                message: "Déblocage impossible."
            });
        }

        res.status(200).json({
            message: "Utilisateur débloqué avec succès."
        });

    } catch (error) {
        console.error("Erreur déblocage utilisateur :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

module.exports = {
    statistiques,
    creerService,
    modifierService,
    supprimerService,
    listerUtilisateurs,
    listerSignalements,
    bloquerUtilisateur,
    debloquerUtilisateur
};