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
module.exports = { lireChat, envoyerChat,listerConversations,nonLus,confirmerLecture };