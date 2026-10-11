'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),express=require('express');
const service=require('../server/services/siteSettings');
const valid={email:'contact@taskly.dz',facebook:'https://www.facebook.com/taskly',instagram:'',twitter:'',linkedin:''};
test('paramètres publics : e-mail normalisé, réseaux vides et HTTPS acceptés',()=>{
  assert.deepEqual(service.valider({...valid,email:' CONTACT@TASKLY.DZ '}),valid);
});
test('paramètres publics : scripts, HTTP, identifiants et champs inconnus refusés',()=>{
  for (const facebook of ['javascript:alert(1)','http://facebook.com/taskly','https://secret:pwd@facebook.com','https://example.com/<script>'])
    assert.throws(()=>service.valider({...valid,facebook}),{status:400});
  assert.throws(()=>service.valider({...valid,smtpPassword:'secret'}),{status:400});
  assert.throws(()=>service.valider({...valid,email:'bad\nemail@example.com'}),{status:400});
});
test('écriture des coordonnées : transaction et audit, rollback en cas de panne',async()=>{
  for(const fail of [false,true]) {
    const events=[],calls=[];
    const conn={beginTransaction:async()=>events.push('begin'),commit:async()=>events.push('commit'),rollback:async()=>events.push('rollback'),release:()=>events.push('release'),query:async(sql,args)=>{
      calls.push([sql,args]);if(fail&&sql.includes('admin_audit_logs'))throw Error('DB failure');return [{}];
    }};
    const run=()=>service.enregistrer({getConnection:async()=>conn},valid,60002);
    if(fail)await assert.rejects(run);else assert.deepEqual(await run(),valid);
    assert.deepEqual(events,['begin',fail?'rollback':'commit','release']);
    assert.equal(calls.length,6);assert.equal(calls.at(-1)[1][0],60002);
    assert.ok(calls.every(([sql])=>!sql.includes(valid.facebook)), 'Valeurs paramétrées');
  }
});
function router(niveau){
  const module={exports:{}},writes=[];
  const sql={query:async()=>[[{niveau}]]};
  const mocks={
    '../config/db':{promise:()=>sql},
    '../middleware/authMiddleware':{
      verifierConnexion:(req,res,next)=>req.session.utilisateur?next():res.status(401).json({message:'Connexion requise.'}),
      verifierAdmin:(req,res,next)=>req.session.utilisateur.role==='admin'?next():res.status(403).json({message:'Accès refusé.'})
    },
    '../middleware/securityMiddleware':{limiter:()=>((req,res,next)=>next())},
    '../services/adminMailService':{envoyerCourrielAdmin:async()=>{}},
    '../services/siteSettings':{lire:async()=>valid,enregistrer:async(pool,body,id)=>{const values=service.valider(body);writes.push([id,values]);return values;}}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../server/routes/adminSettingsRoutes.js'),'utf8'),{module,exports:module.exports,require:n=>mocks[n]||require(n),Buffer,Date,process,console});
  return {router:module.exports,writes};
}
for(const niveau of ['principal','secondaire',undefined])test('coordonnées : autorisation serveur '+String(niveau),async()=>{
  const r=router(niveau),app=express();app.use(express.json());app.use((req,res,next)=>{req.session={utilisateur:{id:60002,role:'admin'}};next();});app.use(r.router);
  const response=await require('./helpers/request')(app,'/site',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(valid)});
  assert.equal(response.status,niveau==='principal'?200:403);
  assert.equal(r.writes.length,niveau==='principal'?1:0);
});
test('migration des coordonnées : pas de remplacement des données existantes',()=>{
  const sql=fs.readFileSync(path.join(__dirname,'../database/migration_parametres_site.sql'),'utf8');
  assert.match(sql,/CREATE TABLE IF NOT EXISTS/);assert.match(sql,/INSERT IGNORE/);
  assert.doesNotMatch(sql,/DROP|TRUNCATE|UPDATE users|DELETE FROM/i);
});
