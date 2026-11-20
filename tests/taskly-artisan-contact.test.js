const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../client/public/js/taskly-artisan-contact.js'),'utf8');
async function harness({role='client',id='3',reply={coordonnees:{telephone:'0550123456',email:'artisan@pro.taskly.test',autoriser_messagerie:1}},fail=false}={}){
 const elements={},calls=[];let ready;
 function element(){return {hidden:true,open:false,textContent:'',events:{},addEventListener(n,f){this.events[n]=f;},showModal(){this.open=true;},close(){this.open=false;this.events.close?.();}};}
 const document={getElementById(n){return elements[n]??=element();},addEventListener(n,f){ready=f;}};
 const window={utilisateurCourant:{role},addEventListener(){}};
 vm.runInNewContext(src,{document,window,location:{search:'?id='+id},URLSearchParams,attendreSession:async()=>{},requeteAPI:async(url,opts)=>{calls.push({url,cache:opts.cache});if(fail)throw Error();return reply;}});
 await ready();return {elements,calls,open:()=>elements['taskly-contact-open'].events.click?.(),close:()=>elements['taskly-contact-close'].events.click?.()};
}
test('Contact : aucun accès ni requête pour visiteur ou artisan',async()=>{for(const role of ['artisan','admin',undefined]){const h=await harness({role:role??'visitor'});assert.equal(h.elements['taskly-contact-open'].hidden,true);assert.equal(h.calls.length,0);}});
test('Contact : requête explicite sur le bon artisan, sans cache',async()=>{const h=await harness();assert.equal(h.calls.length,0);await h.open();assert.equal(h.calls[0].url,'/api/artisans/3/coordonnees');assert.equal(h.calls[0].cache,'no-store');assert.equal(h.elements['taskly-contact-email'].textContent,'artisan@pro.taskly.test');assert.equal(h.elements['taskly-contact-phone'].textContent,'0550123456');h.close();assert.equal(h.elements['taskly-contact-email'].textContent,'');});
test('Contact : email personnel jamais présenté et préférences masquées',async()=>{const h=await harness({reply:{coordonnees:{telephone:null,email:'personne@gmail.com',autoriser_messagerie:0}}});await h.open();assert.equal(h.elements['taskly-contact-email'].textContent,'Non partagée');assert.equal(h.elements['taskly-contact-phone'].textContent,'Non partagé');assert.equal(h.elements['taskly-contact-copy'].hidden,true);assert.match(h.elements['taskly-contact-chat'].textContent,/désactivés/);});
test('Contact : échec API et identifiant invalide sans divulgation',async()=>{const h=await harness({fail:true});await h.open();assert.equal(h.elements['taskly-contact-data'].hidden,true);const bad=await harness({id:'3%2F4'});assert.equal(bad.elements['taskly-contact-open'].hidden,true);assert.equal(bad.calls.length,0);});