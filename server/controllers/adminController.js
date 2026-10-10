// Ce fichier permet de rÃ©cupÃ©rer les statistiques et de gÃ©rer les services.

const adminModel = require("../models/adminModel");
const serviceModel = require("../models/serviceModel");

// Stats generales de l'application
async function statistiques(req, res) {
    // Un défaut du support ne doit pas vider l'ensemble de la page d'accueil admin.
    const taches = {
        totalUsers: () => adminModel.compter('users'),
        totalClients: () => adminModel.compter('clients'),
        totalArtisans: () => adminModel.compter('artisans'),
        totalServices: () => adminModel.compter('services'),
        totalDemandes: () => adminModel.compter('demandes'),
        totalAvis: () => adminModel.compter('avis'),
        totalSignalements: () => adminModel.compter('signalements'),
        totalContactsSupport: () => adminModel.compter('contacts_support'),
        demandesParStatut: () => adminModel.demandesParStatut(),
        derniersUtilisateurs: () => adminModel.derniersUtilisateurs(),
        dernieresDemandes: () => adminModel.dernieresDemandes(),
        derniersAvis: () => adminModel.derniersAvis(),
        derniersContactsSupport: () => adminModel.derniersMessagesContact()
    };
    const noms = Object.keys(taches);
    const resultats = await Promise.allSettled(noms.map(nom => taches[nom]()));
    const valeurs = {}, erreurs = [];
    resultats.forEach((resultat, index) => {
        const nom = noms[index];
        if (resultat.status === 'fulfilled') {
            valeurs[nom] = resultat.value;
        } else {
            // Identifiants de rubriques uniquement : ne pas envoyer les erreurs SQL au navigateur.
            erreurs.push(nom);
            valeurs[nom] = nom.startsWith('total') ? null : [];
            console.error('Erreur module statistiques admin [' + nom + '] :',
                resultat.reason?.code || resultat.reason?.message || 'indisponible');
        }
    });
    if (erreurs.length === noms.length) {
        return res.status(503).json({message: 'Statistiques indisponibles. Vérifiez la connexion MySQL et les migrations.'});
    }
    const statistiques = Object.fromEntries(noms.filter(nom => nom.startsWith('total'))
        .map(nom => [nom, valeurs[nom]]));
    res.status(200).json({
        statistiques,
        demandesParStatut: valeurs.demandesParStatut,
        derniersUtilisateurs: valeurs.derniersUtilisateurs,
        dernieresDemandes: valeurs.dernieresDemandes,
        derniersAvis: valeurs.derniersAvis,
        derniersContactsSupport: valeurs.derniersContactsSupport,
        modulesIndisponibles: erreurs
    });
}

// Creer un service
async function creerService(req, res) {
    try {
        const { nom, description } = req.body;
        if(typeof nom!=="string" || !nom.trim() || nom.length>255 || typeof description!=="string" || !description.trim() || description.length>10000) return res.status(400).json({message:"Nom ou description invalide."});
        const image = req.file ? "/api/media/" + await require("../services/fileStorage").enregistrer(req.file,false) : null;

        if (!nom || !description) {
            return res.status(400).json({
                message: "Nom du service et description sont obligatoires."
            });
        }

        const resultat = await serviceModel.creerService(nom, description, image || null);
        
        res.status(201).json({
            message: "Service crÃ©Ã© avec succÃ¨s.",
            serviceId: resultat.insertId
        });
    } catch (error) {
        console.error("Erreur crÃ©ation service :", error.message);

        res.status(error.status || 500).json({
            message: error.status ? error.message : "Erreur serveur."
        });
    }
}

// Modifier un service
async function modifierService(req, res) {
    try {
        const {nom, description } = req.body;
        if(typeof nom!=="string" || !nom.trim() || nom.length>255 || typeof description!=="string" || !description.trim() || description.length>10000) return res.status(400).json({message:"Nom ou description invalide."});
        const ancien = await serviceModel.trouverServiceParId(req.params.id);
        if (!ancien) return res.status(404).json({message:"Service introuvable."});
        const image = req.file ? "/api/media/" + await require("../services/fileStorage").enregistrer(req.file,false) : ancien.image;

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
                message: "Service modifiÃ© avec succÃ¨s."
            });
        }

    } catch (error) {
        console.error("Erreur modification service :", error.message);

        res.status(error.status || 500).json({
            message: error.status ? error.message : "Erreur serveur."
        });
    }
}

