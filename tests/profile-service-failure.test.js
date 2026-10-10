const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('une panne de services ne retire pas la suppression et le clic envoie son mot de passe',async()=>{
 const elements=new Map(),calls=[];let ready;
 const get=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',listeners:{},querySelector:()=>({disabled:false}),querySelectorAll:()=>[],addEventListener(n,cb){this.listeners[n]=cb;}});return elements.get(id);};
 const context={document:{addEventListener:(n,cb)=>{ready=cb;},getElementById:get},attendreSession:async()=>{},window:{utilisateurCourant:{role:'artisan'}},echapperHTML:s=>String(s??''),requeteAPI:async(url,options)=>{
  calls.push([url,options]);
  if(url==='/api/account'&&!options)return {compte:{role:'artisan',id:7,service_id:3,service_nom:'Métier',experience:1}};
  if(url==='/api/services')throw Error('Service unavailable');
  return {message:'Compte supprimé.'};
 },confirm:()=>true,location:{replace(){}},console};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../client/public/js/account-profile.js'),'utf8'),context);
 await ready();
 assert.match(get('account-profile-editor').innerHTML,/account-delete-form/);
 assert.equal(get('account-service').disabled,true);
 assert.equal(typeof get('account-delete-form').listeners.submit,'function');
 get('account-delete-password').value='mot-de-passe-fictif';get('account-delete-confirm').value='SUPPRIMER';
 get('account-delete-form').listeners.submit({preventDefault(){},currentTarget:get('account-delete-form')});
 await new Promise(resolve=>setImmediate(resolve));
 const deletion=calls.find(([url,opts])=>url==='/api/account'&&opts?.method==='DELETE');
 assert.ok(deletion);
 assert.deepEqual(JSON.parse(deletion[1].body),{motDePasse:'mot-de-passe-fictif',confirmation:'SUPPRIMER'});
});
