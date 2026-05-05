// Ce fichier gère l'upload des images.
// Il utilise multer pour recevoir une photo depuis un formulaire.

const multer = require("multer");
const path = require("path");

// Configuration de l'endroit où les images seront enregistrées
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "server/uploads/");
    },

    filename: function (req, file, cb) {
        const nomUnique = Date.now() + "-" + file.originalname;
        cb(null, nomUnique);
    }
});

// Configuration de multer
const upload = multer({
    storage: storage,

    limits: {
        fileSize: 2 * 1024 * 1024 // taille max : 2 Mo
    },

    fileFilter: function (req, file, cb) {
        const extensionsAutorisees = /jpg|jpeg|png|webp/;

        const extensionValide = extensionsAutorisees.test(
            path.extname(file.originalname).toLowerCase()
        );

        const typeValide = extensionsAutorisees.test(file.mimetype);

        if (extensionValide && typeValide) {
            cb(null, true);
        } else {
            cb(new Error("Seules les images jpg, jpeg, png et webp sont autorisées."));
        }
    }
});

module.exports = upload;