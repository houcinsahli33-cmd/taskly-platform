// Ce fichier contient les routes réservées à l'administrateur.

const express = require("express");
const adminController = require("../controllers/adminController");
const adminSignalements = require("../controllers/adminSignalementsController");
const adminSupport = require("../controllers/adminSupportController");

const { verifierConnexion, verifierAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(verifierConnexion, verifierAdmin);

// Statistiques admin
router.get("/stats", adminController.statistiques);
router.get("/stats/inscriptions", adminController.inscriptionsParPeriode);

// Creer un service
router.post("/services", require('../middleware/documentUpload').upload.single('photo'), adminController.creerService);

// Modifier un service
router.put("/services/:id",require('../middleware/documentUpload').upload.single('photo'),adminController.modifierService);

// Supprimer un service
router.delete("/services/:id",adminController.supprimerService);

// Lister les utilisateurs
router.get("/users",adminController.listerUtilisateurs);

// Lister les signalements
router.get("/signalements",adminSignalements.lister);
router.get("/signalements/:id",adminSignalements.examiner);
router.patch("/signalements/:id",adminSignalements.modifier);
router.post("/signalements/:id/notifier",require("../middleware/securityMiddleware").limiter({fenetre:3600000,max:20}),adminSignalements.notifier);

// Bloquer un utilisateur
router.put("/users/:id/bloquer",adminController.bloquerUtilisateur);

// Debloquer un utilisateur
router.put("/users/:id/debloquer",adminController.debloquerUtilisateur);

// API moderne de traitement du support : routes privees et limitees.
router.get('/support/messages',adminSupport.lister);
router.get('/support/messages/:id',adminSupport.examiner);
router.patch('/support/messages/:id',adminSupport.modifier);
router.post('/support/messages/:id/reponses',require('../middleware/securityMiddleware').limiter({fenetre:3600000,max:20}),adminSupport.repondre);

// Lister les messages de contact/support
router.get("/contacts", adminController.listerMessagesContact);

// Marquer un message de contact comme traité
router.put("/contacts/:id/traiter", adminController.traiterMessageContact);

module.exports = router;