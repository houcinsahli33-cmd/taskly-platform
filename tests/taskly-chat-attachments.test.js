'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
function load(path,mocks={},env={}){
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path,'utf8'),{
  module,exports:module.exports,console,Buffer,process:{env},encodeURIComponent,BigInt,
  require(id){if(Object.hasOwn(mocks,id))return mocks[id];if(id==='node:crypto')return crypto;throw new Error('Unexpected import '+id);}
 },{filename:path});
 return module.exports;
}
const attPath='server/services/chatAttachments.js';
const controllerPath='server/controllers/chatAttachmentsController.js';
const modelPath='server/models/chatModel.js';
function pdf(){return {mimetype:'application/pdf',originalname:'projet.pdf',buffer:Buffer.from('%PDF-1.4\nHello')};}
function attach(){return load(attPath,{'../middleware/documentUpload':{formatValide:(b,m)=>m==='application/pdf'&&b.subarray(0,5).toString()==='%PDF-'}});}
function response(){return {code:200,headers:{},status(n){this.code=n;return this;},set(n,v){this.headers[n]=v;return this;},json(v){this.body=v;return this;},send(v){this.content=v;return this;}};}
function controller({active=true,participant={demandeId:12,role:'client',profilId:7,demande:{statut:'acceptee',messagerie_bloquee:0}},fileId=8,doc=null}={}){
 const calls=[];
 const access={verifierParticipant:async(req,res)=>participant,historiqueAutorise:()=>true};
 const docs={...attach(),lire:async(...a)=>{calls.push(['read',...a]);return doc||{filename:'projet.pdf',media_type:'application/pdf',contenu:pdf().buffer};}};
 const ctrl=load(controllerPath,{
  '../middleware/documentUpload':{upload:{single:()=>()=>{}}},
  './chatController':access,
  '../models/chatModel':{envoyerFichier:async(...a)=>{calls.push(['write',...a]);return fileId;}},
  '../services/chatAttachments':docs,
  '../config/db':{promise:()=>({query:async()=>[]})}
 },{TASKLY_CHAT_ATTACHMENTS_ENABLED:active?'true':'false'});
 return {ctrl,calls};
}
function request(){return {params:{id:'12',messageId:'30'},body:{contenu:'Voici le document'},file:pdf()};}
test('PDF authentique et nom contrôlé',()=>{
 const a=attach();const x=a.decrire(pdf());assert.equal(x.filename,'projet.pdf');assert.equal(x.mime,'application/pdf');assert.equal(x.size,pdf().buffer.length);assert.equal(x.sha256,crypto.createHash('sha256').update(pdf().buffer).digest('hex'));
 const b=pdf();b.originalname='../dossier/mauvais.exe';assert.equal(a.decrire(b).filename,'mauvais.pdf');
});
test('Les formats inconnus, signatures fausses et fichiers vides sont refusés',()=>{
 const a=attach();for(const file of [undefined,{...pdf(),mimetype:'application/zip'},{...pdf(),buffer:Buffer.from('fake pdf')},{...pdf(),buffer:Buffer.alloc(0)},{...pdf(),buffer:Buffer.alloc(3*1024*1024+1)}])assert.throws(()=>a.decrire(file));
});
test('Un ID message invalide est refusé',()=>{
 const a=attach();for(const id of ['-1','0','1 or 1','99999999999999999999','abc','',1])assert.equal(a.idMessage(id),false);
 assert.equal(a.idMessage('9223372036854775807'),true);
});
test('Envoi de fichier désactivé par défaut',async()=>{
 const {ctrl}=controller({active:false}),res=response();await ctrl.envoyer(request(),res);assert.equal(res.code,404);
});
test('Envoi impossible quand conversation close ou bloquée',async()=>{
 for(const demande of [{statut:'terminee',messagerie_bloquee:0},{statut:'acceptee',messagerie_bloquee:1}]){
  const {ctrl,calls}=controller({participant:{demandeId:12,role:'client',profilId:7,demande}}),res=response();await ctrl.envoyer(request(),res);assert.equal(res.code,403);assert.equal(calls.length,0);
 }
});
test('Envoi impossible hors participant',async()=>{
 const {ctrl,calls}=controller({participant:null}),res=response();await ctrl.envoyer(request(),res);assert.equal(calls.length,0);
});
test('Envoi refuse un texte de plus de 4000 caractères',async()=>{
 const {ctrl,calls}=controller(),res=response(),req=request();req.body.contenu='a'.repeat(4001);await ctrl.envoyer(req,res);assert.equal(res.code,400);assert.equal(calls.length,0);
});
test('Envoi autorisé : rattachement au profil et à la demande',async()=>{
 const {ctrl,calls}=controller(),res=response();await ctrl.envoyer(request(),res);assert.equal(res.code,201);assert.deepEqual(calls[0].slice(0,5),['write',12,'client',7,'Voici le document']);
});
test('Envoi fichier sans texte est autorisé',async()=>{
 const {ctrl,calls}=controller(),res=response(),req=request();req.body.contenu='';await ctrl.envoyer(req,res);assert.equal(res.code,201);assert.equal(calls[0][4],'Pièce jointe');
});
test('Téléchargement réservé au participant, même après clôture',async()=>{
 const {ctrl,calls}=controller(),res=response();await ctrl.telecharger(request(),res);assert.equal(res.code,200);assert.match(res.headers['Content-Disposition'],/attachment/);assert.equal(res.headers['Cache-Control'],'private, no-store');assert.equal(calls[0][2],12);assert.equal(calls[0][3],'30');
 const {ctrl:denied,calls:miss}=controller({participant:null}),out=response();await denied.telecharger(request(),out);assert.equal(miss.length,0);
});
test('Téléchargement interdit si ID de message invalide',async()=>{
 const {ctrl,calls}=controller(),res=response(),req=request();req.params.messageId='1 OR 1';await ctrl.telecharger(req,res);assert.equal(res.code,400);assert.equal(calls.length,0);
});
test('Lecture SQL limite le fichier à la demande et au stockage privé',async()=>{
 const a=attach(),queries=[];
 const db={query:async(sql,params)=>{queries.push({sql,params});return [[{filename:'projet.pdf',media_type:'application/pdf',byte_size:pdf().buffer.length,sha256:crypto.createHash('sha256').update(pdf().buffer).digest('hex'),contenu:pdf().buffer}]];}};
 const d=await a.lire(db,12,'30');assert.equal(d.filename,'projet.pdf');assert.match(queries[0].sql,/m\.demande_id=\?/);assert.match(queries[0].sql,/f\.prive=1/);assert.deepEqual(Array.from(queries[0].params),[12,'30']);
});
test('Lecture refuse les données binaires altérées',async()=>{
 const a=attach(),b=pdf().buffer;
 const db={query:async()=>[[{filename:'a.pdf',media_type:'application/pdf',byte_size:b.length,sha256:'0'.repeat(64),contenu:b}]]};
 await assert.rejects(a.lire(db,12,'30'));
});
test('Transaction : écriture message+fichier+association, commit',async()=>{
 const calls=[],conn={beginTransaction:async()=>calls.push('begin'),query:async(sql)=>{calls.push(sql);return sql.includes('INSERT INTO taskly_chat_messages')?[{affectedRows:1,insertId:30}]:[{affectedRows:1}];},commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>calls.push('release')};
 const model=load(modelPath,{'../config/db':{promise:()=>({getConnection:async()=>conn})},'../services/fileStorage':{enregistrer:async(file,prive,c)=>{calls.push('storage');assert.equal(prive,true);assert.equal(c,conn);return 'a'.repeat(64);}}});
 const id=await model.envoyerFichier(12,'client',7,'Bonjour',pdf(),attach().decrire(pdf()));assert.equal(id,30);assert.equal(calls[0],'begin');assert.equal(calls.at(-2),'commit');assert.ok(calls.some(x=>typeof x==='string'&&x.includes('taskly_chat_attachments')));assert.ok(calls.some(x=>typeof x==='string'&&x.includes("d.statut='acceptee'")));assert.ok(calls.some(x=>typeof x==='string'&&x.includes('autoriser_messagerie=1')));
});
test('Transaction : rollback si fichier non enregistré',async()=>{
 const calls=[],conn={beginTransaction:async()=>calls.push('begin'),query:async()=>[{affectedRows:1,insertId:1}],commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>calls.push('release')};
 const model=load(modelPath,{'../config/db':{promise:()=>({getConnection:async()=>conn})},'../services/fileStorage':{enregistrer:async()=>{throw Error('storage failed');}}});
 await assert.rejects(model.envoyerFichier(12,'client',7,'Salut',pdf(),attach().decrire(pdf())));assert.ok(calls.includes('rollback'));assert.ok(!calls.includes('commit'));
});
test('Migration et vues Client/Artisan incluent les pièces jointes',()=>{
 const sql=fs.readFileSync('database/migration_taskly_chat_attachments.sql','utf8');assert.match(sql,/FOREIGN KEY \(message_id\) REFERENCES taskly_chat_messages\(id\)/);
 for(const role of ['client','artisan']){const html=fs.readFileSync(`client/private/${role}/messagerie.html`,'utf8');assert.match(html,/id="cw-file"/);assert.match(html,/id="cw-attach"/);}
 const js=fs.readFileSync('client/public/js/taskly-chat-workspace.js','utf8');assert.match(js,/new FormData\(\)/);assert.match(js,/fichier_nom/);assert.match(js,/clearFile/);
});
