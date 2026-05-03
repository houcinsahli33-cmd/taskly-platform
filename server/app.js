const express =require("express"); // import le framewark express 
const app = express();//creer une  application web avec express
require("./config/db"); // importer la configuration de la base de données
app.get("/",(req,res)=>{
    res.send("Bienvenue sur Taskly"); //envoie une reponse au clienr
});
module.exports =app; // exporter l'application pour pouvoir l'utiliser dans d'autres fichiers   
