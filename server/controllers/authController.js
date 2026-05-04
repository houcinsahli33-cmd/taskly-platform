// Ce fichier contient la logique liée à l'authentification.
// Il gère l'inscription, la connexion et la déconnexion des utilisateurs.
// Il utilise userModel.js pour communiquer avec la table users.
// Il utilise artisanModel.js pour créer un profil artisan si le rôle est "artisan".

const bcrypt = require("bcrypt");
const userModel = require("../models/userModel");
const artisanModel = require("../models/artisanModel");
const serviceModel = require("../models/serviceModel");// pour vérifier que le service choisi par l'artisan existe bien

// Inscription d'un nouvel utilisateur
async function inscription(req, res) {
  try {
    const {
      nom,
      prenom,
      email,
      motDePasse,
      role,
      serviceId,
      ville,
      telephone,
      description,
      experience,
      photo
    } = req.body;

    // Vérifier les champs obligatoires communs
    if (!nom || !prenom || !email || !motDePasse || !role) {
      return res.status(400).json({
        message: "Veuillez remplir tous les champs."
      });
    }
// Vérifier que le rôle est soit "client" soit "artisan" sinon c'est une erreur
    if (role !== "client" && role !== "artisan") {
    return res.status(400).json({
        message: "Rôle invalide."
    });
}

    // Vérifier les champs obligatoires si l'utilisateur est artisan
    if (
      role === "artisan" &&
      (!serviceId || !ville || !telephone || experience === undefined)
    ) {
      return res.status(400).json({
        message: "Le service, la ville, le téléphone et l'expérience sont obligatoires pour un artisan."
      });
    }
// Si le rôle est artisan, vérifier que le service choisi existe bien dans la base de données
    if (role === "artisan") {
    const service = await serviceModel.trouverServiceParId(serviceId);

    if (!service) {
        return res.status(404).json({
            message: "Service introuvable."
        });
    }
}

    // Vérifier si l'email existe déjà
    const utilisateurExistant = await userModel.trouverUtilisateurParEmail(email);

    if (utilisateurExistant) {
      return res.status(400).json({
        message: "Cet email est déjà utilisé."
      });
    }

    // Hasher le mot de passe
    const motDePasseHash = await bcrypt.hash(motDePasse, 10);

    // Créer l'utilisateur dans la table users
    const resultatUtilisateur = await userModel.creerUtilisateur(
      nom,
      prenom,
      email,
      motDePasseHash,
      role
    );

    // Si le rôle est artisan, créer aussi son profil dans la table artisans
    if (role === "artisan") {
      await artisanModel.creerProfilArtisan(
        resultatUtilisateur.insertId,
        serviceId,
        ville,
        telephone,
        description || null,
        experience,
        photo || null
      );
    }

    res.status(201).json({
      message: "Compte créé avec succès."
    });
  } catch (error) {
    console.error("Erreur inscription :", error.message);

    res.status(500).json({
      message: "Erreur serveur."
    });
  }
}

// Connexion d'un utilisateur
async function connexion(req, res) {
  try {
    const { email, motDePasse } = req.body;

    if (!email || !motDePasse) {
      return res.status(400).json({
        message: "Veuillez remplir tous les champs."
      });
    }

    // Chercher l'utilisateur par email
    const utilisateur = await userModel.trouverUtilisateurParEmail(email);

    if (!utilisateur) {
      return res.status(400).json({
        message: "Email ou mot de passe incorrect."
      });
    }

    // Comparer le mot de passe tapé avec le mot de passe hashé
    const motDePasseValide = await bcrypt.compare(
      motDePasse,
      utilisateur.mot_de_passe
    );

    if (!motDePasseValide) {
      return res.status(400).json({
        message: "Email ou mot de passe incorrect."
      });
    }

    // Créer la session utilisateur
    req.session.utilisateur = {
      id: utilisateur.id,
      nom: utilisateur.nom,
      prenom: utilisateur.prenom,
      email: utilisateur.email,
      role: utilisateur.role
    };

    res.status(200).json({
      message: "Connexion réussie.",
      utilisateur: req.session.utilisateur
    });
  } catch (error) {
    console.error("Erreur connexion :", error.message);

    res.status(500).json({
      message: "Erreur serveur."
    });
  }
}

// Déconnexion de l'utilisateur connecté
function deconnexion(req, res) {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        message: "Erreur lors de la déconnexion."
      });
    }

    res.clearCookie("connect.sid");

    res.status(200).json({
      message: "Déconnexion réussie."
    });
  });
}

// Récupérer l'utilisateur actuellement connecté
function utilisateurConnecte(req, res) {
  if (!req.session.utilisateur) {
    return res.status(401).json({
      message: "Aucun utilisateur connecté."
    });
  }

  res.status(200).json({
    utilisateur: req.session.utilisateur
  });
}

module.exports = {
  inscription,
  connexion,
  deconnexion,
  utilisateurConnecte
};