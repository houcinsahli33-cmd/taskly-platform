const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const express=require('express'),request=require('./helpers/request');
function load(file,mocks){const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{module,exports:module.exports,require:n=>n in mocks?mocks[n]:require(n),console,Number,String,Buffer});return module.exports;}
function application({userId=42,role='artisan',approved=true,media='application/pdf',name='a'.repeat(64)}={}){
 const queries=[],reads=[];
 const user={id:userId,role,statut_compte:'actif',email_verified:1,admin_session_version:0};
 const auth=load('server/middleware/authMiddleware.js',{'../models/userModel':{trouverUtilisateurParId:async()=>user},'../models/artisanModel':{trouverArtisanParUserId:async()=>({verification_statut:approved?'approuve':'en_attente'})},'../services/accountAccess':require('../server/services/accountAccess')});
 const db={query:async(sql,args)=>{queries.push({sql,args});return [[...(args[0]===7&&args[1]===42?[{stored_name:name,media_type:media}]:[])]];}};
 const routes=load('server/routes/verificationRoutes.js',{express,'../config/db':{promise:()=>db},'../middleware/authMiddleware':auth,'../middleware/documentUpload':{upload:{single:()=>()=>{}},dossier:path.resolve('server/private_uploads'),formatValide:()=>true},'../services/fileStorage':{lire:async(id,prive)=>{reads.push({id,prive});return {contenu:Buffer.from('test-document')};}}});
 const app=express();app.use((req,res,next)=>{req.session={utilisateur:userId?user:null,accountSessionVersion:0,destroy(){}};next();});app.use('/verification',routes);
 return {app,queries,reads};
}
test('document privé : téléchargement du propriétaire et aperçu PDF sans cache',async()=>{
 const {app,queries,reads}=application();
 const download=await request(app,'/verification/documents/7');assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/^attachment/);assert.equal(await download.text(),'test-document');
 const preview=await request(app,'/verification/documents/7?afficher=1');assert.equal(preview.status,200);assert.match(preview.headers.get('content-disposition'),/^inline/);assert.match(preview.headers.get('content-security-policy'),/sandbox/);assert.match(preview.headers.get('cache-control'),/no-store/);assert.equal(preview.headers.get('x-content-type-options'),'nosniff');
 assert.ok(queries.every(q=>q.sql.includes('a.user_id=?')&&q.args[1]===42));assert.ok(reads.every(r=>r.prive===true));
});
test('document privé : un autre artisan ne peut ni lire ni télécharger la pièce',async()=>{
 const {app,reads}=application({userId:99});const res=await request(app,'/verification/documents/7?afficher=1');assert.equal(res.status,404);assert.equal(reads.length,0);
});
for(const [label,options,status] of [['sans session',{userId:null},401],['rôle client',{role:'client'},403],['dossier non approuvé',{approved:false},403]])test('document privé : accès refusé '+label,async()=>{
 const {app,queries}=application(options);assert.equal((await request(app,'/verification/documents/7')).status,status);assert.equal(queries.length,0);
});
test('document privé : ID invalide et stockage hors chemin autorisé refusés',async()=>{
 const normal=application();assert.equal((await request(normal.app,'/verification/documents/0')).status,400);assert.equal(normal.queries.length,0);
 const invalid=application({name:'../../server.env'});assert.equal((await request(invalid.app,'/verification/documents/7')).status,404);assert.equal(invalid.reads.length,0);
});
test('document privé : contenu HTML jamais affiché en ligne',async()=>{
 const {app}=application({media:'text/html'});const res=await request(app,'/verification/documents/7?afficher=1');assert.match(res.headers.get('content-disposition'),/^attachment/);assert.equal(res.headers.get('content-type'),'application/octet-stream');
});
