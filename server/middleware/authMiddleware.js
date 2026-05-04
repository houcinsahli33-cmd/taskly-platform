// Vérifier si l'utilisateur est connecté
function verifierConnexion(req, res, next) {
    if (!req.session.utilisateur) {
        return res.status(401).json({
            message: "Vous devez être connecté."
        });
    }

    next();
}

// Vérifier si l'utilisateur connecté est un client
function verifierClient(req, res, next) {
    if (req.session.utilisateur.role !== "client") {
        return res.status(403).json({
            message: "Accès refusé. Rôle client requis."
        });
    }

    next();
}

// Vérifier si l'utilisateur connecté est un artisan
function verifierArtisan(req, res, next) {
    if (req.session.utilisateur.role !== "artisan") {
        return res.status(403).json({
            message: "Accès refusé. Rôle artisan requis."
        });
    }

    next();
}

// Vérifier si l'utilisateur connecté est un administrateur
function verifierAdmin(req, res, next) {
    if (req.session.utilisateur.role !== "admin") {
        return res.status(403).json({
            message: "Accès refusé. Rôle administrateur requis."
        });
    }

    next();
}

module.exports = {
    verifierConnexion,
    verifierClient,
    verifierArtisan,
    verifierAdmin
};