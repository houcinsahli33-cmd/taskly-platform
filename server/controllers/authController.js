// Ce fichier contient la logique liée à l'authentification.
// Il gère l'inscription, la connexion et la déconnexion des utilisateurs.
// Il utilise userModel.js pour communiquer avec la table users.

const bcrypt = require("bcrypt"); // on importe bcrypt pour hasher le mot de passe avant de l'enregistrer dans la base de données (le transformer en version securisée)
const userModel = require("../models/userModel"); // on importe les fonctions du fichier userModel.js pour interagir avec la table users


// Inscription d'un nouvel utilisateur
async function inscription(req, res) {  // fonction d'inscription, req est la requete envoyee par le client, res est la reponse envoyee par le serveur
    try {
        const { nom, prenom, email, motDePasse, role } = req.body; // on recupere les donnees envoyees par le formulaire

        if (!nom || !prenom || !email || !motDePasse || !role) {
            // on renvoie une erreur si ya au moins un champ manquant
            return res.status(400).json({   // on arrete avec return et on affiche lerreur status(400) qui indique que la requete du client est incorrecte
                message: "Tous les champs doivent être remplis !"  
            }); 
        }


        const utilisateurExistant = await userModel.trouverUtilisateurParEmail(email); // on cherche si un utilisateur avec cet email existe deja dans la base de donnees
        
        if (utilisateurExistant) {  // si un utilisateur avec cet email existe deja, on renvoie une erreur et on arrete la fonction
            return res.status(400).json({
                message: "Un utilisateur avec cet e-mail existe déjà !"  
            });
        }

        const motDePasseHash = await bcrypt.hash(motDePasse, 10); // on hash le mot de passe avec bcrypt pour le stocker dans la base de donnees, motDePasse est le vrai mdp, motDePasseHash est le mdp hashe, 10 est le niveau de securite

        await userModel.creeUtilisateur(nom, prenom, email, motDePasseHash, role); // on cree l'utilisateur dans la base de donnees

        res.status(201).json({  // on renvoie une reponse avec le status 201 qui indique que la requete a ete acceptee
            message: "Compte créé avec succès !"
        });

    } catch (error) {     // si une erreur arrive dans le try, on l'affiche dans la console (terminal)
        console.error("Erreur inscription :", error.message);

        res.status(500).json({  // on renvoie une reponse avec le status 500 qui indique que le serveur a rencontre une erreur
            message: "Erreur serveur."
        });
    }
}

module.exports = {  // on exporte les fonctions pour pouvoir les utiliser dans d'autres fichiers
    inscription
};