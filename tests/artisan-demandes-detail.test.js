"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
function controllerFor(records) {
    const controllerFile = path.join(root, "server/controllers/demandeController.js");
    const source = fs.readFileSync(controllerFile, "utf8");
    const demandeModel = {
        detailArtisan: async (id, artisanId) => records.details?.(id, artisanId) ?? null,
        listerDemandesArtisan: async () => records.items || []
    };
    const module = { exports: {} };
    vm.runInNewContext(source, {
        module, exports: module.exports, console,
        require: (name) => {
            if (name === "../models/demandeModel") return demandeModel;
            if (name === "../models/artisanModel") return { trouverArtisanParUserId: async () => ({ id: 7 }) };
            if (name === "../models/clientModel") return {};
            if (name === "../services/tasklyMail") return { base: () => "", mettreEnFile: async () => {}, traiterLot: async () => {} };
            throw Error("Dépendance imprévue: " + name);
        }
    }, {filename: controllerFile});
    return module.exports;
}
function response() {
    const res = { code: 200, headers: {}, content: null };
    res.status = function (code) { this.code = code; return this; };
    res.set = function (key, value) { this.headers[key] = value; return this; };
    res.json = function (data) { this.content = data; return this; };
    return res;
}
const req = { session: { utilisateur: { id: 1 } }, params: { id: "9" } };
test("le détail masque coordonnées avant acceptation", async () => {
    const c = controllerFor({ details: async () => ({id: 9, statut: "en_attente", adresse: "privée", client_adresse: "privée", client_telephone: "123", client_email: "a@b.fr"}) });
    const res = response();
    await c.detailsArtisan(req, res);
    assert.equal(res.code, 200);
    for (const f of ["adresse","client_adresse","client_telephone","client_email"]) assert.equal(res.content.demande[f], null);
    assert.match(res.headers["Cache-Control"], /no-store/);
});
test("le détail montre les coordonnées après acceptation", async () => {
    const c = controllerFor({ details: async () => ({ id: 9, statut: "acceptee", adresse: "1 rue X", client_telephone: "123" }) });
    const res = response();
    await c.detailsArtisan(req, res);
    assert.equal(res.code, 200);
    assert.equal(res.content.demande.adresse, "1 rue X");
});
test("une demande non accessible renvoie 404", async () => {
    const c = controllerFor({ details: async () => null });
    const res = response();
    await c.detailsArtisan(req, res);
    assert.equal(res.code, 404);
});
test("la liste masque les coordonnées des demandes en attente", async () => {
    const c = controllerFor({ items: [
        {id: 1, statut: "en_attente", adresse: "secret", client_telephone: "123"},
        {id: 2, statut: "acceptee", adresse: "autorisé", client_telephone: "456"}
    ] });
    const res = response();
    await c.listerDemandesArtisan(req,res);
    assert.equal(res.code, 200);
    assert.equal(res.content.demandes[0].adresse, null);
    assert.equal(res.content.demandes[0].client_telephone, null);
    assert.equal(res.content.demandes[1].adresse, "autorisé");
});
test("la route détails vérifie connexion, rôle artisan et statut actif", () => {
    const routes = fs.readFileSync(path.join(root,"server/routes/demandeRoutes.js"),"utf8");
    assert.match(routes, /router\.get\("\/:id\/details", verifierConnexion, verifierArtisan, verifierArtisanActif, demandeController\.detailsArtisan\)/);
});
