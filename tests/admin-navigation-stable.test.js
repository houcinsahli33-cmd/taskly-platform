'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const pages=['overview','users','reports','contacts','services','verification','account','admins','site'];
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const {pages:registered,preparerCadreAdmin,preparerPageIntegree}=require('../server/routes/workspacePages');
const script=read('client/public/js/admin-navigation-stable.js');
const css=read('client/public/css/admin-navigation-stable.css');
const embeddedCss=read('client/public/css/admin-navigation-embedded.css');
const route=read('server/routes/workspacePages.js');
const fromHtml=(html)=>html.match(/<aside\b[^>]*class="[^"]*admin-sidebar[^"]*"[^>]*>[\s\S]*?<\/aside>/i)?.[0];
test('Les neuf rubriques et les espaces utilisateur gardent les mêmes routes',()=>{
 assert.deepEqual(registered.admin,pages);
 assert.deepEqual(registered.artisan,['accueil','demandes','avis','profil','support']);
 assert.deepEqual(registered.client,['accueil','demandes','profil','support']);
});
test('Le menu original est repris sans changer un seul de ses éléments',()=>{
 for(const page of pages){
  const original=read(`client/private/admin/${page}.html`);
  const shell=preparerCadreAdmin(original);
  assert.equal(fromHtml(shell),fromHtml(original),page);
  assert.match(shell,new RegExp(`data-workspace-page="${page}"`));
  assert.match(shell,/data-taskly-shell="1"/);
  assert.equal((shell.match(/id="taskly-admin-content-frame"/g)||[]).length,1);
  assert.ok(!shell.includes('<script defer src="/js/admin-services-page.js"></script>'), 'scripts metier non dupliques dans le menu');
 }
});
test('La page complète originale est rendue dans un cadre de taille identique',()=>{
 assert.match(css,/width:100vw; height:100vh/);
 assert.match(css,/position:fixed; inset:0/);
 assert.doesNotMatch(css,/transform:\s*translateX|margin-left:\s*-|width:\s*calc/);
 assert.match(css,/overflow:hidden/);
 assert.doesNotMatch(css,/\.admin-sidebar \{ position:relative/);
 assert.match(route,/preparerPageIntegree\(original\)/);
});
test('Les véritables scripts métier, fenêtres et CSS des pages ne sont pas remplacés',()=>{
 for(const page of pages){
  const html=read(`client/private/admin/${page}.html`);
  assert.match(html,/class="admin-content"/);
  assert.match(html,/class="admin-sidebar"/);
  assert.match(html,/data-admin-tab="account"/);
  assert.doesNotMatch(html,/admin-navigation-stable\.(css|js)/);
 }
 assert.match(route,/preparerCadreAdmin\(original\)/);
 assert.doesNotMatch(route,/original\.replace\(['"]<\/head>/);
});
test('Chaque rubrique reste contrôlée par la session et les autorisations principales',()=>{
 assert.match(route,/dashboard\/:page',headersAdminPrive,verifierConnexion,verifierAdmin/);
 assert.match(route,/\['site','admins'\]\.includes\(page\)/);
 assert.match(route,/rows\[0\]\?\.niveau!=='principal'/);
 assert.match(route,/res\.set\('X-Frame-Options','SAMEORIGIN'\)/);
 assert.match(route,/frame-ancestors 'self'/);
 assert.match(route,/req\.get\('Sec-Fetch-Dest'\)==='iframe'/);
});
test('Le menu ne se recrée pas et la navigation gère retour et avance',()=>{
 assert.match(script,/iframe\.src = embedded\(url\)/);
 assert.match(script,/history\.pushState/);
 assert.match(script,/addEventListener\('popstate'/);
 assert.match(script,/querySelector\('\.admin-sidebar'\)/);
 assert.doesNotMatch(script,/outerHTML|document\.body\.innerHTML|\.admin-sidebar'\)\.remove/);
});
test('Les modales ouvertes retrouvent la fenêtre entière, les fermées ne changent rien',()=>{
 assert.match(script,/dialog\[open\]/);
 assert.match(script,/\.modal-backdrop\.show/);
 assert.ok(script.includes('#reports-dialog-root:not([hidden])'));
 assert.ok(script.includes('#support-dialog-root:not([hidden])'));
 assert.match(script,/taskly-modal-visible/);
 assert.match(css,/#taskly-admin-content-frame\.taskly-modal-visible \{ z-index:20; \}/);
 assert.doesNotMatch(script,/\[aria-modal="true"\]:not\(\[hidden\]\)/);
});
test('Un lien externe, non administrateur ou une action modificatrice ne déclenche pas la navigation interne',()=>{
 assert.match(script,/target\.origin === location\.origin/);
 assert.match(script,/pages\.has\(match\)/);
 assert.match(script,/event\.ctrlKey \|\| event\.metaKey \|\| event\.altKey \|\| event\.shiftKey/);
 assert.match(script,/link\.hasAttribute\('download'\)/);
});
test('Clic réel simulé : même menu, scroll conservé, seul le cadre change',()=>{
 const vm=require('node:vm');
 const handlers={};const historyCalls=[];
 const loc={origin:'https://taskly.test',pathname:'/secret/dashboard/services',search:'',href:'https://taskly.test/secret/dashboard/services'};
 const state={};
 const makeLink=(tab)=>({dataset:{adminTab:tab},href:'https://taskly.test/secret/dashboard/'+tab,hasAttribute:()=>false,target:'',classList:{toggle(active,value){if(active==='active')state[tab]=value;}},setAttribute(){},removeAttribute(){}});
 const links=['services','admins','site'].map(makeLink);
 const sidebar={scrollTop:172,addEventListener(type,fn){handlers.sidebarClick=fn;}};
 const doc={
  title:'Services — Taskly',documentElement:{},listeners:{},
  querySelector(selector){return selector.startsWith('main.admin-layout')?{}:null;},
  addEventListener(event,fn){this.listeners[event]=fn;}
 };
 const iframe={classList:{add(){},remove(){},toggle(){}},contentDocument:doc,
  contentWindow:{location:{href:'https://taskly.test/secret/dashboard/services?taskly_embed=1'}},
  addEventListener(type,fn){handlers[type]=fn;},src:''};
 const webDoc={title:'Taskly',getElementById(id){return id==='taskly-admin-content-frame'?iframe:null;},
  querySelector(selector){return selector==='.admin-sidebar'?sidebar:null;},
  querySelectorAll(selector){return selector.includes('data-admin-tab')?links:[];}};
 const history={pushState(_state,_title,href){historyCalls.push(['push',href]);loc.pathname=href.split('?')[0];loc.href='https://taskly.test'+href;},replaceState(){}};
 class Observer{observe(){} disconnect(){}}
 const sandbox={URL,Set,document:webDoc,location:loc,history,MutationObserver:Observer,addEventListener(n,fn){handlers[n]=fn;}};
 vm.runInNewContext(script,sandbox);
 assert.match(iframe.src,/services\?taskly_embed=1/);
 const initialNav=sidebar;
 iframe.contentWindow.location.href=iframe.src;
 handlers.load();
 const click={target:{closest:()=>links[1]},button:0,preventDefault(){this.prevented=true;}};
 handlers.sidebarClick(click);
 assert.equal(click.prevented,true);
 assert.equal(iframe.src,'https://taskly.test/secret/dashboard/admins?taskly_embed=1');
 assert.deepEqual(historyCalls,[['push','/secret/dashboard/admins']]);
 assert.equal(sidebar,initialNav);
 assert.equal(sidebar.scrollTop,172);
 assert.equal(state.admins,true);
 assert.equal(state.services,false);
});

test('Document embarqué : copie de menu invisible, géométrie intacte et pages inchangées',()=>{
 for(const page of pages){
  const original=read(`client/private/admin/${page}.html`);
  const embed=preparerPageIntegree(original);
  assert.equal(fromHtml(embed),fromHtml(original),page);
  assert.match(embed, /data-taskly-embed="1"/);
  assert.match(embed, /admin-navigation-embedded.css/);
  assert.equal((embed.match(/class="admin-sidebar"/g)||[]).length,1);
 }
 assert.match(embeddedCss, /visibility:\s*hidden\s*!important/);
 assert.match(embeddedCss, /pointer-events:\s*none/);
 assert.doesNotMatch(embeddedCss, /display:\s*none|width:\s*0|position:\s*absolute/);
 assert.match(script, /dataset.tasklyModal=open\?'1':'0'/);
});
test('Accès Paramètres du site conservé dans le vrai menu et gestion des droits existante',()=>{
 const settings=read('client/public/js/admin-settings.js');
 assert.match(settings, /tab-site/);
 assert.match(settings, /principal/);
 assert.match(route, /verifierAdminPrincipal|admin_roles/);
 for(const page of pages){
  const original=read(`client/private/admin/${page}.html`);
  assert.match(fromHtml(preparerCadreAdmin(original)), /id="tab-site"/);
 }
});
