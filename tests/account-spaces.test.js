'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const spaces=require('../server/services/accountSpaces'),access=require('../server/services/accountAccess');
const client={id:1,role:'client',email:'test@gmail.com',email_verified:1,statut_compte:'actif',admin_session_version:4,compte_slot:0};
const artisan={...client,id:2,role:'artisan',compte_slot:1,service_id:7};
const second={...artisan,id:3,compte_slot:2,service_id:8};
function fixture(comptes=[client,artisan,second],codeValide=true,statut='approuve'){
 const module={exports:{}};let regenerated=0;
 const mocks={fs:require('fs'),path:require('path'),bcrypt:{compare:async()=>true},'../models/userModel':{trouverUtilisateurParId:async id=>comptes.find(c=>Number(c.id)===Number(id)),trouverEspacesParEmail:async()=>comptes},'../models/clientModel':{},'../models/artisanModel':{trouverArtisanParUserId:async()=>({verification_statut:statut})},'../models/serviceModel':{},'../config/db':{promise:()=>({query:async()=>[{}]})},'../services/codeService':{verifierCode:async()=>codeValide,obtenirEtatCode:async()=>({})},'../services/emailService':{},'../services/accountAccess':access,'../services/accountSpaces':spaces};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../server/controllers/authController.js'),'utf8'),{module,require:n=>{if(!(n in mocks))throw Error('Unexpected dependency '+n);return mocks[n];},Buffer,Date,console,process});
 const req={body:{code:'123456',compteId:2}};
 function session(){return {regenerate(cb){regenerated++;req.session=session();cb();},save(cb){cb();}};}
 req.session=session();req.session.verificationPending={userId:1,flow:'connexion',version:4};
 const res={code:200,status(n){this.code=n;return this;},json(data){this.data=data;return this;},set(){return this;}};
 return {controller:module.exports,req,res,regenerations:()=>regenerated};
}
function pending(){return {email:client.email,expiresAt:Date.now()+300000,comptes:[client,artisan,second].map(c=>({id:c.id,version:c.admin_session_version}))};}
test('même e-mail : un client et deux artisans de métiers différents',()=>{assert.equal(spaces.choisirSlot([], 'client'),0);assert.equal(spaces.choisirSlot([client],'artisan',7),1);assert.equal(spaces.choisirSlot([client,artisan],'artisan',8),2);assert.equal(spaces.choisirSlot([artisan,second],'client'),0);});
test('doublon client, troisième artisan et même métier refusés',()=>{for(const [comptes,role,service] of [[[client],'client'],[[artisan,second],'artisan',9],[[artisan],'artisan',7]])assert.throws(()=>spaces.choisirSlot(comptes,role,service),{status:409});});
test('adresse administrateur compatible avec client et deux artisans distincts',()=>{
 const admin={id:4,email:client.email,role:'admin',compte_slot:3};
 assert.equal(spaces.choisirSlot([admin],'client'),0);
 assert.equal(spaces.choisirSlot([admin,client],'artisan',7),1);
 assert.equal(spaces.choisirSlot([admin,client,artisan],'artisan',8),2);
 assert.throws(()=>spaces.choisirSlot([admin,client,artisan,second],'artisan',9),{status:409});
});
test('création liée exige le mot de passe existant sans écraser les identités',async()=>{const bcrypt=require('bcrypt');const hash=await bcrypt.hash('Existing1!',4);const rows=[{...client,mot_de_passe:hash}];const queries=[];const conn={query:async(sql,args)=>{queries.push(sql);return [sql.includes('information_schema')?[{present:1}]:rows];}};await assert.rejects(spaces.preparerInscription(conn,client.email,'artisan',7,'Wrong1!'),{status:403});const result=await spaces.preparerInscription(conn,client.email,'artisan',7,'Existing1!');assert.equal(result.hash,hash);assert.equal(result.slot,1);assert.ok(queries.filter(s=>!s.includes('information_schema')).every(s=>s.includes('FOR UPDATE')));});
test('mot de passe administrateur jamais requis ni réutilisé pour un espace public',async()=>{
 const bcrypt=require('bcrypt');
 const adminHash=await bcrypt.hash('AdminSecret1!',4);
 const publicHash=await bcrypt.hash('PublicSecret1!',4);
 const admin={id:4,role:'admin',compte_slot:3,mot_de_passe:adminHash};
 let rows=[admin];
 const conn={query:async sql=>[sql.includes('information_schema')?[{present:1}]:rows]};
 const debut=await spaces.preparerInscription(conn,client.email,'client',null,'PublicSecret1!');
 assert.equal(debut.slot,0);
 assert.notEqual(debut.hash,adminHash);
 rows=[admin,{...client,mot_de_passe:publicHash}];
 await assert.rejects(spaces.preparerInscription(conn,client.email,'artisan',7,'AdminSecret1!'),{status:403});
 const artisanResult=await spaces.preparerInscription(conn,client.email,'artisan',7,'PublicSecret1!');
 assert.equal(artisanResult.hash,publicHash);
});
test('choix des espaces après vérification exclut toujours administration',async()=>{
 const admin={...client,id:4,role:'admin',compte_slot:3};
 const f=fixture([admin,client,artisan,second]);
 await f.controller.confirmerEmail(f.req,f.res);
 assert.equal(f.req.session.accountChoice.comptes.length,3);
 await f.controller.espacesDisponibles(f.req,f.res);
 assert.deepEqual(Array.from(f.res.data.comptes,c=>c.role),['client','artisan','artisan']);
});
test('pas de choix ni session complète avant validation du code',async()=>{const f=fixture(undefined,false);await f.controller.confirmerEmail(f.req,f.res);assert.equal(f.res.code,400);assert.equal(f.req.session.accountChoice,undefined);assert.equal(f.req.session.utilisateur,undefined);});
test('code valide : trois choix, sans accès à un profil avant sélection',async()=>{const f=fixture();await f.controller.confirmerEmail(f.req,f.res);assert.equal(f.res.data.choixCompteRequis,true);assert.equal(f.req.session.accountChoice.comptes.length,3);assert.equal(f.req.session.utilisateur,undefined);assert.equal(f.regenerations(),1);await f.controller.espacesDisponibles(f.req,f.res);assert.equal(f.res.data.comptes.length,3);assert.equal(f.res.data.comptes.some(c=>'mot_de_passe' in c),false);});
test('un seul compte garde la connexion existante',async()=>{const f=fixture([client]);await f.controller.confirmerEmail(f.req,f.res);assert.equal(f.req.session.utilisateur.id,1);assert.equal(f.req.session.accountChoice,undefined);});
test('sélection sans code validé, expirée, identifiant étranger, admin ou version révoquée refusée',async()=>{for(const mode of ['absent','expire','etranger','admin','version','email']){const comptes=[{...client},{...artisan},{...second}];const f=fixture(comptes);delete f.req.session.verificationPending;f.req.session.accountChoice=pending();if(mode==='absent')delete f.req.session.accountChoice;if(mode==='expire')f.req.session.accountChoice.expiresAt=0;if(mode==='etranger')f.req.body.compteId=99;if(mode==='admin')comptes[1].role='admin';if(mode==='version')comptes[1].admin_session_version++;if(mode==='email')comptes[1].email='other@gmail.com';await f.controller.choisirEspace(f.req,f.res);assert.equal(f.res.code,403,mode);assert.equal(f.req.session.utilisateur,undefined,mode);}});
test('choix artisan approuvé : identité sélectionnée uniquement et session renouvelée',async()=>{const f=fixture();f.req.session.accountChoice=pending();await f.controller.choisirEspace(f.req,f.res);assert.equal(f.req.session.utilisateur.id,2);assert.equal(f.req.session.utilisateur.role,'artisan');assert.equal(f.req.session.accountSessionVersion,4);assert.equal(f.req.session.accountChoice,undefined);assert.equal(f.regenerations(),1);});
for(const statut of ['en_attente','refuse','a_completer'])test('choix artisan '+statut+' : support uniquement',async()=>{const f=fixture(undefined,true,statut);f.req.session.accountChoice=pending();await f.controller.choisirEspace(f.req,f.res);assert.equal(f.res.data.supportSeulement,true);assert.equal(f.req.session.supportIdentity.userId,2);assert.equal(f.req.session.utilisateur,undefined);});
test('client bloqué ne peut pas être choisi',async()=>{const f=fixture([{...client,statut_compte:'bloque'},artisan]);f.req.body.compteId=1;f.req.session.accountChoice=pending();await f.controller.choisirEspace(f.req,f.res);assert.equal(f.res.code,403);assert.equal(f.req.session.utilisateur,undefined);});
test('artisan bloqué reste limité au suivi et au support',async()=>{const f=fixture([client,{...artisan,statut_compte:'bloque'}]);f.req.session.accountChoice=pending();await f.controller.choisirEspace(f.req,f.res);assert.equal(f.res.data.supportSeulement,true);assert.equal(f.req.session.utilisateur,undefined);});
test('code émis avant changement de mot de passe ne crée aucune session',async()=>{const f=fixture([{...client,admin_session_version:5},artisan]);await f.controller.confirmerEmail(f.req,f.res);assert.equal(f.res.code,401);assert.equal(f.req.session.accountChoice,undefined);});

test('avant migration : inscription simple conservée, ajout d’un espace désactivé clairement',async()=>{
 const conn={query:async sql=>[sql.includes('information_schema')?[{present:0}]:[]]};const nouveau=await spaces.preparerInscription(conn,'new@gmail.com','client',null,'Existing1!');assert.equal(nouveau.multiEspaces,false);
 conn.query=async sql=>[sql.includes('information_schema')?[{present:0}]:[client]];await assert.rejects(spaces.preparerInscription(conn,client.email,'artisan',7,'Existing1!'),{status:503});
});
