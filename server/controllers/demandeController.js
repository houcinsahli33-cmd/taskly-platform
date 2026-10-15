// Ce fichier contient la logique métier liée aux demandes.
// Il vérifie les données, récupère le client ou l'artisan connecté puis appelle demandeModel pour communiquer avec MySQL.

const demandeModel = require("../models/demandeModel");
const clientModel = require("../models/clientModel");
const artisanModel = require("../models/artisanModel");

const tasklyMail = require('../services/tasklyMail');
const tasklyConfirmation = require('../services/tasklyConfirmation');

// Après l'enregistrement en base : notifier le bon destinataire, jamais un autre profil.
// Une panne SMTP ne doit pas transformer une opération déjà validée en échec HTTP.
async function notifierDemande(id, type) {
    try {
        const d = await demandeModel.trouverDestinataires(id);
        if (!d) return;
        const nomClient = [d.client_prenom, d.client_nom].filter(Boolean).join(' ').trim() || 'un client';
        const nomArtisan = [d.artisan_prenom, d.artisan_nom].filter(Boolean).join(' ').trim() || 'votre artisan';
        const site = tasklyMail.base();
        if (type === 'nouvelle') {
            await tasklyMail.mettreEnFile({
                userId: d.artisan_user_id, to: d.artisan_email,
                subject: 'Vous avez reçu une nouvelle demande — Taskly',
                message: `Une nouvelle demande de ${nomClient} vous attend. Connectez-vous à votre profil artisan pour consulter les détails et répondre.`,
                link: site ? site + '/espace/artisan/demandes' : '', button: 'Consulter la demande',
                key: `demande:${id}:nouvelle`
            });
        } else if (type === 'acceptee' || type === 'refusee') {
            await tasklyMail.mettreEnFile({
                userId: d.client_user_id, to: d.client_email,
                subject: type === 'acceptee' ? 'Votre demande a été acceptée — Taskly' : 'Réponse à votre demande — Taskly',
                message: type === 'acceptee'
                    ? `Bonne nouvelle ! ${nomArtisan} a accepté votre demande. Retrouvez ses coordonnées et le suivi dans votre espace client.`
                    : `${nomArtisan} ne peut pas donner suite à votre demande. Vous pouvez rechercher un autre artisan sur Taskly.`,
                link: site ? site + (type === 'acceptee' ? '/espace/client/demandes' : '/artisans.html') : '',
                button: type === 'acceptee' ? 'Consulter ma demande' : 'Trouver un artisan',
                key: `demande:${id}:${type}`
            });
        } else return;
        // Tentative immédiate (utile pour Vercel); la file assure des relances sur serveur Node.
        await tasklyMail.traiterLot();
    } catch (error) {
        console.error('Notification Taskly impossible :', error.code || error.message);
    }
}


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

        if (dateSouhaitee !== undefined && dateSouhaitee !== null && dateSouhaitee !== '') {
            const dateVerifiee=require('../helpers/requestDate').verifierDateSouhaitee(dateSouhaitee);
            if (!dateVerifiee.valide) return res.status(400).json({message:dateVerifiee.raison});
        }
        const resultat = await demandeModel.creerDemande(
            client.id,
            artisanId,
            message,
            adresse,
            dateSouhaitee || null
        );

        await notifierDemande(resultat.insertId, 'nouvelle');

        res.status(201).json({
            message: "Demande envoyée avec succès.",
            demandeId: resultat.insertId
        });

    } catch (error) {
        if (error.code === 'TASKLY_DATE_OCCUPEE')
            return res.status(409).json({message:'Cet artisan est déjà occupé à cette date. Choisissez un autre jour.'});
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

        // Les données personnelles d'intervention sont cachées avant acceptation.
        const demandesVisibles = demandes.map((demande) => {
            if (["acceptee", "attente_confirmation", "terminee", "conteste"].includes(demande.statut)) return demande;
            return { ...demande, adresse: null, client_adresse: null, client_telephone: null, client_email: null };
        });
        res.set("Cache-Control", "no-store, private");
        res.status(200).json({ demandes: demandesVisibles });

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

        await notifierDemande(req.params.id, statut);

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

        // Le statut est en attente : jamais terminé sans confirmation du client.
        try {
            const dest = await demandeModel.trouverDestinataires(req.params.id);
            if (dest) {
                const token = await tasklyConfirmation.creer(req.params.id);
                const site = tasklyMail.base();
                await tasklyMail.mettreEnFile({
                    userId:dest.client_user_id, to:dest.client_email,
                    subject:'Votre artisan demande la confirmation de la prestation — Taskly',
                    message:`Votre artisan ${[dest.artisan_prenom,dest.artisan_nom].filter(Boolean).join(' ')} indique que la prestation est terminée. Confirmez uniquement si le travail est réellement terminé. Sinon, signalez que la prestation n'est pas terminée.`,
                    link:site ? `${site}/confirmation-prestation.html?demande=${encodeURIComponent(req.params.id)}#token=${token}` : '',
                    button:'Confirmer la fin de la prestation',
                    secondaryLink:site ? `${site}/signalement-prestation.html?demande=${encodeURIComponent(req.params.id)}` : '',
                    secondaryButton:'La prestation n’est pas terminée',
                    key:`demande:${req.params.id}:confirmation`
                });
                await tasklyMail.traiterLot();
            }
        } catch (err) {
            console.error('Notification fin de prestation impossible :', err.code || err.message);
        }
        res.status(200).json({
            message: "Fin déclarée : en attente de confirmation du client."
        });

    } catch (error) {
        console.error("Erreur finalisation demande :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}



// Sécurisé par les middlewares artisan; vérifie aussi l'appartenance par SQL.
async function detailsArtisan(req, res) {
    try {
        const artisan = await obtenirArtisanConnecte(req, res);
        if (!artisan) return;
        const demande = await demandeModel.detailArtisan(req.params.id, artisan.id);
        if (!demande) return res.status(404).json({ message: "Demande introuvable." });
        if (!["acceptee", "attente_confirmation", "terminee", "conteste"].includes(demande.statut)) {
            demande.adresse = null;
            demande.client_adresse = null;
            demande.client_telephone = null;
            demande.client_email = null;
        }
        res.set("Cache-Control", "no-store, private");
        return res.status(200).json({ demande });
    } catch (error) {
        console.error("Erreur détail demande artisan :", error.message);
        return res.status(500).json({ message: "Détail indisponible." });
    }
}

// Confirmation depuis l'espace client connecté (propriété vérifiée côté SQL).
async function confirmerFinClient(req,res) {
    try {
        const client=await obtenirClientConnecte(req,res);if(!client)return;
        const result=await demandeModel.confirmerFinClient(req.params.id,client.id);
        if(!result.affectedRows)return res.status(409).json({message:'Cette demande ne peut pas être confirmée.'});
        res.status(200).json({message:'Merci, votre prestation est confirmée comme terminée.'});
    }catch(err){console.error('Confirmation client :',err.code||err.message);res.status(500).json({message:'Confirmation momentanément indisponible.'});}
}
// Une contestation ne crée PAS automatiquement de signalement : le client décide ensuite.
async function contesterFinClient(req,res) {
    try {
        const client=await obtenirClientConnecte(req,res);if(!client)return;
        const result=await demandeModel.contesterFinClient(req.params.id,client.id);
        if(!result.affectedRows)return res.status(409).json({message:'Cette demande ne peut pas être contestée.'});
        res.status(200).json({message:'Prestation marquée non terminée. Vous pouvez signaler le problème.'});
    }catch(err){console.error('Contestation client :',err.code||err.message);res.status(500).json({message:'Contestation momentanément indisponible.'});}
}
// Le lien e-mail ne modifie rien à son ouverture : POST explicite, token unique.
async function confirmerDepuisEmail(req,res) {
    try {
        const ok=await tasklyConfirmation.confirmer(req.body?.token);
        if(!ok)return res.status(409).json({message:'Lien invalide, expiré ou demande déjà traitée.'});
        res.set('Cache-Control','no-store').status(200).json({message:'La prestation a été confirmée. Merci !'});
    }catch(err){console.error('Confirmation e-mail :',err.code||err.message);res.status(500).json({message:'Service temporairement indisponible.'});}
}

module.exports = {
    confirmerFinClient,
    contesterFinClient,
    confirmerDepuisEmail,
    detailsArtisan,
    creerDemande,
    listerDemandesClient,
    listerDemandesArtisan,
    modifierStatutDemande,
    annulerDemandeClient,
    annulerDemandeArtisan,
    terminerDemande
};
