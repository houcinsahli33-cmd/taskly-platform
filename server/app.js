const express =require("express"); // import le framewark express 
const app = express();//creer une  application web avec express

app.get("/",(req,res)=>{
    res.send("Bienvenue sur Taskly"); //envoie une reponse au clienr
});
module.exports =app; // exporter l'application pour pouvoir l'utiliser dans d'autres fichiers   
