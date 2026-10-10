// Ce fichier contient la logique liée à l'authentification. Il gère l'inscription, la connexion et la déconnexion des utilisateurs.
// Il utilise userModel.js pour communiquer avec la table users.

const fs = require("fs"); // on importe fs pour manipuler les fichiers
const path = require("path");   // on importe path pour travailler avec les chemins de fichiers

const bcrypt = require("bcrypt"); // on importe bcrypt pour hasher le mot de passe avant de l'enregistrer dans la base de données (le transformer en version securisée)
const userModel = require("../models/userModel"); // on importe les fonctions du fichier userModel.js pour interagir avec la table users
const clientModel = require("../models/clientModel"); // on importe les fonctions du fichier clientModel.js pour interagir avec la table clients
const artisanModel = require("../models/artisanModel"); // on importe les fonctions du fichier artisanModel.js pour interagir avec la table artisans
const serviceModel = require("../models/serviceModel");
const db = require('../config/db').promise();
const {genererCode, verifierCode, obtenirEtatCode} = require('../services/codeService');
const {envoyerCode, estConfigure} = require('../services/emailService');

const REGEX_GMAIL = /^[A-Za-z0-9._%+-]+@gmail\.com$/i;
const REGEX_TELEPHONE_ALGERIE = /^0[567]\d{8}$/;
const REGEX_MDP_FORT = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;

function renouvelerSession(req) {
    return new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
}
function sauvegarderSession(req) {
    return new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
}
function compteSession(utilisateur) {
    return { id: utilisateur.id, nom: utilisateur.nom, prenom: utilisateur.prenom,
        email: utilisateur.email, role: utilisateur.role, photo_profil: utilisateur.photo_profil };
}



