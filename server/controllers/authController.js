// Ce fichier contient la logique liée à l'authentification.
// Il gère l'inscription, la connexion et la déconnexion des utilisateurs.
// Il utilise userModel.js pour communiquer avec la table users.

const bcrypt = require("bcrypt");
const userModel = require("../models/userModel");

// Inscription d'un nouvel utilisateur
async function inscription(req, res) {
  try {
    const { nom, prenom, email, motDePasse, role } = req.body;

    if (!nom || !prenom || !email || !motDePasse || !role) {
      return res.status(400).json({
        message: "Veuillez remplir tous les champs."
      });
    }

    const utilisateurExistant = await userModel.trouverUtilisateurParEmail(email);

    if (utilisateurExistant) {
      return res.status(400).json({
        message: "Cet email est déjà utilisé."
      });
    }

    const motDePasseHash = await bcrypt.hash(motDePasse, 10);

    await userModel.creerUtilisateur(
      nom,
      prenom,
      email,
      motDePasseHash,
      role
    );

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

    const utilisateur = await userModel.trouverUtilisateurParEmail(email);

    if (!utilisateur) {
      return res.status(400).json({
        message: "Email ou mot de passe incorrect."
      });
    }

    const motDePasseValide = await bcrypt.compare(
      motDePasse,
      utilisateur.mot_de_passe
    );

    if (!motDePasseValide) {
      return res.status(400).json({
        message: "Email ou mot de passe incorrect."
      });
    }

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

module.exports = {
  inscription,
  connexion
};