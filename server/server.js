const app = require("./app"); // importer l'application depuis le fichier app.js
const PORT =  3000; // definir le port d'ecoute du serveur
app.listen(PORT,()=>{
    console.log(`Server is running on port http://localhost:${PORT}`); // afficher un message dans la console lorsque le serveur est demarré
}); // demarrer le serveur et ecouter les requetes sur le port definiode