// Inscription d'un nouvel utilisateur
async function inscription(req, res) {
    let conn;
    try {
        const { nom, prenom, email, motDePasse, role, serviceId, ville, telephone, adresse, description, experience } = req.body;
        if (!estConfigure()) return res.status(503).json({ message: 'Service email indisponible : configurer SMTP.' });

        const emailNormalise = String(email || '').trim().toLowerCase();
        const telephoneNormalise = String(telephone || '').trim();
        const motDePasseBrut = String(motDePasse || '');

        if (!nom || !prenom || !emailNormalise || !motDePasseBrut || !role) {
            // on renvoie une erreur si ya au moins un champ manquant
            return res.status(400).json({
                message: "Tous les champs sont obligatoires et doivent être remplis."
            });
        }

        if (role !== "client" && role !== "artisan") {
            return res.status(400).json({
                message: "Rôle invalide."
            });
        }

        if (!REGEX_GMAIL.test(emailNormalise)) {
            return res.status(400).json({
                message: "Veuillez utiliser une adresse @gmail.com valide."
            });
        }

        if (!REGEX_MDP_FORT.test(motDePasseBrut)) {
            return res.status(400).json({
                message: "Mot de passe trop faible : utilisez au moins 8 caractères avec majuscule, minuscule, chiffre et symbole."
            });
        }

        if (!REGEX_TELEPHONE_ALGERIE.test(telephoneNormalise)) {
            return res.status(400).json({
                message: "Veuillez entrer un numéro algérien valide de 10 chiffres commençant par 05, 06 ou 07."
            });
        }

        if (role === "client" && (!telephoneNormalise || !ville || !adresse)) {
            return res.status(400).json({
            message: "Veuillez remplir les champs obligatoires."
            });
        }

        if (role === "artisan" && (!serviceId || !ville || !telephoneNormalise || experience === undefined)) {
            // on renvoie une erreur si le role est artisan et que l'un des champs obligatoires sont manquants
            return res.status(400).json({
                message: "Veuillez remplir les champs obligatoires."
            });
        }

        if (role === 'artisan' && (!req.file || !['diplome','certificat'].includes(req.body.type_document) ||
            !require('../middleware/documentUpload').formatValide(req.file.buffer,req.file.mimetype))) {
          return res.status(400).json({message:'Un diplôme ou certificat valide est obligatoire (PDF, JPEG, PNG, 3 Mo maximum).'});
        }
        if (role === 'artisan' && (!Number.isInteger(Number(experience)) || Number(experience)<0 || Number(experience)>80)) {
          return res.status(400).json({message:'Expérience invalide.'});
        }
        if (role === "artisan") {
            const service = await serviceModel.trouverServiceParId(serviceId);

            if (!service) {
                // on renvoie une erreur si le service n'existe pas
                return res.status(404).json({
                    message: "Service introuvable."
                });
            }
        }

        const utilisateurExistant = await userModel.trouverUtilisateurParEmail(emailNormalise); // on cherche si un utilisateur avec cet email existe deja dans la base de donnees

        if (utilisateurExistant) {  // si un utilisateur avec cet email existe deja, on renvoie une erreur et on arrete la fonction
            return res.status(400).json({
                message: "Un utilisateur avec cet e-mail existe déjà."
            });
        }

        const motDePasseHash = await bcrypt.hash(motDePasseBrut, 10); // on hash le mot de passe avec bcrypt pour le stocker dans la base de donnees, motDePasse est le vrai mdp, motDePasseHash est le mdp hashe, 10 est le niveau de securite

        conn = await db.getConnection();
        await conn.beginTransaction();
        const [resultatUtilisateur] = await conn.query(
          'INSERT INTO users (nom,prenom,email,mot_de_passe,role,email_verified) VALUES (?,?,?,?,?,0)',
          [nom,prenom,emailNormalise,motDePasseHash,role]);
        if (role === 'client') {
          await conn.query('INSERT INTO clients (user_id,telephone,ville,adresse) VALUES (?,?,?,?)',
            [resultatUtilisateur.insertId,telephoneNormalise,ville,adresse]);
        } else {
          const [profil] = await conn.query("INSERT INTO artisans (user_id,service_id,ville,telephone,description,experience,verification_statut) VALUES (?,?,?,?,?,?,'en_attente')",
            [resultatUtilisateur.insertId,serviceId,ville,telephoneNormalise,description||null,Number(experience)]);
          const stored = await require('../services/fileStorage').enregistrer(req.file,true,conn);
          await conn.query('INSERT INTO artisan_documents (artisan_id,type_document,stored_name,original_name,media_type,taille) VALUES (?,?,?,?,?,?)',
            [profil.insertId,req.body.type_document,stored,path.basename(req.file.originalname).slice(0,255),req.file.mimetype,req.file.size]);
        }
        await conn.commit();
        const code=await genererCode(resultatUtilisateur.insertId,'email');
        // Le compte n'est PAS connecté ; seule la vérification du code peut créer la session.
        req.session.verificationPending = { userId: resultatUtilisateur.insertId, flow: 'inscription' };
        await sauvegarderSession(req);
        try { await envoyerCode(emailNormalise,code,'email'); }
        catch(e) { return res.status(201).json({message:'Compte créé, mais envoi du code indisponible. Demandez un nouveau code.',codeRequis:true}); }
        res.status(201).json({ message: 'Compte créé. Entrez le code envoyé par e-mail.', codeRequis:true });

    } catch (error) {     // si une erreur arrive dans le try, on l'affiche dans la console (terminal)
        if (conn) await conn.rollback().catch(()=>{});
        console.error("Erreur inscription :", error.code || "erreur");

        res.status(500).json({
            message: "Erreur serveur."
        });
    } finally { if (conn) conn.release(); }
}

