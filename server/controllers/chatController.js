"use strict";

const chatModel = require("../models/chatModel");
const callsPilot = require("../services/chatCallPilot");
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
    lectureSeule: acces.demande.statut !== "acceptee" || Number(acces.demande.messagerie_bloquee) === 1,
    informations: {
        clientNom: acces.demande.client_nom || null,
        artisanNom: acces.demande.artisan_nom || null,
        artisanId: acces.demande.artisan_id || null,
        serviceNom: acces.demande.service_nom || null,
        statut: acces.demande.statut,
        dateSouhaitee: acces.demande.date_souhaitee || null,
        adresse: acces.demande.adresse || null,
        clientTelephone: acces.demande.client_telephone || null,
        artisanTelephone: acces.demande.artisan_telephone || null
    },
    messages,
    piecesJointesActives: typeof process !== 'undefined' && process.env?.TASKLY_CHAT_ATTACHMENTS_ENABLED === 'true'
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

        if (Number(acces.demande.messagerie_bloquee) === 1) {
            return res.status(403).json({ message: "La messagerie est désactivée par l’artisan." });
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

// Accès au catalogue privé (ni recherche globale de personnes, ni contact hors demande).
async function profilChat(req,res){
 const role=req.session?.utilisateur?.role,id=req.session?.utilisateur?.id;
 if(!['client','artisan'].includes(role)||!id){res.status(403).json({message:'Accès refusé.'});return null;}
 const p=role==='client'?await clientModel.trouverClientParUserId(id):await artisanModel.trouverArtisanParUserId(id);
 if(!p||(role==='artisan'&&p.verification_statut!=='approuve')){res.status(403).json({message:'Profil non autorisé.'});return null;}
 return {role,id:p.id};
}
async function listerConversations(req,res){
 try{res.set('Cache-Control','private, no-store');const p=await profilChat(req,res);if(!p)return;
  const q=req.query.q??'',offset=Number(req.query.offset??0),unread=req.query.unread??'0';
  if(typeof q!=='string'||q.length>100||!Number.isSafeInteger(offset)||offset<0||offset>100000||!['0','1'].includes(unread))return res.status(400).json({message:'Recherche invalide.'});
  return res.json(await chatModel.conversations(p.role,p.id,{q:q.trim(),offset,unread:unread==='1'}));
 }catch(e){console.error('Conversations :',e.code||e.name);return res.status(503).json({message:'Conversations indisponibles.'});}
}
async function nonLus(req,res){
 try{res.set('Cache-Control','private, no-store');const p=await profilChat(req,res);if(!p)return;return res.json({total:await chatModel.compterNonLus(p.role,p.id)});}
 catch(e){return res.status(503).json({message:'Notifications indisponibles.'});}
}
async function confirmerLecture(req,res){
 try{res.set('Cache-Control','private, no-store');const id=req.body?.throughId;
  if(typeof id!=='string'||!/^[1-9][0-9]{0,18}$/.test(id)||BigInt(id)>9223372036854775807n)return res.status(400).json({message:'Message invalide.'});
  const a=await verifierParticipant(req,res);if(!a)return;if(!historiqueAutorise(a.demande))return res.status(403).json({message:'Conversation indisponible.'});
  // Le curseur doit désigner un message réel de cette conversation, jamais une valeur arbitraire.
  const messages=await chatModel.listerMessages(a.demandeId);
  if(!messages.some(m=>String(m.id)===id&&m.auteur_type!==a.role))return res.status(409).json({message:'Actualisez la conversation.'});
  return res.json({lus:await chatModel.marquerLus(a.demandeId,a.role,a.profilId,id)});
 }catch(e){return res.status(503).json({message:'Lecture non enregistrée.'});}
}

async function gererAppel(req, res) {
    try {
        res.set('Cache-Control', 'private, no-store');

        if (!callsPilot.autoriseCompte(
            req.session?.utilisateur?.role,
            req.session?.utilisateur?.id
        )) {
            return res.status(404).json({
                message: 'Service indisponible.'
            });
        }

        const acces = await verifierParticipant(req, res);

        if (!acces) return;

        if (acces.demande.statut !== 'acceptee') {
            return res.status(403).json({
                message: 'Les appels necessitent une demande acceptee.'
            });
        }

        if (!callsPilot.autoriseDemande(acces.demandeId)) {
            return res.status(404).json({
                message: 'Appel indisponible.'
            });
        }

        const action = req.method === 'GET'
            ? 'read'
            : req.body?.action;

        if (req.method !== 'GET' &&
            !['start', 'accept', 'reject', 'end', 'heartbeat'].includes(action)) {
            return res.status(400).json({
                message: 'Action invalide.'
            });
        }

        if (Number(acces.demande.messagerie_bloquee) === 1) {
            if (action === 'read') return res.json({call:null});
            if (['start','accept','heartbeat'].includes(action)) {
                return res.status(403).json({message:'Les appels sont désactivés par l’artisan.'});
            }
        }

        if (callsPilot.modeGeneral() &&
            !(await chatModel.participantsAppelActifs(
                acces.demandeId
            ))) {
            return res.status(403).json({
                message: 'Participants non autorises.'
            });
        }

        if (action === 'start' && !callsPilot.modeGeneral()) {

            const [client, artisan] = await Promise.all([
                clientModel.trouverClientParUserId(
                    callsPilot.compteId('client')
                ),
                artisanModel.trouverArtisanParUserId(
                    callsPilot.compteId('artisan')
                )
            ]);

            if (!client || !artisan ||
                artisan.verification_statut !== 'approuve' ||
                Number(client.id) !== Number(acces.demande.client_id) ||
                Number(artisan.id) !== Number(acces.demande.artisan_id)) {
                return res.status(404).json({
                    message: 'Appel indisponible.'
                });
            }
        }

        const service = require('../services/chatCallService');

        const result = await service.signaler({
            demandeId: acces.demandeId,
            role: acces.role,
            clientId: acces.demande.client_id,
            artisanId: acces.demande.artisan_id
        }, action, req.method === 'GET' ? {} : req.body);

        if (action === 'start' &&
            result.code === 201 &&
            result.call?.id) {

            try {
                await require('../services/chatCallInbox')
                    .indexerInvitation({
                        demandeId: acces.demandeId,
                        role: acces.role,
                        clientId: acces.demande.client_id,
                        artisanId: acces.demande.artisan_id
                    });

            } catch {
                await service.signaler({
                    demandeId: acces.demandeId,
                    role: acces.role,
                    clientId: acces.demande.client_id,
                    artisanId: acces.demande.artisan_id
                }, 'end', {
                    id: result.call.id
                }).catch(() => {});

                return res.status(503).json({
                    message: 'Invitation indisponible.'
                });
            }
        }


        // Historique des appels (optionnel) : aucune erreur SQL ne coupe LiveKit.
        if (typeof process !== 'undefined' &&
            process.env?.TASKLY_CHAT_CALL_HISTORY_ENABLED === 'true' &&
            result.call && [200,201].includes(result.code) &&
            (['start','accept','reject','end'].includes(action) ||
             (action === 'heartbeat' && result.call.state === 'ended'))) {
            try {
                await require('../services/chatCallHistory').enregistrerTransition(
                    { demandeId: acces.demandeId, role: acces.role }, action, result
                );
            } catch {
                console.error('Historique Taskly : ecriture indisponible.');
            }
        }

        // nettoyage immediat LiveKit apres raccrochage
        if (
            action === 'end' &&
            result.code === 200 &&
            result.call?.state === 'ended' &&
            result.call?.livekitIssued === true &&
            process.env.TASKLY_LIVEKIT_ENABLED === 'true' &&
            process.env.TASKLY_LIVEKIT_CLEANUP_ENABLED === 'true'
        ) {
            try {
                await require('../services/livekitCleanupWorker')
                    .traiterFermeturesLiveKit({ limite: 5 });
            } catch {
                // La tache reste enregistree dans Redis.
                console.error(
                    'Taskly LiveKit : nettoyage reporte.'
                );
            }
        }

        return res.status(result.code).json({
            message: result.message,
            call: result.call,
            ...(req.method === 'GET' &&
                process.env.TASKLY_LIVEKIT_ENABLED === 'true' &&
                process.env.TASKLY_LIVEKIT_BROWSER_ENABLED === 'true'
                ? { livekitEnabled: true }
                : {})
        });

    } catch (error) {
        console.error('Taskly appels : erreur interne.');

        return res.status(503).json({
            message: 'Service appels temporairement indisponible.'
        });
    }
}



async function emettreJetonLiveKit(req, res) {
    try {
        res.set('Cache-Control', 'private, no-store');

        if (process.env.TASKLY_LIVEKIT_ENABLED !== 'true' ||
            process.env.TASKLY_LIVEKIT_BROWSER_ENABLED !== 'true') {
            return res.status(404).json({
                message: 'Service indisponible.'
            });
        }

        if (!callsPilot.autoriseCompte(
            req.session?.utilisateur?.role,
            req.session?.utilisateur?.id
        )) {
            return res.status(404).json({
                message: 'Service indisponible.'
            });
        }

        const acces = await verifierParticipant(req, res);
        if (!acces) return;

        if (acces.demande.statut !== 'acceptee' ||
            Number(acces.demande.messagerie_bloquee) === 1) {
            return res.status(403).json({
                message: 'Appels non autorises.'
            });
        }

        if (!callsPilot.autoriseDemande(acces.demandeId)) {
            return res.status(404).json({
                message: 'Service indisponible.'
            });
        }

        if (callsPilot.modeGeneral() &&
            !(await chatModel.participantsAppelActifs(
                acces.demandeId
            ))) {
            return res.status(403).json({
                message: 'Participants non autorises.'
            });
        }

        const appelId = req.body?.id;

        if (typeof appelId !== 'string' ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(appelId)) {
            return res.status(400).json({
                message: 'Identifiant invalide.'
            });
        }

        const service = require('../services/chatCallService');

        const etat = await service.signaler({
            demandeId: acces.demandeId,
            role: acces.role,
            clientId: acces.demande.client_id,
            artisanId: acces.demande.artisan_id
        }, 'read');

        if (etat.code !== 200) {
            return res.status(503).json({
                message: 'Verification de l appel indisponible.'
            });
        }

        const call = etat.call;

        if (!call ||
            call.state !== 'accepted' ||
            call.transport !== 'livekit' ||
            call.id !== appelId ||
            !['audio', 'video'].includes(call.mode)) {
            return res.status(409).json({
                message: 'Appel non actif.'
            });
        }

        const { creerJetonLiveKit } =
            require('../services/livekitTokenService');

        const jeton = await creerJetonLiveKit({
            demandeId: acces.demandeId,
            appelId: call.id,
            role: acces.role,
            profilId: acces.profilId,
            mode: call.mode
        });

        const marquage = await service.signaler({
            demandeId: acces.demandeId,
            role: acces.role,
            clientId: acces.demande.client_id,
            artisanId: acces.demande.artisan_id
        }, 'livekit', { id: call.id });

        if (marquage.code !== 200) {
            return res.status(
                [404, 409].includes(marquage.code) ? 409 : 503
            ).json({
                message: 'Appel non disponible.'
            });
        }

        return res.status(200).json(jeton);

    } catch (error) {
        console.error('Taskly LiveKit : delivrance impossible.');

        return res.status(503).json({
            message: 'LiveKit temporairement indisponible.'
        });
    }
}

async function appelsEntrants(req, res) {

    try {

        res.set('Cache-Control', 'private, no-store');

        if (!callsPilot.autoriseCompte(
            req.session?.utilisateur?.role,
            req.session?.utilisateur?.id
        )) {
            return res.status(404).json({
                message: 'Service indisponible.'
            });
        }

        const profil = await profilChat(req, res);

        if (!profil) return;

        const candidates = await require(
            '../services/chatCallInbox'
        ).invitations(profil.role, profil.id);

        const appels = [];

        for (const call of candidates) {

            if (!callsPilot.autoriseDemande(call.demandeId)) {
                continue;
            }

            const demande = await chatModel.trouverDemande(
                call.demandeId
            );

            if (!demande ||
                demande.statut !== 'acceptee' ||
                Number(demande.messagerie_bloquee) === 1 ||
                Number(demande.client_id) !== call.clientId ||
                Number(demande.artisan_id) !== call.artisanId) {
                continue;
            }

            if (callsPilot.modeGeneral() &&
                !(await chatModel.participantsAppelActifs(
                    call.demandeId
                ))) continue;

            appels.push({
                id: call.id,
                demandeId: call.demandeId,
                mode: call.mode,
                startedAt: call.startedAt,
                nom: (
                    profil.role === 'client'
                    ? demande.artisan_nom
                    : demande.client_nom
                ) || 'Interlocuteur'
            });
        }

        return res.json({ appels });

    } catch {
        return res.status(503).json({
            message: 'Notifications appels indisponibles.'
        });
    }
}
async function historiqueAppels(req, res) {
    try {
        res.set('Cache-Control', 'private, no-store');
        const acces = await verifierParticipant(req, res);
        if (!acces) return;
        if (!historiqueAutorise(acces.demande)) {
            return res.status(403).json({message:'Historique indisponible.'});
        }
        const appels = await require('../services/chatCallHistory')
            .listerPourDemande(acces.demandeId);
        return res.json({ appels });
    } catch {
        console.error('Historique Taskly : lecture indisponible.');
        return res.status(503).json({message:'Historique temporairement indisponible.'});
    }
}

module.exports = {
    lireChat,
    envoyerChat,
    listerConversations,
    nonLus,
    confirmerLecture,
    gererAppel,
    appelsEntrants,
    emettreJetonLiveKit,
    verifierParticipant,
    historiqueAutorise,
    historiqueAppels
};