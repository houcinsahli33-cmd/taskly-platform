'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const c=require('../server/helpers/creneauxIntervention');
const jour='2099-11-28', maintenant=new Date('2099-11-27T12:00:00Z');
const code=x=>e=>e.code===x;
const src=fs.readFileSync(path.join(__dirname,'../server/models/demandeModel.js'),'utf8');
function modele({occupes=[],double=false}={}){
 const queries=[];let insert=null, committed=false;
 const conn={beginTransaction:async()=>{},commit:async()=>{committed=true;},rollback:async()=>{insert=null;},release:()=>{},query:async(sql,p=[])=>{
  queries.push(sql);
  if(sql.startsWith('SELECT VERSION'))return [[{version:'TiDB'}]];
  if(sql==='BEGIN PESSIMISTIC')return [[]];
  if(sql.includes('FROM clients WHERE'))return [[{id:p[0]}]];
  if(sql.includes('SELECT id, statut'))return [double?[{id:9,statut:'en_attente'}]:[]];
  if(sql.includes('SELECT id FROM artisans'))return [[{id:p[0]}]];
  if(sql.includes('SELECT creneau_debut_minute'))return [occupes];
  if(sql.includes('INSERT INTO demandes')){insert=p;return [{insertId:7}];}
  throw Error('SQL inattendu '+sql);
 }};
 const db={promise:()=>({getConnection:async()=>conn})};
 const m={exports:{}};vm.runInNewContext(src,{module:m,exports:m.exports,require:n=>n==='../config/db'?db:n==='../helpers/creneauxIntervention'?c:undefined});
 return {m:m.exports,queries,get insert(){return insert;},get committed(){return committed;}};
}
const occ={creneau_debut_minute:600,creneau_fin_minute:660,creneau_blocage_minute:690};
test('un rendez-vous de 10 h à 11 h ne bloque pas le jour : trajet inclus',()=>{
 const h=c.heuresProposables(jour,[c.intervalle(occ)],maintenant);
 assert.ok(h.includes(555));assert.ok(!h.includes(570));assert.ok(!h.includes(600));assert.ok(!h.includes(675));assert.ok(h.includes(690));
});
test('ancienne réservation sans horaire bloque tous les débuts',()=>assert.deepEqual(c.heuresProposables(jour,[null],maintenant),[]));
test('les choix du jour excluent le passé en heure algérienne et le passage de minuit',()=>{
 const h=c.heuresProposables(jour,[],new Date(jour+'T09:00:00Z'));
 assert.equal(h[0],615);assert.equal(h.at(-1),1395);
 assert.throws(()=>c.normaliserHeureSouhaitee('10:07'),code('TASKLY_CRENEAU_INVALIDE'));
});
test('création: une heure libre est enregistrée sans réservation ni durée',async()=>{
 const x=modele({occupes:[occ]});await x.m.creerDemande(1,2,'test','test',jour,'11:30');
 assert.equal(x.insert[5],690);assert.ok(x.committed);assert.ok(x.queries.some(q=>q.includes('FROM artisans')&&q.includes('FOR UPDATE')));
 assert.ok(x.queries.some(q=>q.includes('SELECT creneau_debut_minute')&&q.includes('FOR UPDATE')));
 assert.ok(!x.queries.some(q=>q.trimStart().startsWith('UPDATE demandes')));
});
test('création: conflit horaire rejeté avant insertion',async()=>{
 const x=modele({occupes:[occ]});await assert.rejects(x.m.creerDemande(1,2,'test','test',jour,'10:30'),code('TASKLY_CRENEAU_OCCUPE'));assert.equal(x.insert,null);assert.equal(x.committed,false);
});
test('création: heure sans date ou jour invalide rejetés',async()=>{
 for(const date of [null,'2099-02-31']){const x=modele();await assert.rejects(x.m.creerDemande(1,2,'test','test',date,'10:00'),code('TASKLY_CRENEAU_INVALIDE'));assert.equal(x.insert,null);}
});
test('la protection contre les demandes en double reste prioritaire',async()=>{
 const x=modele({double:true});await assert.rejects(x.m.creerDemande(1,2,'test','test',jour,'11:30'),code('TASKLY_DEMANDE_OUVERTE'));assert.equal(x.insert,null);
});
function acceptPool(){
 let updates=0;const conn={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{},query:async(sql)=>{
  if(sql.startsWith('SELECT VERSION'))return [[{version:'TiDB'}]];
  if(sql==='BEGIN PESSIMISTIC')return [[]];
  if(sql.includes('SELECT id FROM artisans'))return [[{id:2}]];
  if(sql.includes('DATE_FORMAT'))return [[{id:7,jour,creneau_debut_minute:600}]];
  if(sql.includes('SELECT creneau_debut_minute'))return [[]];
  if(sql.includes('UPDATE demandes')){updates++;return [{affectedRows:1}];}
  throw Error('SQL inattendu '+sql);
 }};return {pool:{getConnection:async()=>conn},get updates(){return updates;}};
}
test('artisan: impossible d’ignorer ou de changer l’heure demandée',async()=>{
 for(const slot of [undefined,{heureDebut:'11:00',dureeMinutes:30}]){const x=acceptPool();await assert.rejects(c.accepter(x.pool,7,2,slot),code('TASKLY_CRENEAU_INVALIDE'));assert.equal(x.updates,0);}
 const x=acceptPool();await c.accepter(x.pool,7,2,{heureDebut:'10:00',dureeMinutes:30});assert.equal(x.updates,1);
});
test('la route de lecture est protégée et les réponses ne fournissent que des heures',()=>{
 const routes=fs.readFileSync(path.join(__dirname,'../server/routes/artisanRoutes.js'),'utf8');
 assert.match(routes,/router\.get\('\/:id\/creneaux-disponibles', verifierConnexion, verifierClient, artisanController\.creneauxDisponibles\)/);
 assert.match(src,/return \{heures:creneaux\.heuresProposables\(jour,autres\)\}/);
});
