'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
function parse(file){
 const text=fs.readFileSync(path.join(root,file),'utf8').replace(/<!--[\s\S]*?-->/g,'');
 const stack=[],nodes=[];
 const voids=new Set(['input','meta','link','img','hr','br','source','area','base','col','embed','param','track','wbr']);
 for(const match of text.matchAll(/<(\/?)([a-z][\w-]*)\b([^>]*)>/gi)){
  const tag=match[2].toLowerCase();
  if(match[1]){assert.equal(stack.at(-1)?.tag,tag,file+' : fermeture incohérente près de '+match.index);stack.pop();}
  else{
   const attributes=Object.fromEntries([...match[3].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]]));
   const node={tag,attributes,parents:[...stack]};nodes.push(node);
   if(!voids.has(tag))stack.push(node);
  }
 }
 assert.equal(stack.length,0,file+' : blocs non fermés');
 return nodes;
}
test('HTML : blocs fermés et rubriques administrateur indépendantes',()=>{
 for(const file of ['client/public/artisan-pending.html',...Object.entries(require('../server/routes/workspacePages').pages).flatMap(([role,pages])=>pages.map(page=>'client/private/'+role+'/'+page+'.html'))]){
  const nodes=parse(file);const ids=nodes.map(n=>n.attributes.id).filter(Boolean);assert.equal(new Set(ids).size,ids.length,file+' : ID dupliqué');
  for(const node of nodes.filter(n=>n.attributes.class?.split(' ').includes('admin-section'))){
   assert.equal(node.parents.some(p=>p.attributes.class?.split(' ').includes('admin-section')),false,node.attributes.id+' : rubrique imbriquée');
  }
 }
});
for(const role of ['client','artisan'])for(const page of ['accueil','demandes','profil','support',...(role==='artisan'?['avis']:[])])test('navigation native '+role+' : lien actif '+page,()=>{
 const html=fs.readFileSync(path.join(root,'client/private',role,page+'.html'),'utf8');
 assert.match(html,new RegExp('href="/espace/'+role+'/'+page+'"[^>]*aria-current="page"'));
 assert.doesNotMatch(html,/dashboard-pages.js/);
});
test('confirmation accessible : Annuler, Échap et confirmation explicite',async()=>{
 const buttons={};let node,restored=0;
 function element(){return {setAttribute(){},listeners:{},querySelector:key=>buttons[key]||=( {listeners:{},focus(){},addEventListener(name,fn){this.listeners[name]=fn;}}),addEventListener(name,fn){this.listeners[name]=fn;},showModal(){this.open=true;},close(){this.open=false;},remove(){this.removed=true;}};}
 const sandbox={window:{},document:{activeElement:{focus(){restored++;}},body:{appendChild(n){node=n;}},createElement:element},Promise};
 vm.runInNewContext(fs.readFileSync(path.join(root,'client/public/js/account-confirmation.js'),'utf8'),sandbox);
 let result=sandbox.window.confirmerSuppressionCompte();assert.equal(node.open,true);
 assert.equal(await sandbox.window.confirmerSuppressionCompte(),false,'Un double clic ne doit pas ouvrir deux boîtes');
 buttons['[data-cancel]'].listeners.click();assert.equal(await result,false);assert.equal(node.removed,true);
 result=sandbox.window.confirmerSuppressionCompte();node.listeners.cancel({preventDefault(){}});assert.equal(await result,false);
 result=sandbox.window.confirmerSuppressionCompte();buttons['[data-delete]'].listeners.click();assert.equal(await result,true);assert.equal(restored,3);
});
test('artisan en attente : Annuler ne supprime rien, confirmer envoie le mot de passe',async()=>{
 const elements=new Map(),calls=[];let ready,confirmed=false;
 const get=id=>{if(!elements.has(id))elements.set(id,{listeners:{},value:'',hidden:true,textContent:'',innerHTML:'',addEventListener(n,fn){this.listeners[n]=fn;},querySelector:()=>({disabled:false})});return elements.get(id);};
 const sandbox={document:{getElementById:get,addEventListener:(name,fn)=>{ready=fn;}},window:{confirmerSuppressionCompte:async()=>confirmed},location:{replace(){}},echapperHTML:s=>String(s),libelleStatut:s=>s,console,FormData,
  requeteAPI:async(url,options)=>{calls.push([url,options]);if(url.endsWith('/context'))return {active:false,message:'En attente',compte:{email:'test@example.com',verification_statut:'en_attente'},messages:[],documents:[]};return {message:'Compte supprimé.'};}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'client/public/js/artisan-pending.js'),'utf8'),sandbox);
 ready();await Promise.resolve();get('pending-delete-password').value='secret-de-test';
 const submit=()=>{
  const event={preventDefault(){},currentTarget:get('pending-delete-form')};
  const promise=get('pending-delete-form').listeners.submit(event);
  event.currentTarget=null;
  return promise;
 };
 await submit();assert.equal(calls.some(([,o])=>o?.method==='DELETE'),false);
 confirmed=true;await submit();
 const deletion=calls.find(([,o])=>o?.method==='DELETE');assert.equal(deletion[0],'/api/artisan-support/account');
 assert.deepEqual(JSON.parse(deletion[1].body),{motDePasse:'secret-de-test',confirmation:'SUPPRIMER'});
});
test('navigation admin : adresse propre et une seule section active',()=>{
 const tabs=['overview','verification','account','site'].map(page=>({dataset:{adminTab:page},classList:{toggle(){}},setAttribute(){},removeAttribute(){},addEventListener(n,fn){this.click=fn;}}));
 const sections=tabs.map(tab=>({id:'admin-'+tab.dataset.adminTab,classList:{toggle(){}},hidden:false}));let destination;
 const sandbox={document:{querySelectorAll:s=>s==='[data-admin-tab]'?tabs:sections,addEventListener(){}},window:{location:{href:'https://example.com/acces-prive-test/dashboard/overview',pathname:'/acces-prive-test/dashboard/overview',assign:url=>{destination=url;}}},URL};
 vm.runInNewContext(fs.readFileSync(path.join(root,'client/public/js/admin-dashboard.js'),'utf8'),sandbox);
 sandbox.activerOngletAdmin('verification');assert.deepEqual(sections.filter(s=>!s.hidden).map(s=>s.id),['admin-verification']);
 sandbox.initialiserNavigationAdmin();tabs.find(t=>t.dataset.adminTab==='account').click();
 assert.equal(destination,'/acces-prive-test/dashboard/account');
});