// Supprimer un service
async function supprimerService(req, res) {
    try {
        const [liens] = await require('../config/db').promise().query('SELECT id FROM artisans WHERE service_id=? LIMIT 1',[req.params.id]);
        if (liens.length) return res.status(409).json({message:'Ce service est utilisÃ© par des artisans. Modifiez-le plutÃ´t que le supprimer.'});
        const resultat = await serviceModel.supprimerService(req.params.id);

        if (resultat.affectedRows === 0) {
            return res.status(404).json({
                message: "Service introuvable."
            });
        } else {
            res.status(200).json({
            message: "Service supprimÃ© avec succÃ¨s."
            });
        }

    } catch (error) {
        console.error("Erreur suppression service :", error.message);

        res.status(error.status || 500).json({
            message: error.status ? error.message : "Erreur serveur."
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

        res.status(error.status || 500).json({
            message: error.status ? error.message : "Erreur serveur."
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

        res.status(error.status || 500).json({
            message: error.status ? error.message : "Erreur serveur."
        });
    }
}

// Bloquer un utilisateur
async function bloquerUtilisateur(req, res) {
    try {
        const { motifBlocage } = req.body;

        if (typeof motifBlocage !== "string" || motifBlocage.trim().length < 5 || motifBlocage.trim().length > 500) {
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

        if (utilisateur.role === 'artisan') {
            return res.status(409).json({message:'Pour un artisan, utilisez « Examiner le dossier » dans la vérification des artisans.'});
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
            message: "Utilisateur bloquÃ© avec succÃ¨s."
        });

    } catch (error) {
        console.error("Erreur blocage utilisateur :", error.message);

        res.status(error.status || 500).json({
            message: error.status ? error.message : "Erreur serveur."
        });
    }
}

// DÃ©bloquer un utilisateur
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
                message: "Impossible de dÃ©bloquer un administrateur."
            });
        }

        if (utilisateur.role === 'artisan') {
            return res.status(409).json({message:'Pour un artisan, utilisez « Examiner le dossier » dans la vérification des artisans.'});
        }

        const resultat = await adminModel.debloquerUtilisateur(req.params.id);

        if (resultat.affectedRows === 0) {
            return res.status(400).json({
                message: "DÃ©blocage impossible."
            });
        }

        res.status(200).json({
            message: "Utilisateur dÃ©bloquÃ© avec succÃ¨s."
        });

    } catch (error) {
        console.error("Erreur dÃ©blocage utilisateur :", error.message);

        res.status(error.status || 500).json({
            message: error.status ? error.message : "Erreur serveur."
        });
    }
}

// Lister les messages envoyes au support
async function listerMessagesContact(req, res) {
    try {
        const { statut } = req.query;

        if (statut && statut !== "nouveau" && statut !== "traite") {
            return res.status(400).json({
                message: "Statut invalide."
            });
        }

        const contacts = await adminModel.listerMessagesContact(statut);

        res.status(200).json({
            contacts
        });

    } catch (error) {
        console.error("Erreur liste contacts support :", error.code || error.message);
        res.status(error.code === 'ER_NO_SUCH_TABLE' ? 503 : (error.status || 500)).json({
            message: error.code === 'ER_NO_SUCH_TABLE'
                ? 'Module support non installé dans MySQL. Vérifiez la table contacts_support.'
                : (error.status ? error.message : 'Messages support indisponibles. Consultez les logs du serveur.')
        });
    }
}

// Marquer un message de contact comme traite
async function traiterMessageContact(req, res) {
    try {
        const resultat = await adminModel.traiterMessageContact(req.params.id);

        if (resultat.affectedRows === 0) {
            return res.status(404).json({
                message: "Message de contact introuvable."
            });
        }

        res.status(200).json({
            message: "Message marquÃ© comme traitÃ©."
        });

    } catch (error) {
        console.error("Erreur traitement contact support :", error.message);

        res.status(error.status || 500).json({
            message: error.status ? error.message : "Erreur serveur."
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
    debloquerUtilisateur,
    listerMessagesContact,
    traiterMessageContact
};