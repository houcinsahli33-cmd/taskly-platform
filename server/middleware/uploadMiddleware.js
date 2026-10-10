// Ce fichier configure l'upload des photos de profil avec multer.

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const dossierUpload = path.join(__dirname, "../../client/public/uploads/profiles");

// Creer le dossier si il n'existe pas
if (!fs.existsSync(dossierUpload)) {
    fs.mkdirSync(dossierUpload, { recursive: true });
}

// Dossier où les photos seront enregistrées
const stockage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, dossierUpload);
    },

    filename: function (req, file, cb) {
        const extension = path.extname(file.originalname);
        const nomFichier = "photo-" + req.session.utilisateur.id + "-" + Date.now() + extension;

        cb(null, nomFichier);
    }
});

// Vérifier le type du fichier
function filtrerImage(req, file, cb) {
    const typesAutorises = ["image/jpeg", "image/png", "image/webp"];

    if (typesAutorises.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Format d'image non autorisé."));
    }
}

const uploadPhotoProfil = multer({
    storage: stockage,
    fileFilter: filtrerImage,
    limits: {
        fileSize: 2 * 1024 * 1024
    }
});

module.exports = {
    uploadPhotoProfil
};