// Connexion : d'abord le mot de passe, ensuite le code reçu par e-mail.
// Aucune session authentifiée n'est créée tant que le code n'est pas validé.
async function connexion(req, res) {
    try {
        const { email, motDePasse } = req.body;
        if (typeof email !== 'string' || typeof motDePasse !== 'string' || !email.trim() || !motDePasse) {
            return res.status(400).json({ message: 'Veuillez remplir tous les champs.' });
        }
        const utilisateur = await userModel.trouverUtilisateurParEmail(email.trim().toLowerCase());
        if (!utilisateur || !await bcrypt.compare(motDePasse, utilisateur.mot_de_passe)) {
            return res.status(401).json({message:'Email ou mot de passe incorrect.'});
        }
        if (utilisateur.role === 'admin') {
            return res.status(403).json({message:'Administration : utilisez la connexion privée.'});
        }
        if (utilisateur.statut_compte === 'bloque' && utilisateur.role !== 'artisan') {
            return res.status(403).json({message:'Votre compte a été bloqué. Contactez le support.'});
        }
        if (!estConfigure()) {
            return res.status(503).json({message:'Service e-mail indisponible : configuration SMTP nécessaire.'});
        }
        const flow = utilisateur.email_verified ? 'connexion' : 'inscription';
        const code = await genererCode(utilisateur.id, 'email');
        await envoyerCode(utilisateur.email,code,'email');
        await renouvelerSession(req);
        req.session.verificationPending = { userId: utilisateur.id, flow };
        await sauvegarderSession(req);
        return res.json({message:'Un code vous a été envoyé par e-mail.',codeRequis:true});
    } catch(error) {
        if (error.status === 429) return res.status(429).json({message:error.message});
        console.error('Erreur connexion :',error.message);
        return res.status(500).json({message:'Erreur serveur.'});
    }
}

// Deconnexion de l'utilisateur connecte
function deconnexion(req, res) {
    req.session.destroy((err) => {
        if (err) {  // si erreur, on arrete et affiche
            return res.status(500).json({
                message: "Erreur lors de la déconnexion."
            });
        }

        res.clearCookie("artisans.sid"); // on supprime le cookie de session

        res.status(200).json({  // la requete a ete acceptee
            message: "Déconnexion réussie."
        });
    });
}

// Recuperer l'utilisateur actuellement connecte
async function utilisateurConnecte(req, res) {
    if (!req.session.utilisateur) {
        return res.status(401).json({  // erreur, l'utilisateur n'est pas authentifie
            message: "Aucun utilisateur connecté."
        });
    }

    res.status(200).json({  // la requete a ete acceptee
        utilisateur: req.session.utilisateur    // on renvoie ses informations stockees dans la session
    });
}

// Modifier la photo de profil de l'utilisateur connecte
async function modifierPhotoProfil(req,res){
 try{
  if(!req.file)return res.status(400).json({message:'Veuillez choisir une image.'});
  const photo=await require('../services/profilePhoto').changer(req.session.utilisateur.id,req.file);
  req.session.utilisateur.photo_profil=photo;
  res.json({message:'Photo de profil mise à jour.',photo_profil:photo});
 }catch(error){console.error('Modification photo :',error.code||'erreur');res.status(error.status||500).json({message:error.status?error.message:'Modification de la photo indisponible.'});}
}
async function supprimerPhotoProfil(req,res){
 try{
  await require('../services/profilePhoto').changer(req.session.utilisateur.id);
  req.session.utilisateur.photo_profil=null;
  res.json({message:'Photo de profil supprimée.'});
 }catch(error){console.error('Suppression photo :',error.code||'erreur');res.status(error.status||500).json({message:error.status?error.message:'Suppression de la photo indisponible.'});}
}

async function etatVerification(req,res) {
    try {
        const pending=req.session.verificationPending;
        if (!pending || !['inscription','connexion'].includes(pending.flow)) {
            return res.status(401).json({message:'Aucune vérification en cours. Inscrivez-vous ou connectez-vous.'});
        }
        const utilisateur=await userModel.trouverUtilisateurParId(pending.userId);
        if (!utilisateur || utilisateur.role === 'admin' || (utilisateur.statut_compte === 'bloque' && utilisateur.role !== 'artisan')) {
            return res.status(403).json({message:'Vérification impossible.'});
        }
        const etat=await obtenirEtatCode(pending.userId,'email');
        res.set('Cache-Control','no-store');
        res.json({email:utilisateur.email,flow:pending.flow,...etat});
    } catch(error) {
        console.error('Etat vérification :',error.message);
        res.status(500).json({message:'Erreur serveur.'});
    }
}

