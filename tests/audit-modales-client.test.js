'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
for(const role of ['client','artisan']) test(`Modale ${role}: cadre intact, menu verrouillé puis restauré`,()=>{
 const handlers={};let observer,opened=false;
 const node=(parentElement=null,inert=false)=>({parentElement,inert,children:[]});
 const body=node(), main=node(body), header=node(body), container=node(main), sidebar=node(main), locked=node(body,true);
 body.children=[header,main,locked];main.children=[sidebar,container];
 const iframe=node(container);container.children=[iframe];
 const origin='https://taskly.test', href=origin+'/espace/'+role+'/profil';
 iframe.classList={remove(){},toggle(){throw Error('Le cadre ne doit pas être agrandi');}};
 iframe.addEventListener=(type,fn)=>handlers[type]=fn;
 const doc={body:{dataset:{}},documentElement:{},title:'Profil',addEventListener(){},querySelector(s){return s.startsWith('dialog')?opened?{}:null:{};}};
 iframe.contentDocument=doc;iframe.contentWindow={location:{href:href+'?taskly_'+role+'_embed=1'}};
 const document={body,getElementById:()=>iframe,querySelector:()=>null,querySelectorAll:()=>[]};
 const location={href,origin,pathname:'/espace/'+role+'/profil',search:'',hash:''};
 vm.runInNewContext(read(`client/public/js/${role}-navigation-stable.js`),{document,location,URL,history:{pushState(){},replaceState(){}},addEventListener(){},MutationObserver:class{constructor(fn){observer=fn;}observe(){}disconnect(){}}});
 handlers.load();opened=true;observer();assert.equal(sidebar.inert,true);assert.equal(header.inert,true);assert.equal(iframe.inert,false);
 opened=false;observer();assert.equal(sidebar.inert,false);assert.equal(header.inert,false);assert.equal(locked.inert,true);
 opened=true;observer();handlers.load();opened=false;observer();assert.equal(sidebar.inert,false);assert.equal(locked.inert,true);
 assert.doesNotMatch(read(`client/public/css/${role}-navigation-shell.css`),/modal-visible/);
});
test('API privée et jetons: no-store avant contrôle de session, pas d’ETag automatique',()=>{
 const app=read('server/app.js');assert.match(app,/app\.disable\('etag'\)/);assert.ok(app.indexOf("app.use('/api', (req,res,next)")<app.indexOf("verifierInactivite);"));assert.match(app,/private, no-store/);
});
test('La récupération des paramètres publics est ignorée si la page ne les affiche pas',()=>{
 assert.match(read('client/public/js/auth.js'),/if \(!document\.querySelector\('\[data-site-contact\], \[data-site-social\]'\)\) return;/);
});
