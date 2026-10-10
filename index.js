
const express = require("express");
const { creerSessionStore } = require("./server/config/sessionStore");

const app = express();
// Les ressources publiques ne dépendent pas du démarrage Redis/TiDB.
app.use(require('./server/middleware/publicFiles').publicFiles);
let initialisation;

app.use(async (req, res) => {
  try {
    if (!initialisation) {
      initialisation = creerSessionStore()
        .then(store => require("./server/app")(store))
        .catch(err => {
          initialisation = undefined;
          throw err;
        });
    }

    const taskly = await initialisation;
    taskly(req, res);
  } catch (err) {
    console.error("Erreur de démarrage Taskly :", err.message);

    if (!res.headersSent) {
      res.status(503).json({
        message: "Service temporairement indisponible"
      });
    }
  }
});

module.exports = app;
