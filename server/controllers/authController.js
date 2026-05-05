// Ce fichier contient la logique liée à l'authentification. Il gère l'inscription, la connexion et la déconnexion des utilisateurs.
// Il utilise userModel.js pour communiquer avec la table users.

const bcrypt = require("bcrypt"); // on importe bcrypt pour hasher le mot de passe avant de l'enregistrer dans la base de données (le transformer en version securisée)
const userModel = require("../models/userModel"); // on importe les fonctions du fichier userModel.js pour interagir avec la table users
const clientModel = require("../models/clientModel"); // on importe les fonctions du fichier clientModel.js pour interagir avec la table clients
const artisanModel = require("../models/artisanModel"); // on importe les fonctions du fichier artisanModel.js pour interagir avec la table artisans
const serviceModel = require("../models/serviceModel"); // on importe les fonctions du fichier serviceModel.js pour interagir avec la table services

// Inscription d'un nouvel utilisateur
async function inscription(req, res) {
    try {
        const { nom, prenom, email, motDePasse, role, serviceId, ville, telephone, adresse, description, experience } = req.body; // on recupere les donnees envoyees par le formulaire

        if (!nom || !prenom || !email || !motDePasse || !role) {
            // on renvoie une erreur si ya au moins un champ manquant
            return res.status(400).json({
                message: "Tous les champs sont obligatoires et doivent être remplis."  
            }); 
        }

        if (role !== "client" && role !== "artisan") {
            // on renvoie une erreur si le role est invalide
            return res.status(400).json({
                message: "Rôle invalide."
            });
        }

        if (role === "artisan" && (!serviceId || !ville || !telephone || experience === undefined)) {
            // on renvoie une erreur si le role est artisan et que l'un des champs obligatoires sont manquants
            return res.status(400).json({
                message: "Veuillez remplir les champs obligatoires."
            });
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

        const utilisateurExistant = await userModel.trouverUtilisateurParEmail(email); // on cherche si un utilisateur avec cet email existe deja dans la base de donnees
        
        if (utilisateurExistant) {  // si un utilisateur avec cet email existe deja, on renvoie une erreur et on arrete la fonction
            return res.status(400).json({
                message: "Un utilisateur avec cet e-mail existe déjà."  
            });
        }

        const motDePasseHash = await bcrypt.hash(motDePasse, 10); // on hash le mot de passe avec bcrypt pour le stocker dans la base de donnees, motDePasse est le vrai mdp, motDePasseHash est le mdp hashe, 10 est le niveau de securite

        const resultatUtilisateur = await userModel.creerUtilisateur(   // on cree l'utilisateur dans la base de donnees
            nom,
            prenom,
            email,
            motDePasseHash,
            role
        );

        if (role === "client") {
            await clientModel.creerProfilClient(
                resultatUtilisateur.insertId,   // on recupere l'id de l'utilisateur cree dans la table users
                telephone || null,
                ville || null,
                adresse || null
            );
        }

        if (role === "artisan") {
            await artisanModel.creerProfilArtisan(
                resultatUtilisateur.insertId,   // on recupere l'id de l'utilisateur de la table users
                serviceId,
                ville,
                telephone,
                description || null,
                experience
            );
        }

        res.status(201).json({  // la requete a ete acceptee
            message: "Compte créé avec succès."
        });

    } catch (error) {     // si une erreur arrive dans le try, on l'affiche dans la console (terminal)
        console.error("Erreur inscription :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
    }
}

// Connexion d'un nouvel utilisateur
async function connexion(req, res) {
    try {
        const { email, motDePasse } = req.body; // on recupere les donnees envoyees par le formulaire de connexion

        if (!email || !motDePasse) {
            // on renvoie une erreur si ya au moins un champ manquant
            return res.status(400).json({
                message: "Veuillez remplir tous les champs."
            }); 
        }

        const utilisateur = await userModel.trouverUtilisateurParEmail(email); // on cherche si un utilisateur avec cet email existe dans la bdd

        if (!utilisateur) {
            // on renvoie une erreur si l'utilisateur n'existe pas
            return res.status(400).json({
                message: "Email ou mot de passe incorrect."
            });
        }

        const motDePasseValide = await bcrypt.compare(motDePasse, utilisateur.mot_de_passe); // on compare le mot de passe envoyee par le client avec le mot de passe hashe stocké dans la base de donnees

        if (!motDePasseValide) {
            // on renvoie une erreur si le mot de passe est incorrect
            return res.status(400).json({
                message: "Email ou mot de passe incorrect."
            });
        }

        req.session.utilisateur = { // on cree une session pour l'utilisateur
            id: utilisateur.id,
            nom: utilisateur.nom,
            prenom: utilisateur.prenom,
            email: utilisateur.email,
            role: utilisateur.role
        };

        res.status(200).json({  // la requete a ete acceptee
            message: "Connexion réussie.",
            utilisateur: req.session.utilisateur
        });
    } catch (error) {   // si une erreur arrive dans le try, on l'affiche dans la console (terminal)
        console.error("Erreur connexion :", error.message);

        res.status(500).json({
            message: "Erreur serveur."
        });
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

        res.clearCookie("connect.sid"); // on supprime le cookie de session

        res.status(200).json({  // la requete a ete acceptee
            message: "Déconnexion réussie."
        });
    });
}

// Recuperer l'utilisateur actuellement connecte
function utilisateurConnecte(req, res) {
    if (!req.session.utilisateur) {
        return res.status(401).json({  // erreur, l'utilisateur n'est pas authentifie
            message: "Aucun utilisateur connecté."
        });
    }

    res.status(200).json({  // la requete a ete acceptee
        utilisateur: req.session.utilisateur    // on renvoie ses informations stockees dans la session
    });
}

module.exports = {  // on exporte les fonctions pour pouvoir les utiliser dans d'autres fichiers
    inscription,
    connexion,
    deconnexion,
    utilisateurConnecte
};