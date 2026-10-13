"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('annuaire inchangé et vues carte/liste additionnelles',()=>{
 const page=read('client/public/artisans.html');
 assert.match(page,/id="artisans-grid"/);assert.match(page,/id="artisans-filter-form"/);
 assert.match(page,/data-artisan-view="liste"/);assert.match(page,/data-artisan-view="carte"/);
 assert.match(page,/taskly-artisans-map\.js/);
});
test('filtrage côté serveur : artisans approuvés, actifs et e-mail vérifié',()=>{
 const model=read('server/models/artisanModel.js');
 for(const x of ["verification_statut = 'approuve'","statut_compte = 'actif'",'email_verified = 1','a.public_lat IS NOT NULL'])assert.ok(model.includes(x),x);
 assert.match(model,/SELECT a\.id,a\.ville,a\.public_lat/);
});
test('une position ne se publie qu’après choix actif de son artisan, avec arrondi kilométrique',()=>{
 const front=read('client/public/js/taskly-artisan-zone.js'),model=read('server/models/artisanModel.js');
 assert.match(front,/Partager uniquement votre zone approximative/);
 assert.match(front,/data-zone-remove/);
 assert.match(model,/Math\.round\(lat\*20\)\/20/);
});
test('route de carte publique avant la route /:id ; édition réservée au profil connecté',()=>{
 const routes=read('server/routes/artisanRoutes.js');
 assert.ok(routes.indexOf("router.get('/carte'")<routes.indexOf('router.get("/:id"'));
 assert.match(routes,/verifierConnexion/);assert.match(routes,/verifierArtisan/);
 assert.match(read('server/models/artisanModel.js'),/WHERE user_id=\?/);
});
test('migration isolée et rejouable sans effacer les positions existantes',()=>{
 const sql=read('database/migration_localisation_publique.sql');
 assert.match(sql,/information_schema.columns/);assert.match(sql,/information_schema.statistics/);
 assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE|DELETE FROM/i);
 assert.match(read('scripts/migrate.js'),/migration_localisation_publique\.sql/);
});
test('le détail artisan conserve la navigation vers le client accepté',()=>{
 const js=read('client/public/js/artisan-dashboard.js');
 assert.match(js,/autorisee && adresse/);assert.match(js,/google\.com\/maps\/dir/);
});
