const express =require("express"); // import le framewark express 
const app = express();//creer une  application web avec express
require("./config/db"); // importer la configuration de la base de données
const authRoutes = require("./routes/authRoutes");


// Permet à Express de lire les données JSON envoyées par le client
app.use(express.json());

// Routes d'authentification : inscription, connexion, déconnexion
app.use("/api/auth", authRoutes);

app.get("/",(req,res)=>{
    res.send("Bienvenue sur Taskly"); //envoie une reponse au clienr
});
module.exports =app; // exporter l'application pour pouvoir l'utiliser dans d'autres fichiers   

