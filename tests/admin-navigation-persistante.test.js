'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const pages=['overview','users','reports','contacts','services','verification','account','admins','site'];

test('Structure : sidebar originale reprise, tous les liens et scripts indépendants',()=>{
  const shell=read('client/private/admin/admin-shell.html');
  assert.match(shell,/<aside class="admin-sidebar"/);
  assert.match(shell,/<iframe id="taskly-admin-frame"/);
  for(const page of pages){
    assert.match(shell,new RegExp('data-admin-tab="'+page+'"'));
    // Chaque original doit rester intègre et accessible depuis la route protégée.
    assert.ok(fs.existsSync(path.join(root,'client/private/admin',page+'.html')));
  }
  assert.ok(!shell.includes('admin-dashboard.js'),'ne jamais exécuter des scripts de rubrique dans le shell');
  const routes=read('server/routes/workspacePages.js');
  assert.match(routes,/headersAdminPrive,verifierConnexion,verifierAdmin/);
  assert.match(routes,/\['site','admins'\]\.includes\(page\)/);
  assert.match(routes,/req\.query\.taskly_embed !== '1'/);
  assert.match(routes,/admin-shell\.html/);
  assert.match(routes,/admin-embedded\.css/);
  assert.match(routes,/admin-frame\.js/);
  assert.match(routes,/Cache-Control','no-store, private'/);
  assert.match(routes,/X-Frame-Options','SAMEORIGIN'/);
  assert.match(routes,/frame-ancestors 'self'/);
});

test('Le fond et le menu sont persistants, le scroll a un conteneur stable',()=>{
  const shell=read('client/public/css/admin-shell.css');
  const inner=read('client/public/css/admin-embedded.css');
  assert.match(shell,/#taskly-admin-frame/);
  assert.match(shell,/overflow-y:scroll/);
  assert.match(shell,/scrollbar-gutter:stable/);
  assert.match(inner,/\.admin-sidebar \{display:none !important;\}/);
  assert.match(inner,/scrollbar-gutter:stable/);
});

test('Naviguer entre rubriques ne recrée pas la barre latérale et conserve URL + historique',async()=>{
  const origin='https://taskly.test';
  const linkEvents={};const frameEvents={};const windowEvents={};
  const links=pages.map(page=>({dataset:{adminTab:page},href:origin+'/prive/dashboard/'+page,
    attributes:{},classList:{toggle(k,v){this[k]=v;}},
    setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},
    textContent:page}));
  const title={textContent:''};
  const frame={src:'',contentWindow:{location:{href:'about:blank'},scrollY:0,scrollTo(){ }},addEventListener(k,fn){frameEvents[k]=fn;}};
  const fields={ 'taskly-admin-frame':frame,'taskly-admin-loading':title,'tab-site':{hidden:true},'tab-admins':{hidden:true}};
  const location={origin,pathname:'/prive/dashboard/overview',href:origin+'/prive/dashboard/overview'};
  const pushed=[];
  const window={location,utilisateurCourant:{role:'admin'},history:{pushState(_s,_unused,url){pushed.push(url);location.href=origin+url;location.pathname=new URL(location.href).pathname;}},
    addEventListener(k,fn){windowEvents[k]=fn;}};
  const document={getElementById:k=>fields[k],querySelectorAll:()=>links,
    addEventListener(k,fn){linkEvents[k]=fn;}};
  const script=read('client/public/js/admin-shell.js');
  vm.runInNewContext(script,{URL,window,document,attendreSession:()=>Promise.resolve(),requeteAPI:async()=>({compte:{niveau:'principal'}})});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fields['tab-site'].hidden,false);
  assert.equal(fields['tab-admins'].hidden,false);
  assert.equal(frame.src,'/prive/dashboard/overview?taskly_embed=1');
  assert.equal(pushed.length,0,'la première page ne doit pas ajouter une entrée');
  const event={target:{closest:()=>links[4]},defaultPrevented:false,button:0,
    preventDefault(){this.defaultPrevented=true;}};
  linkEvents.click(event);
  assert.equal(event.defaultPrevented,true);
  assert.equal(frame.src,'/prive/dashboard/services?taskly_embed=1');
  assert.equal(pushed.at(-1),'/prive/dashboard/services');
  assert.equal(links[4].attributes['aria-current'],'page');
  assert.equal(links[0].attributes['aria-current'],undefined);
  assert.equal(document.querySelectorAll()[0],links[0],'même nœud sidebar');
  location.href=origin+'/prive/dashboard/verification?user=33';
  location.pathname='/prive/dashboard/verification';
  windowEvents.popstate();
  assert.equal(frame.src,'/prive/dashboard/verification?user=33&taskly_embed=1');
  assert.equal(pushed.length,1,'le retour navigateur ne doit pas empiler une entrée');
  windowEvents.message({origin:'https://evil.test',source:frame.contentWindow,
    data:{type:'taskly:admin-navigate',url:'/prive/dashboard/admins'}});
  assert.equal(frame.src,'/prive/dashboard/verification?user=33&taskly_embed=1','un message d’un autre domaine est ignoré');
});

test('Le script embarqué délègue seulement les liens admin autorisés au parent',()=>{
  const events={};const sent=[];
  const win={location:{pathname:'/prive/dashboard/reports',href:'https://taskly.test/prive/dashboard/reports?taskly_embed=1',origin:'https://taskly.test'},
    parent:{postMessage(...args){sent.push(args);}}};
  const document={addEventListener(k,fn){events[k]=fn;}};
  vm.runInNewContext(read('client/public/js/admin-frame.js'),{window:win,document,URL});
  const eventFor=href=>({defaultPrevented:false,button:0,target:{closest:()=>({href,target:'',hasAttribute:()=>false})},preventDefault(){this.defaultPrevented=true;}});
  const valid=eventFor('https://taskly.test/prive/dashboard/verification?user=7');
  events.click(valid);
  assert.equal(valid.defaultPrevented,true);
  assert.equal(sent[0][0].type,'taskly:admin-navigate');
  assert.equal(sent[0][0].url,'/prive/dashboard/verification?user=7');
  const external=eventFor('https://external.test/prive/dashboard/users');
  events.click(external);
  assert.equal(external.defaultPrevented,false);
  assert.equal(sent.length,1);
});

test('Routes : autorisations conservées et documents réels servis dans le cadre',async()=>{
  const Module=require('node:module');
  const originalPath=path.join(root,'server/routes/workspacePages.js');
  const testModule=new Module(originalPath,module);
  testModule.filename=originalPath;
  testModule.paths=Module._nodeModulePaths(path.dirname(originalPath));
  let niveau='principal';
  testModule.require=function(request){
    if(request==='../middleware/authMiddleware')return {verifierConnexion(){},verifierAdmin(){}};
    if(request==='../config/db')return {promise(){return {query:async()=>[[{niveau}]]};}};
    return Module.prototype.require.call(this,request);
  };
  testModule._compile(read('server/routes/workspacePages.js'),originalPath);
  const handlers=new Map();
  const app={get(route,...fns){handlers.set(route,fns);}};
  testModule.exports(app,{adminEntryPath:'/prive',headersAdminPrive(){}});
  const route=handlers.get('/prive/dashboard/:page').at(-1);
  function response(){return {headers:{},statusCode:200,
    set(k,v){this.headers[k]=v;return this;},status(n){this.statusCode=n;return this;},
    type(t){this.contentType=t;return this;},sendFile(p){this.path=p;return this;},
    send(s){this.body=s;return this;}};}
  let res=response();
  await route({params:{page:'users'},query:{},session:{utilisateur:{id:1}}},res);
  assert.match(res.path,/admin-shell\.html$/);
  assert.equal(res.headers['Cache-Control'],'no-store, private');
  assert.equal(res.headers['X-Frame-Options'],'SAMEORIGIN');
  assert.equal(res.headers['Content-Security-Policy'],"frame-ancestors 'self'");
  res=response();
  await route({params:{page:'users'},query:{taskly_embed:'1'},session:{utilisateur:{id:1}}},res);
  assert.equal(res.contentType,'html');
  assert.match(res.body,/id="admin-users"/);
  assert.match(res.body,/admin-embedded\.css/);
  assert.match(res.body,/admin-frame\.js/);
  assert.match(res.body,/admin-users-page\.js/);
  niveau='secondaire';
  res=response();
  await route({params:{page:'site'},query:{taskly_embed:'1'},session:{utilisateur:{id:2}}},res);
  assert.equal(res.statusCode,403);
  assert.ok(!res.body?.includes('admin-site'),'aucun HTML sensible révélé');
  res=response();
  await route({params:{page:'does-not-exist'},query:{},session:{utilisateur:{id:1}}},res);
  assert.equal(res.statusCode,404);
});
