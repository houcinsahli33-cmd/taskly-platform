const fs = require("fs");
const path = require("path");
const vm = require("vm");

let cacheWilayas = null;

function chargerWilayas() {
    if (cacheWilayas) return cacheWilayas;

    const fichierLocations = path.join(__dirname, "../../client/public/js/algeria-locations.js");
    const source = fs.readFileSync(fichierLocations, "utf8");
    cacheWilayas = vm.runInNewContext(`${source}\nwilayasAlgerie;`, {});

    return cacheWilayas;
}

function obtenirCommunesWilaya(nomWilaya) {
    if (!nomWilaya) return [];

    const wilaya = chargerWilayas().find((item) => item.nom === nomWilaya);
    if (!wilaya) return [nomWilaya];

    return [wilaya.nom, ...wilaya.communes];
}

module.exports = {
    obtenirCommunesWilaya
};
