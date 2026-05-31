// Ce fichier contient les middlewares d'authentification.
// Un middleware est une fonction exécutée entre la route et le controller. Il permet de vérifier si l'utilisateur est connecté et s'il possède le bon rôle.

// Verifier si l'utilisateur est connecte
function verifierConnexion(req, res, next) {
    // si la session ne contient pas l'utilisateur
    if (!req.session.utilisateur) {
        return res.status(401).json({
            message: "Vous devez être connecté."
        });
    }

    next(); // si l'utilisateur est connecte, on passe au middleware suivant
}

// Verifier si l'utilisateur connecte est un client
function verifierClient(req, res, next) {
    if (req.session.utilisateur.role !== "client") {
        return res.status(403).json({
            message: "Accès refusé. Rôle client requis."
        });
    }

    next();
}

// Verifier si l'utilisateur connecte est un artisan
function verifierArtisan(req, res, next) {
    if (req.session.utilisateur.role !== "artisan") {
        return res.status(403).json({
            message: "Accès refusé. Rôle artisan requis."
        });
    }

    next();
}

// Verifier si l'utilisateur connecte est un administrateur
function verifierAdmin(req, res, next) {
    if (req.session.utilisateur.role !== "admin") {
        return res.status(403).json({
            message: "Accès refusé. Rôle administrateur requis."
        });
    }

    next();
}

module.exports = {  // on exporte les fonctions pour pouvoir les utiliser dans d'autres fichiers
    verifierConnexion,
    verifierClient,
    verifierArtisan,
    verifierAdmin
};