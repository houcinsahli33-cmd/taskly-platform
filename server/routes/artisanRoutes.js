// Routes liées aux artisans

const express = require("express");
const artisanController = require("../controllers/artisanController");

const {
    verifierConnexion,
    verifierClient,
    verifierArtisan
} = require("../middleware/authMiddleware");

const {
    limiterCoordonneesArtisan
} = require("../middleware/artisanContactLimiter");

const router = express.Router();

// Carte publique
router.get('/carte', artisanController.artisansCarte);

// Gestion de la disponibilite de l'espace actif.
router.get('/ma-disponibilite', verifierConnexion, verifierArtisan, artisanController.lireDisponibilite);
router.put('/ma-disponibilite', verifierConnexion, verifierArtisan, artisanController.enregistrerDisponibilite);

// Gestion de la zone publique
router.get('/ma-zone',
    verifierConnexion,
    verifierArtisan,
    artisanController.lireEtatZone
);

router.put('/ma-zone',
    verifierConnexion,
    verifierArtisan,
    artisanController.enregistrerZone
);

router.delete('/ma-zone',
    verifierConnexion,
    verifierArtisan,
    artisanController.supprimerZone
);

// Liste publique des artisans
router.get("/", artisanController.listerArtisans);

// Disponibilités de l'artisan
router.get('/:id/dates-indisponibles',
    verifierConnexion,
    verifierClient,
    artisanController.datesIndisponibles
);

// Consultation sécurisée des coordonnées
router.get('/:id/coordonnees',
    verifierConnexion,
    verifierClient,
    limiterCoordonneesArtisan,
    artisanController.coordonneesArtisan
);

// Détails publics de l'artisan
router.get("/:id", artisanController.detailArtisan);

module.exports = router;
