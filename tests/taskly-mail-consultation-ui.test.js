'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {page}=require('../server/routes/professionalMailReadRoutes');
const script=page.match(/<script>([\s\S]*?)<\/script>/)[1];
function run(token, response) {
 const ids=['open-message','read-status','read-start','read-message','read-invalid','invalid-title','message-title','print-message','read-subject','read-from','read-to','read-body','read-date'];
 const nodes=Object.fromEntries(ids.map(id=>[id,{hidden:['read-message','read-invalid'].includes(id),disabled:false,textContent:'',focus(){},addEventListener(event,fn){this[event]=fn;}}]));
 const requests=[];let cleared=false;
 vm.runInNewContext(script,{location:{hash:token?'#'+token:'',pathname:'/taskly-mail/consulter'},history:{replaceState(a,b,c){cleared=c==='/taskly-mail/consulter';}},document:{getElementById:id=>nodes[id]},window:{print(){}},fetch:async(...args)=>{requests.push(args);return response;}});
 return {nodes,requests,cleared,click:()=>nodes['open-message'].click()};
}
test('Consultation UI: initial screen does not redeem; successful click displays safe text',async()=>{
 const m={subject:'Bonjour',from:'A',to:'B',body:'<script>alert(1)</script>',date:'2026-11-21T10:37:00Z'};
 const h=run('a'.repeat(64),{ok:true,json:async()=>({message:m})});
 assert.equal(h.cleared,true);assert.equal(h.nodes['read-start'].hidden,false);assert.equal(h.requests.length,0);
 await h.click();assert.equal(h.requests.length,1);assert.equal(h.requests[0][1].credentials,'omit');assert.equal(h.requests[0][1].method,'POST');assert.equal(h.nodes['read-message'].hidden,false);assert.equal(h.nodes['read-start'].hidden,true);assert.equal(h.nodes['read-invalid'].hidden,true);assert.equal(h.nodes['read-body'].textContent,m.body);
});
test('Consultation UI: missing or malformed links show error without request',()=>{for(const t of ['', 'wrong']){const h=run(t);assert.equal(h.nodes['read-invalid'].hidden,false);assert.equal(h.nodes['read-start'].hidden,true);assert.equal(h.requests.length,0);}});
test('Consultation UI: expired or used link displays dedicated error screen',async()=>{const h=run('b'.repeat(64),{ok:false,status:404});await h.click();assert.equal(h.nodes['read-invalid'].hidden,false);assert.equal(h.nodes['read-message'].hidden,true);assert.equal(h.nodes['read-start'].hidden,true);});
test('Consultation UI: temporary failure permits retry',async()=>{for(const status of [429,503]){const h=run('c'.repeat(64),{ok:false,status});await h.click();assert.equal(h.nodes['open-message'].disabled,false);assert.equal(h.nodes['read-start'].hidden,false);assert.match(h.nodes['read-status'].textContent,/Réessayez/);}});
