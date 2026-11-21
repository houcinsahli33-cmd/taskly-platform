'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const a=require('../server/services/professionalMailAttachments');
const {createInternalGateway}=require('../server/services/professionalMailInternal');
const file={originalname:'../document.pdf',mimetype:'application/pdf',buffer:Buffer.from('%PDF-1.4\nExemple')};
const env={TASKLY_MAIL_INTERNAL_ENABLED:'true',TASKLY_MAIL_FOLDERS_ENABLED:'true',TASKLY_MAIL_ATTACHMENTS_ENABLED:'true'};
const sender={user_id:1,address:'a@client.taskly.test',provider_id:'internal:'+'a'.repeat(64)};
const target={user_id:2,address:'b@plomberie.taskly.test',provider_id:'internal:'+'b'.repeat(64)};
const draft={to:target.address,subject:'Fichier',body:'Bonjour',key:'00000000-0000-4000-8000-000000000001'};
function harness(overrides={}){
 let saved=null,descriptor=null,events=[],copies=[],blob=null,fail=false;
 const conn={query:async(sql,p)=>{
  if(sql.startsWith('SELECT user_id FROM'))return [[{user_id:2}]];
  if(sql.includes('SELECT m.*')){const m=[sender,target].find(r=>r.user_id===p[0]);return [[{...m,proposed_address:m.address}]];}
  if(sql.includes('SELECT message_id, to_address'))return [saved?[saved]:[]];
  if(sql.startsWith('INSERT INTO taskly_professional_mail_messages')){events.push('copies');saved={message_id:p[1],to_address:p[4],subject:p[5],body:p[6]};copies=[{id:'11',owner:1},{id:'22',owner:2}];return [{affectedRows:2}];}
  if(sql.startsWith('INSERT INTO taskly_mail_attachments')){events.push('links');assert.equal(p[5],saved.message_id);assert.deepEqual(p.slice(6),[1,2]);if(fail)throw Error('write failed');descriptor={name:p[1],mime:p[2],size:p[3],digest:p[4]};return [{affectedRows:2}];}
  if(sql.includes('a.sha256 AS digest'))return [descriptor?[descriptor]:[]];
  if(sql.includes('f.contenu AS content')){assert.match(sql,/f\.prive=1/);assert.match(sql,/m\.owner_user_id=\?/);return [copies.some(c=>c.owner===p[0]&&c.id===p[1])&&blob&&descriptor?[{name:descriptor.name,mime:descriptor.mime,content:blob}]:[]];}
  throw Error('Unexpected query: '+sql);
 }};
 const gateway=createInternalGateway({env:{...env,...overrides},transaction:async fn=>{const prev=[saved,descriptor,copies,blob];try{return await fn(conn);}catch(e){[saved,descriptor,copies,blob]=prev;throw e;}},profil:async()=>({}),correspond:()=>true,attachmentStorage:{enregistrer:async(f,priv,c)=>{assert.equal(priv,true);assert.equal(c,conn);events.push('blob');blob=f.buffer;return 'a'.repeat(64);}}});
 return {gateway,events,fail:()=>fail=true};
}
test('Formats, taille, signatures et nom de fichier',()=>{
 assert.equal(a.describe(file).name,'document.pdf');
 assert.equal(a.describe({...file,originalname:'test.exe'}).name,'test.pdf');
 for(const f of [{...file,mimetype:'text/html'},{...file,buffer:Buffer.from('<html>')},{...file,buffer:Buffer.alloc(a.MAX+1)},null])assert.throws(()=>a.describe(f),{status:400});
 assert.equal(a.describe({originalname:'x.png',mimetype:'image/png',buffer:Buffer.from('89504e470d0a1a0a','hex')}).mime,'image/png');
});
test('Feature flag : fichier refuse si desactive',async()=>{const h=harness({TASKLY_MAIL_ATTACHMENTS_ENABLED:'false'});assert.equal(h.gateway.attachmentsEnabled,false);await assert.rejects(h.gateway.send(sender,draft,file),{status:503});assert.deepEqual(h.events,[]);});
test('Envoi : deux copies, fichier prive, deux references',async()=>{const h=harness();await h.gateway.send(sender,draft,file);assert.deepEqual(h.events,['copies','blob','links']);});
test('Telechargement : chaque proprietaire uniquement, autre copie et mauvais profil refuses',async()=>{const h=harness();await h.gateway.send(sender,draft,file);assert.deepEqual((await h.gateway.downloadAttachment(sender,'11')).content,file.buffer);assert.deepEqual((await h.gateway.downloadAttachment(target,'22')).content,file.buffer);await assert.rejects(h.gateway.downloadAttachment(sender,'22'),{status:404});await assert.rejects(h.gateway.downloadAttachment(target,'11'),{status:404});await assert.rejects(h.gateway.downloadAttachment({...sender,address:'incorrect@client.taskly.test'},'11'),{status:403});await assert.rejects(h.gateway.downloadAttachment(sender,'0'),{status:400});});
test('Renvoi identique sans doublon ; contenu different ou fichier manquant refuse',async()=>{const h=harness();const r=await h.gateway.send(sender,draft,file);assert.deepEqual(await h.gateway.send(sender,draft,file),r);assert.deepEqual(h.events,['copies','blob','links']);await assert.rejects(h.gateway.send(sender,draft,{...file,buffer:Buffer.from('%PDF-different')}),{status:409});await assert.rejects(h.gateway.send(sender,draft),{status:409});});
test('Echec des references : transaction annulee dans le simulateur',async()=>{const h=harness();h.fail();await assert.rejects(h.gateway.send(sender,draft,file),/write failed/);await assert.rejects(h.gateway.downloadAttachment(sender,'11'),{status:404});});
