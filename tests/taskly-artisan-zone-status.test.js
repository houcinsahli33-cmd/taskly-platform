"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('server/controllers/artisanController.js','utf8');
function fixture(result,role='artisan'){
 const calls=[]; const module={exports:{}};
 vm.runInNewContext(source,{module,console,require:n=>{assert.equal(n,'../models/artisanModel');return {lireEtatZone:async id=>{calls.push(id);if(result instanceof Error)throw result;return result;}};}});
 const req={session:{utilisateur:{role,id:19}},body:{userId:999},query:{userId:998}};
 const res={code:200,set(k,v){this.header=v;},status(n){this.code=n;return this;},json(x){this.data=x;return this;}};
 return {handler:module.exports.lireEtatZone,req,res,calls};
}
test('Zone : état réel booléen, exclusivement profil session',async()=>{for(const state of [true,false]){const f=fixture(state);await f.handler(f.req,f.res);assert.equal(f.res.data.visible,state);assert.equal(Object.keys(f.res.data).length,1);assert.deepEqual(f.calls,[19]);assert.match(f.res.header,/no-store/);}});
test('Zone : client interdit, aucune lecture',async()=>{const f=fixture(true,'client');await f.handler(f.req,f.res);assert.equal(f.res.code,403);assert.equal(f.calls.length,0);});
test('Zone : profil absent ou panne ne simulent pas une zone masquée',async()=>{for(const [value,code] of [[null,404],[new Error('DB'),503]]){const f=fixture(value);await f.handler(f.req,f.res);assert.equal(f.res.code,code);assert.equal('visible' in f.res.data,false);}});
test('Zone : lecture protégée et SQL sans coordonnées brutes',()=>{const model=fs.readFileSync('server/models/artisanModel.js','utf8');const routes=fs.readFileSync('server/routes/artisanRoutes.js','utf8');assert.match(model,/SELECT CASE WHEN public_lat IS NOT NULL AND public_lon IS NOT NULL[\s\S]*?FROM artisans WHERE user_id = \? LIMIT 2/);assert.match(routes,/router\.get\('\/ma-zone',\s*verifierConnexion,\s*verifierArtisan,\s*artisanController\.lireEtatZone/);});
