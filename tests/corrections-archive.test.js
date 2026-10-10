const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function load(file,mocks){const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{module,require:n=>mocks[n]||require(n),console});return module.exports;}
test('support public : migration partielle conserve le filtre de confidentialité',async()=>{
 const queries=[];
 const model=load('server/models/contactModel.js',{'../config/db':{promise:()=>({query:async sql=>{
  queries.push(sql);
  if(queries.length===1)throw Object.assign(Error('Unknown column user_id'),{code:'ER_BAD_FIELD_ERROR'});
  assert.match(sql,/AND contexte = 'public'/);return [[]];
 }})}});
 assert.equal(await model.trouverMessageContactParIdEtEmail(42,'fictif@example.com'),undefined);
 assert.equal(queries.length,2);
});
test('suppression : enfants retirés avant profils et utilisateur, sans cascades',async()=>{
 const calls=[];const service=load('server/services/accountDeletion.js',{bcrypt:{compare:async()=>true}});
 const conn={query:async(sql,args)=>{calls.push(sql);if(sql.startsWith('SELECT id,role'))return [[{id:9,role:'client',mot_de_passe:'fake'}]];if(sql.startsWith('SELECT d.stored_name'))return [[]];return [{affectedRows:1}];}};
 await service.supprimer(conn,9,'correct');
 const at=s=>calls.findIndex(x=>x.startsWith(s));
 for(const table of ['signalements','avis','demandes','artisan_documents','verification_codes','account_email_changes','clients','artisans'])assert.ok(at('DELETE FROM '+table)>=0,table);
 assert.ok(at('DELETE FROM signalements')<at('DELETE FROM demandes'));
 assert.ok(at('DELETE FROM demandes')<at('DELETE FROM clients'));
 assert.ok(at('DELETE FROM artisans')<at('DELETE FROM users'));
});
test('nettoyage : le script exécuté utilise le ciblage testé et restaure la visibilité du seul instantané',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../scripts/prepare-pfe-demo.js'),'utf8');
 assert.match(src,/require\('\.\/pfe-cleanup-rules'\)/);
 assert.match(src,/u\.action!=='conserver'/);
 assert.match(src,/UPDATE users SET email_verified=1 WHERE id=\?/);
 assert.match(src,/user\.statut_compte==='actif'/);
});
