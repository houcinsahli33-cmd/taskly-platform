"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {normalize,rank,approximate,group}=require('../client/public/js/taskly-artisans-map.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Carte premium : données invalides, doublons, notes sans avis',()=>{
 const a={id:1,lat:36.7,lon:4.1,moyenne_notes:4.8,total_avis:2,distanceKm:3};
 const r=normalize([a,a,{id:2,lat:null,lon:4},{...a,id:3,total_avis:0}]);assert.equal(r.length,2);assert.equal(r[0].note,4.8);assert.equal(r[1].note,null);assert.equal(group(r)[0].length,2);
});
test('Carte premium : tri et filtre reposent sur les notes réelles',()=>{
 const r=normalize([{id:1,lat:36,lon:4,moyenne_notes:4,total_avis:2,distanceKm:1},{id:2,lat:36,lon:4,moyenne_notes:4.9,total_avis:3,distanceKm:6},{id:3,lat:36,lon:4,total_avis:0}]);
 assert.deepEqual(rank(r,'distance',false).map(x=>x.id),[1,2,3]);assert.deepEqual(rank(r,'note',false).map(x=>x.id),[2,1,3]);assert.deepEqual(rank(r,'note',true).map(x=>x.id),[2]);assert.equal(r[0].id,1);
});
test('Carte premium : localisation arrondie et positions invalides rejetées',()=>{assert.deepEqual(approximate(36.713,4.123),[36.7,4.1]);assert.equal(approximate(null,4),null);assert.equal(approximate(91,4),null);});
test('Carte premium : API conserve les conditions de confidentialité et paramètre le rayon',async()=>{
 let captured;const db={promise:()=>({query:async(sql,params)=>{captured={sql,params};return [[{id:1,lat:36.7,lon:4.1,moyenne_notes:4.9,total_avis:4}]];}})};const module={exports:{}};
 vm.runInNewContext(read('server/models/artisanModel.js'),{module,require:n=>n==='../config/db'?db:{obtenirCommunesWilaya:()=>[]},console});
 const r=await module.exports.artisansPourCarte({serviceId:4},36.7,4.1,50);assert.equal(r[0].distanceKm,0);assert.match(captured.sql,/FROM avis av WHERE av.artisan_id=a.id/);assert.match(captured.sql,/verification_statut = 'approuve'/);assert.match(captured.sql,/a.public_lat IS NOT NULL/);assert.equal(captured.params[0],4);assert.doesNotMatch(captured.sql,/a.telephone|u.email[, ]/);
});
test('Carte premium : structure conserve le formulaire, le header et les deux vues',()=>{const h=read('client/public/artisans.html');for(const v of ['id="site-header"','id="artisans-filter-form"','id="artisans-grid"','id="request-modal"','data-map-radius="50"','id="tmp-results"','id="tmp-geo"'])assert.ok(h.includes(v),v);assert.doesNotMatch(read('client/public/css/taskly-artisans-map.css'),/backdrop-filter|#site-header|\.main-nav/);});

test('Carte premium V2 : commandes et statistiques dynamiques sans toucher au cadre',()=>{const h=read('client/public/artisans.html');for(const id of ['tmp-toolbar','tmp-head-count','tmp-head-scope','tmp-recenter','tmp-page-buttons','tmp-side-title'])assert.equal((h.match(new RegExp('id="'+id+'"','g'))||[]).length,1);assert.match(h,/id="site-header"><\/div>/);assert.match(h,/taskly-artisans-map\.css\?v=premium2/);});
test('Carte premium V2 : aucun statut de disponibilité ni position inventée',()=>{const src=read('client/public/js/taskly-artisans-map.js');assert.match(src,/let map=null[^;]*center=null/);assert.match(src,/PAGE=3/);assert.match(src,/geo\.addEventListener\('click',locate\)/);assert.doesNotMatch(src,/Disponibilité confirmée|Intervention rapide/);});
