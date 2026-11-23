'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createServiceThreads}=require('../server/services/tasklyMailServiceThreads');
const validBox={user_id:7,address:'user@client.taskly.dz'};
function harness({admin=false,owner=7}={}) {
 const queries=[];
 const conn={async query(sql,params){
   queries.push({sql,params});
   if(sql.includes('INSERT INTO taskly_mail_service_threads'))return [{insertId:5}];
   if(sql.includes('INSERT INTO taskly_mail_service_entries'))return [{insertId:11}];
   if(sql.includes('FROM taskly_mail_service_threads'))return [[{id:5,user_id:owner,service_name:'support',subject:'Essai'}]];
   if(sql.includes('FROM taskly_mail_service_entries'))return [[{id:11,sender_kind:'user',body:'Message'}]];
   return [{affectedRows:1}];
 }};
 const service=createServiceThreads({
  transaction:fn=>fn(conn),
  userMailbox:async(_conn,uid)=>uid===7?validBox:null,
  authorizeAdmin:async context=>admin && context?.verified===true && context?.userId===99
 });
 return {service,queries};
}
test('Support: utilisateur actif cree un fil avec deux insertions et son identite serveur',async()=>{
 const {service,queries}=harness();
 const result=await service.createFromUser(7,'SUPPORT@TASKLY.DZ','Essai','Bonjour');
 assert.equal(result.threadId,5);
 assert.equal(queries.length,2);
 assert.deepEqual(queries[0].params,[7,'user@client.taskly.dz','Essai']);
 assert.deepEqual(queries[1].params,[5,7,'Bonjour']);
});
test('Support: aucune creation pour une boite inconnue ou un faux destinataire',async()=>{
 const {service,queries}=harness();
 await assert.rejects(service.createFromUser(8,'support@taskly.dz','Essai','Bonjour'),{status:403});
 await assert.rejects(service.createFromUser(7,'support@taskly.test','Essai','Bonjour'),{status:404});
 await assert.rejects(service.createFromUser(7,'administration@taskly.dz','Essai','Bonjour'),{status:404});
 assert.equal(queries.length,0);
});
test('Support: message et objet invalides refuses',async()=>{
 const {service,queries}=harness();
 await assert.rejects(service.createFromUser(7,'support@taskly.dz',' ','Bonjour'),{status:400});
 await assert.rejects(service.createFromUser(7,'support@taskly.dz','Essai',''),{status:400});
 assert.equal(queries.length,0);
});
test('Support: lecture utilisateur limitee par user_id dans SQL',async()=>{
 const {service,queries}=harness();
 await service.readForUser(7,5);
 assert.match(queries[0].sql,/id=\? AND user_id=\?/);
 assert.deepEqual(queries[0].params,[5,7]);
 await assert.rejects(service.readForUser(8,5),{status:403});
});
test('Support: admin sans validation serveur ne peut pas lire ni repondre',async()=>{
 const {service,queries}=harness();
 await assert.rejects(service.readForAdmin({userId:99,verified:true},5),{status:403});
 await assert.rejects(service.replyAsAdmin({userId:99,verified:true},5,'OK'),{status:403});
 assert.equal(queries.length,0);
});
test('Support: admin valide peut repondre a un fil Support uniquement',async()=>{
 const {service,queries}=harness({admin:true});
 const reply=await service.replyAsAdmin({userId:99,verified:true},5,'Reponse');
 assert.equal(reply.entryId,11);
 assert.deepEqual(queries[1].params,[5,99,'Reponse']);
 assert.match(queries[0].sql,/service_name='support'/);
});
test('Support: contexte administrateur ne doit jamais etre interprete comme une adresse',async()=>{
 const {service}=harness({admin:true});
 await assert.rejects(service.readForAdmin({userId:7,verified:true},5),{status:403});
});
