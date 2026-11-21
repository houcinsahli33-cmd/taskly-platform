// Ce fichier contient les routes liées aux demandes.
// Il définit les URLs permettant aux clients et artisans de gérer les demandes.

const express = require("express");
const demandeController = require("../controllers/demandeController");
const chatController = require("../controllers/chatController");
const { limiter, verifierCsrf } = require("../middleware/securityMiddleware");

const { verifierConnexion, verifierClient, verifierArtisan, verifierArtisanActif } = require("../middleware/authMiddleware");
const router = express.Router();

// Routes côté client
// Créer une demande
router.post("/", verifierConnexion, verifierClient, demandeController.creerDemande);

// Lister les demandes envoyées par le client connecté
router.get("/client", verifierConnexion, verifierClient, demandeController.listerDemandesClient);

router.get("/en-cours/:artisanId", verifierConnexion, verifierClient, demandeController.demandeOuverte);

// Annuler une demande encore en attente
router.put("/:id/annuler", verifierConnexion, verifierClient, demandeController.annulerDemandeClient);

// La clé de la carte est publique côté navigateur : la restreindre à l'origine Taskly et à l'API Embed.
router.get('/itineraire/config',verifierConnexion,verifierArtisan,verifierArtisanActif,(req,res)=>{
  res.set('Cache-Control','no-store, private');
  res.json({embedKey:process.env.GOOGLE_MAPS_EMBED_API_KEY||null});
});

// Routes côté artisan
// Lister les demandes reçues par l'artisan connecté
router.get("/artisan", verifierConnexion, verifierArtisan, verifierArtisanActif, demandeController.listerDemandesArtisan);

// Accepter ou refuser une demande
router.put("/:id/statut", verifierConnexion, verifierArtisan, verifierArtisanActif, demandeController.modifierStatutDemande);

// Annuler une demande acceptée avec un motif
router.put("/:id/annuler-artisan", verifierConnexion, verifierArtisan, verifierArtisanActif, demandeController.annulerDemandeArtisan);

router.put("/:id/demarrer", verifierConnexion, verifierArtisan, verifierArtisanActif, verifierCsrf, demandeController.demarrerDemande);

// Marquer une demande acceptée comme terminée
router.put("/:id/terminer", verifierConnexion, verifierArtisan, verifierArtisanActif, demandeController.terminerDemande);

// Le détail est réservé au profil artisan propriétaire de la demande.
router.get("/:id/details", verifierConnexion, verifierArtisan, verifierArtisanActif, demandeController.detailsArtisan);

// Confirmation e-mail : pas d'authentification requise, mais lien à usage unique.
// La protection CSRF générale reste active dans app.js.
router.post('/confirmation-lien', require('../middleware/securityMiddleware').limiter({max:8}), demandeController.confirmerDepuisEmail);
router.put('/:id/confirmer-fin', verifierConnexion, verifierClient, demandeController.confirmerFinClient);
router.put('/:id/contester-fin', verifierConnexion, verifierClient, demandeController.contesterFinClient);
// Messagerie privee liee a une demande.
if(process.env.TASKLY_CHAT_WORKSPACE_ENABLED==='true'){
 router.get('/chat/conversations',verifierConnexion,limiter({fenetre:60000,max:60}),chatController.listerConversations);
 router.get('/chat/unread',verifierConnexion,limiter({fenetre:60000,max:30}),chatController.nonLus);
 router.post('/chat/presence',verifierConnexion,verifierCsrf,limiter({fenetre:60000,max:4,parCompte:true}),chatController.signalerPresence);
 router.post('/:id/chat/read',verifierConnexion,verifierCsrf,limiter({fenetre:60000,max:60}),chatController.confirmerLecture);
}

if (
    process.env.TASKLY_CHAT_WORKSPACE_ENABLED === 'true' &&
    process.env.TASKLY_CHAT_CALLS_ENABLED === 'true'
) {
    router.get(
        '/chat/calls/incoming',
        verifierConnexion,
        limiter({fenetre:60000,max:20,parCompte:true}),
        chatController.appelsEntrants
    );


    if (process.env.TASKLY_LIVEKIT_ENABLED === 'true') {
        router.post(
            '/:id/chat/call/livekit-token',
            verifierConnexion,
            verifierCsrf,
            limiter({fenetre:60000,max:8,parCompte:true}),
            chatController.emettreJetonLiveKit
        );
    }

    router.get(
        '/:id/chat/call',
        verifierConnexion,
        limiter({fenetre:60000,max:90,parCompte:true}),
        chatController.gererAppel
    );

    router.post(
        '/:id/chat/call',
        verifierConnexion,
        verifierCsrf,
        limiter({fenetre:60000,max:20,parCompte:true}),
        chatController.gererAppel
    );
}
// Historique durable des appels : fonctionnalite inactive par defaut.
if (process.env.TASKLY_CHAT_WORKSPACE_ENABLED === 'true' &&
    process.env.TASKLY_CHAT_CALL_HISTORY_ENABLED === 'true') {
    router.get('/:id/chat/calls/history',verifierConnexion,
        limiter({fenetre:60000,max:30,parCompte:true}),chatController.historiqueAppels);
}
// Activation après création de taskly_chat_attachments dans TiDB et déploiement du code.
if(process.env.TASKLY_CHAT_ATTACHMENTS_ENABLED==='true'){
 const chatFiles=require('../controllers/chatAttachmentsController');
 router.post('/:id/chat/attachment',verifierConnexion,verifierCsrf,limiter({fenetre:60000,max:8,parCompte:true}),chatFiles.recevoir,chatFiles.envoyer);
 router.get('/:id/chat/attachment/:messageId',verifierConnexion,limiter({fenetre:60000,max:60}),chatFiles.telecharger);
}
router.get("/:id/chat", verifierConnexion, chatController.lireChat);
router.post("/:id/chat", verifierConnexion, verifierCsrf, limiter({fenetre:60000,max:15}), chatController.envoyerChat);
module.exports = router;
