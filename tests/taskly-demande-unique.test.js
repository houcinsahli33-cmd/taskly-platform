'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../server/models/demandeModel.js'),'utf8');
function mock({rows=[],dateBusy=false,tidb=true,failInsert=false}={}){
 let tail=Promise.resolve();let nextId=100;const queries=[];const records=rows.map(r=>({...r}));
 const active=new Set(['en_attente','acceptee','attente_confirmation','conteste']);
 const db={promise:()=>({getConnection:async()=>{
  let unlock=null,pending=null;
  const finish=()=>{if(unlock){unlock();unlock=null;}};
  return {beginTransaction:async()=>queries.push('BEGIN'),commit:async()=>{if(pending)records.push(pending);queries.push('COMMIT');finish();},rollback:async()=>{pending=null;queries.push('ROLLBACK');finish();},release:()=>queries.push('RELEASE'),query:async(sql,params=[])=>{
   queries.push(sql);
   if(sql==='SELECT VERSION() AS version')return [[{version:tidb?'8.0.11-TiDB-v8':'8.0.40'}]];
   if(sql==='BEGIN PESSIMISTIC')return [[]];
   if(sql.includes('FROM clients WHERE')){let before=tail;tail=new Promise(r=>unlock=r);await before;return [[{id:params[0]}]];}
   if(sql.includes('SELECT id, statut FROM demandes'))return [records.filter(r=>r.client_id===params[0]&&r.artisan_id===params[1]&&active.has(r.statut)).slice(0,1)];
   if(sql.includes('date_souhaitee = ?'))return [dateBusy?[{id:9}]:[]];
   if(sql.includes('INSERT INTO demandes')){if(failInsert)throw Error('insert failed');pending={id:nextId++,client_id:params[0],artisan_id:params[1],statut:'en_attente'};return [{insertId:pending.id}];}
   throw Error('Unexpected SQL '+sql);
  }};
 }})};
 const m={exports:{}};vm.runInNewContext(src,{module:m,exports:m.exports,require:n=>{assert.equal(n,'../config/db');return db;}});
 return {model:m.exports,records,queries};
}
const make=(m,c=1,a=2,d=null)=>m.creerDemande(c,a,'test','test',d);
for(const statut of ['en_attente','acceptee','attente_confirmation','conteste'])test('demande ouverte '+statut+' interdit un doublon',async()=>{const x=mock({rows:[{id:7,client_id:1,artisan_id:2,statut}]});await assert.rejects(make(x.model),e=>e.code==='TASKLY_DEMANDE_OUVERTE'&&e.demande.id===7);assert.ok(x.queries.includes('ROLLBACK'));assert.ok(x.queries.includes('RELEASE'));assert.equal(x.records.length,1);});
for(const statut of ['terminee','refusee','annulee'])test('demande cloturee '+statut+' autorise une nouvelle demande',async()=>{const x=mock({rows:[{id:7,client_id:1,artisan_id:2,statut}]});await make(x.model);assert.equal(x.records.length,2);});
test('autre client ou autre artisan reste autorise',async()=>{const x=mock({rows:[{id:7,client_id:1,artisan_id:2,statut:'en_attente'}]});await make(x.model,1,3);await make(x.model,2,2);assert.equal(x.records.length,3);});
test('deux requetes simultanees: une insertion et un conflit (verrou simule)',async()=>{const x=mock();const results=await Promise.allSettled([make(x.model),make(x.model)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'TASKLY_DEMANDE_OUVERTE');assert.equal(x.records.length,1);assert.ok(x.queries.includes('BEGIN PESSIMISTIC'));assert.ok(x.queries.some(q=>q.includes('FROM clients WHERE')&&q.includes('FOR UPDATE')));});
test('la reservation de date reste controlee et MySQL utilise une transaction classique',async()=>{assert.match(src,/jourReserveArtisan\(artisanId,dateSouhaitee\)/);const x=mock({dateBusy:true,tidb:false});await assert.rejects(make(x.model,1,2,'2026-12-01'),e=>e.code==='TASKLY_DATE_OCCUPEE');assert.ok(x.queries.includes('BEGIN'));assert.equal(x.records.length,0);});
test('erreur SQL: rollback et liberation de la connexion',async()=>{const x=mock({failInsert:true});await assert.rejects(make(x.model),/insert failed/);assert.deepEqual(x.queries.slice(-2),['ROLLBACK','RELEASE']);});
const ctrl=fs.readFileSync(path.join(__dirname,'../server/controllers/demandeController.js'),'utf8');
function controller(model,clientModel={trouverClientParUserId:async()=>({id:42})}){const module={exports:{}};vm.runInNewContext(ctrl,{module,exports:module.exports,require:n=>({'../models/demandeModel':model,'../models/clientModel':clientModel,'../models/artisanModel':{trouverArtisanParId:async()=>({id:8})},'../services/tasklyMail':{},'../services/tasklyConfirmation':{}}[n]),console});return module.exports;}
function res(){return {code:200,set(){return this;},status(x){this.code=x;return this;},json(x){this.body=x;return this;}};}
test('controle HTTP limite au client de session et ne renvoie que id et statut',async()=>{let call;const c=controller({trouverDemandeOuverte:async(...args)=>{call=args;return {id:7,statut:'acceptee',adresse:'private'};}});const r=res();await c.demandeOuverte({params:{artisanId:'8'},session:{utilisateur:{id:1}},body:{clientId:999}},r);assert.deepEqual(call,[42,8]);assert.equal(JSON.stringify(r.body),JSON.stringify({demande:{id:7,statut:'acceptee'}}));});
test('HTTP creation refuse le doublon avec 409 sans notification',async()=>{const c=controller({creerDemande:async()=>{throw Object.assign(Error('En cours'),{code:'TASKLY_DEMANDE_OUVERTE',demande:{id:7,statut:'en_attente'}});}});const r=res();await c.creerDemande({body:{artisanId:8,message:'test',adresse:'test'},session:{utilisateur:{id:1}}},r);assert.equal(r.code,409);assert.equal(r.body.code,'TASKLY_DEMANDE_OUVERTE');assert.equal(r.body.demande.id,7);});
