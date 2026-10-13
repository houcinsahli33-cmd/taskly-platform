// Demarrage apres connexion du stockage partage de sessions.
require('dotenv').config({path:require('path').join(__dirname,'.env')});
const {creerSessionStore}=require('./config/sessionStore');
(async()=>{
  const store=await creerSessionStore();
  const app=require('./app')(store);
  const port=Number(process.env.PORT || 3000);
  app.listen(port,'0.0.0.0',()=>console.log(`Serveur lance sur le port ${port}`));
  require('./services/tasklyMail').demarrer();
})().catch(error=>{console.error('Demarrage impossible :',error.message);process.exit(1);});
