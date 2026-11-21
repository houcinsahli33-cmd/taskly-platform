'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {page}=require('../server/routes/professionalMailReadRoutes');
test('Reading toolbar links and PDF use real supported actions, not an attachment fiction',()=>{
 const read=page.split('id="read-message"')[1].split('id="read-invalid"')[0];
 assert.match(read,/href="\/"[^>]*>.*?Retour<\/a>/s);
 assert.match(read,/href="\/login.html"[^>]*>.*?Répondre<\/a>/s);
 assert.match(read,/href="\/login.html"[^>]*>.*?Transférer<\/a>/s);
 assert.match(read,/id="pdf-message"/);
 assert.match(read,/Les pièces jointes ne sont pas disponibles via ce lien/);
 assert.doesNotMatch(read,/href="[^"]*token/);
});
test('Reading PDF and print invoke browser print, date and avatar derive from message',async()=>{
 const ids=['open-message','read-status','read-start','read-message','read-invalid','invalid-title','message-title','print-message','pdf-message','sender-avatar','read-subject','read-from','read-to','read-body','read-date'];
 const nodes=Object.fromEntries(ids.map(id=>[id,{textContent:'',focus(){},addEventListener(e,fn){this[e]=fn;}}]));
 let requests=0,prints=0;
 vm.runInNewContext(page.match(/<script>([\s\S]*?)<\/script>/)[1],{location:{hash:'#'+'b'.repeat(64),pathname:'/taskly-mail/consulter'},history:{replaceState(){}},document:{getElementById:id=>nodes[id]},window:{print(){prints++;}},fetch:async()=>{requests++;return {ok:true,json:async()=>({message:{from:'alice@taskly.test',to:'bob@taskly.test',subject:'Essai',body:'<img src=x>',date:'2026-11-21T10:37:00Z'}})}}});
 assert.equal(requests,0);await nodes['open-message'].click();
 assert.equal(nodes['sender-avatar'].textContent,'A');assert.match(nodes['read-date'].textContent,/11:37/);assert.equal(nodes['read-body'].textContent,'<img src=x>');
 nodes['print-message'].click();nodes['pdf-message'].click();assert.equal(prints,2);assert.equal(requests,1);
});
