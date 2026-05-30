// Ce fichier contient les routes réservées à l'administrateur.

const express = require("express");
const adminController = require("../controllers/adminController");

const { verifierConnexion, verifierAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(verifierConnexion, verifierAdmin);

// Statistiques admin
router.get("/stats", adminController.statistiques);

// Creer un service
router.post("/services", adminController.creerService);

// Modifier un service
router.put("/services/:id",adminController.modifierService);

// Supprimer un service
router.delete("/services/:id",adminController.supprimerService);

// Lister les utilisateurs
router.get("/users",adminController.listerUtilisateurs);

// Lister les signalements
router.get("/signalements",adminController.listerSignalements);

// Bloquer un utilisateur
router.put("/users/:id/bloquer",adminController.bloquerUtilisateur);

// Debloquer un utilisateur
router.put("/users/:id/debloquer",adminController.debloquerUtilisateur);

module.exports = router;