async function confirmerEmail(req,res) {
    try {
        const pending=req.session.verificationPending;
        if (!pending) return res.status(401).json({message:'Aucune vérification en cours. Reconnectez-vous.'});
        const code=String(req.body.code||'');
        if (!/^\d{6}$/.test(code)) return res.status(400).json({message:'Entrez un code à 6 chiffres.'});
        const estValide=await verifierCode(pending.userId,'email',code);
        if (!estValide) {
            const etat=await obtenirEtatCode(pending.userId,'email');
            return res.status(400).json({message: etat.secondesRestantes===0 ? 'Le code a expiré. Demandez-en un nouveau.' :
                etat.tentativesRestantes===0 ? '3 tentatives utilisées. Demandez un nouveau code.' :
                'Code incorrect.', ...etat});
        }
        const utilisateur=await userModel.trouverUtilisateurParId(pending.userId);
        if (!utilisateur || utilisateur.role==='admin' || (utilisateur.statut_compte==='bloque' && utilisateur.role!=='artisan')) {
            return res.status(403).json({message:'Accès refusé.'});
        }
        if (pending.flow==='inscription' || !utilisateur.email_verified) {
            await db.query('UPDATE users SET email_verified=1 WHERE id=?',[utilisateur.id]);
        }
        await renouvelerSession(req); // anti-fixation de session
        if (utilisateur.role==='artisan') {
          const artisan=await artisanModel.trouverArtisanParUserId(utilisateur.id);
          if (!require('../services/accountAccess').autoriserEspace({...utilisateur,email_verified:1},artisan)) {
            req.session.supportIdentity={userId:utilisateur.id,version:Number(utilisateur.admin_session_version||0),verifiedAt:Date.now(),expiresAt:Date.now()+30*60*1000};
            await sauvegarderSession(req);
            return res.json({supportSeulement:true,supportUrl:'/artisan-pending.html',message:require('../services/accountAccess').messageDossier(artisan,utilisateur)});
          }
        }
        req.session.accountSessionVersion=utilisateur.admin_session_version;
        req.session.utilisateur=compteSession(utilisateur);
        await sauvegarderSession(req);
        return res.json({message:'Vérification réussie.', utilisateur:req.session.utilisateur});
    } catch(error) {
        console.error('Vérification e-mail :',error.message);
        res.status(500).json({message:'Erreur serveur.'});
    }
}

async function renvoyerCodeEmail(req,res) {
    try {
        const pending=req.session.verificationPending;
        if (!pending) return res.status(401).json({message:'Aucune vérification en cours.'});
        const utilisateur=await userModel.trouverUtilisateurParId(pending.userId);
        if (!utilisateur || utilisateur.role==='admin' || (utilisateur.statut_compte==='bloque' && utilisateur.role!=='artisan')) {
            return res.status(403).json({message:'Vérification impossible.'});
        }
        if (!estConfigure()) return res.status(503).json({message:'SMTP non configuré.'});
        const code=await genererCode(utilisateur.id,'email');
        await envoyerCode(utilisateur.email,code,'email');
        return res.json({message:'Un nouveau code vient d’être envoyé.',secondesRestantes:180,tentativesRestantes:3});
    } catch(error) {
        if (error.status===429) return res.status(429).json({message:error.message});
        console.error('Renvoi e-mail :',error.message);
        res.status(503).json({message:'Envoi e-mail momentanément indisponible.'});
    }
}

module.exports = {  // on exporte les fonctions pour pouvoir les utiliser dans d'autres fichiers
    inscription,
    connexion,
    deconnexion,
    confirmerEmail,
    etatVerification,
    renvoyerCodeEmail,
    utilisateurConnecte,
    modifierPhotoProfil,
    supprimerPhotoProfil
};
