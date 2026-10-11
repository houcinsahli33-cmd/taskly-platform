const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const access=require('../server/services/accountAccess');
for(const statut of ['en_attente','refuse','a_completer','approuve'])test('autorisation complète artisan '+statut,()=>assert.equal(access.autoriserEspace({role:'artisan',email_verified:1,statut_compte:'actif'},{verification_statut:statut}),statut==='approuve'));
test('client sans validation artisan',()=>assert.equal(access.autoriserEspace({role:'client',email_verified:1,statut_compte:'actif'},null),true));
test('artisan bloqué même avec dossier approuvé',()=>assert.equal(access.autoriserEspace({role:'artisan',email_verified:1,statut_compte:'bloque'},{verification_statut:'approuve'}),false));
function load(file,mocks){const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{module,exports:module.exports,require:n=>n in mocks?mocks[n]:require(n),Buffer,Date,console,process,setTimeout});return module.exports;}
for(const statut of ['en_attente','a_completer','refuse','approuve'])test('code e-mail : session limitée ou complète '+statut,async()=>{
 const db={query:async()=>[{}]};
 const user={id:42,role:'artisan',email_verified:1,statut_compte:statut==='refuse'?'bloque':'actif',admin_session_version:0};
 const mocks={'../models/userModel':{trouverUtilisateurParId:async()=>user,trouverEspacesParEmail:async()=>[user]},'../models/clientModel':{},'../models/artisanModel':{trouverArtisanParUserId:async()=>({verification_statut:statut})},'../models/serviceModel':{},'../config/db':{promise:()=>db},'../services/codeService':{verifierCode:async()=>true,obtenirEtatCode:async()=>({})},'../services/emailService':{},'../services/accountAccess':access,bcrypt:{},fs:{},path:{}};
 const c=load('server/controllers/authController.js',mocks),req={body:{code:'123456'}};
 function session(){return {regenerate(cb){req.session=session();cb();},save(cb){cb();}};}
 req.session=session();req.session.verificationPending={userId:42,flow:'connexion'};
 const res={status(n){this.code=n;return this;},json(d){this.data=d;return this;}};
 await c.confirmerEmail(req,res);
 if(statut==='approuve'){assert.equal(req.session.utilisateur.id,42);assert.equal(req.session.supportIdentity,undefined);}
 else{assert.equal(req.session.utilisateur,undefined);assert.equal(req.session.supportIdentity.userId,42);assert.equal(res.data.supportSeulement,true);}
});
test('suppression exclut admin avant toute écriture',async()=>{
 const service=load('server/services/accountDeletion.js',{bcrypt:{compare:async()=>true}});let writes=0;
 const conn={query:async sql=>{if(sql.startsWith('SELECT'))return [[{id:1,role:'admin'}]];writes++;return [{affectedRows:1}];}};
 await assert.rejects(service.supprimer(conn,1,'password',{operateur:true}));assert.equal(writes,0);
});
test('suppression requiert mot de passe et retire pièces privées',async()=>{
 const service=load('server/services/accountDeletion.js',{bcrypt:{compare:async(p)=>p==='correct'}}),queries=[];
 const conn={query:async(sql,args)=>{queries.push([sql,args]);if(sql.includes('SELECT id,role'))return [[{id:2,role:'artisan',mot_de_passe:'hash'}]];if(sql.includes('SELECT d.stored_name'))return [[{stored_name:'a'.repeat(64)}]];return [{affectedRows:1}];}};
 await assert.rejects(service.supprimer(conn,2,'incorrect'));assert.equal(queries.length,1);queries.length=0;
 await service.supprimer(conn,2,'correct');assert.ok(queries.some(([sql])=>sql.includes("role IN ('client','artisan')")));assert.ok(queries.some(([sql,args])=>sql.includes('stored_files')&&args[0]==='a'.repeat(64)));
});
