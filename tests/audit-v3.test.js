'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function assistant(fetch, env={GROQ_API_KEY:'test-key'}) {
 const module={exports:{}};let now=0;
 vm.runInNewContext(read('server/services/tasklyAssistantAi.js'),{module,fetch,process:{env},AbortSignal,Date:{now:()=>now}});
 return {ask:module.exports.genererReponse,advance:ms=>{now+=ms;}};
}
const reply=(text='Réponse générique')=>({ok:true,json:async()=>({choices:[{message:{content:text}}]})});
test('Assistant: aucune requête externe avec thème non autorisé, texte libre ou langue invalide',async()=>{
 let calls=0;const {ask}=assistant(async()=>{calls++;return reply();});
 for(const args of [['adresse@example.test','fr'],['__proto__','fr'],['recherche','constructor'],[{},'fr']])assert.equal(await ask(...args),null);
 assert.equal(calls,0);
});
test('Assistant: partage des requêtes simultanées, cache borné dans le temps, séparation thème/langue',async()=>{
 let calls=0;const {ask,advance}=assistant(async(url,opts)=>{calls++;assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(opts.redirect,'error');const body=JSON.parse(opts.body);assert.equal(body.messages.length,2);assert.ok(!JSON.stringify(body).includes('test-key'));return reply();});
 await Promise.all([ask('recherche','fr'),ask('recherche','fr'),ask('recherche','fr')]);assert.equal(calls,1);
 assert.equal(await ask('recherche','fr'),'Réponse générique');assert.equal(calls,1);
 await ask('recherche','ar');await ask('support','fr');assert.equal(calls,3);
 advance(300001);await ask('recherche','fr');assert.equal(calls,4);
});
test('Assistant: échec non caché, réponse non vide limitée, clef absente désactive le service',async()=>{
 let calls=0;const {ask}=assistant(async()=>{calls++;if(calls===1)return{ok:false};return reply('x'.repeat(2500));});
 assert.equal(await ask('support','fr'),null);assert.equal((await ask('support','fr')).length,1800);assert.equal(calls,2);
 const disabled=assistant(async()=>{throw Error('fetch interdit');},{});assert.equal(await disabled.ask('support','fr'),null);
});
for(const role of ['client','artisan'])test(`Navigation ${role}: cliquer de nouveau sur la page chargée ne recrée pas le cadre`,()=>{
 const origin='https://taskly.test',pathname=`/espace/${role}/profil`,href=origin+pathname,embedded=href+`?taskly_${role}_embed=1`;
 let changes=0, click;
 const a={href,dataset:{dashboardLink:'profil'},hasAttribute:()=>false,target:''};
 const iframe={contentWindow:{location:{href:embedded}},contentDocument:{readyState:'complete',querySelector:()=>({})},classList:{remove(){}},addEventListener(){},set src(v){changes++;}};
 const document={getElementById:()=>iframe,querySelector:()=>({addEventListener:(e,fn)=>{click=fn;}}),querySelectorAll:()=>[]};
 vm.runInNewContext(read(`client/public/js/${role}-navigation-stable.js`),{document,location:{origin,href,pathname,search:'',hash:''},URL,history:{pushState(){},replaceState(){}},addEventListener(){}});
 assert.equal(changes,1);
 click({button:0,target:{closest:()=>a},preventDefault(){}});assert.equal(changes,1);
 iframe.contentWindow.location.href=origin+'/espace/'+role+'/accueil';click({button:0,target:{closest:()=>a},preventDefault(){}});assert.equal(changes,2);
});
test('Recherche accueil: une saisie après sélection ne redirige pas vers ancien métier',()=>{
 const handlers={};const form={addEventListener:(e,f)=>{handlers[e]=f;}};
 const input={value:'Plomberie',addEventListener:(e,f)=>{handlers[e]=f;}};
 const suggestions={addEventListener:(e,f)=>{handlers['suggest-'+e]=f;},classList:{remove(){},contains:()=>false,add(){}},innerHTML:''};
 const document={getElementById:id=>({'home-search-form':form,'home-search-input':input,'home-suggestions':suggestions}[id]||null),querySelectorAll:()=>[],addEventListener(){}};
 const window={location:{href:''},addEventListener(){}};
 const context={document,window,URLSearchParams,echapperHTML:s=>s,normaliserTexte:s=>s.toLowerCase()};vm.createContext(context);
 vm.runInContext(read('client/public/js/home.js'),context);
 vm.runInContext('servicesAccueil=[{id:1,nom:"Plomberie"},{id:2,nom:"Peinture"}];initialiserRechercheAccueil()',context);
 handlers['suggest-click']({target:{closest:()=>({dataset:{suggestionService:'1'}})}});
 input.value='Peinture';handlers.input();handlers.submit({preventDefault(){}});assert.equal(window.location.href,'/service.html?id=2');
});
test('Images de service: une erreur déjà survenue déclenche le fallback une seule fois',()=>{
 const context={window:{},document:{addEventListener(){}},fetch(){}};vm.createContext(context);vm.runInContext(read('client/public/js/api.js'),context);
 const img={complete:true,naturalWidth:0,getAttribute:()=>'/missing.jpg',src:'/missing.jpg'};context.img=img;
 vm.runInContext('gererImageService(img,"Plomberie")',context);assert.match(img.src,/plomberie\.jpg$/);assert.equal(img.onerror,null);
});
test('Hero: sources WebP présentes avec PNG de repli et signature valide',()=>{
 const html=read('client/public/index.html');
 for(const name of ['artisan-2','artisan-3']){
  const base=`/images/hero/floating/${name}`;
  assert.ok(html.includes(`<picture><source type="image/webp" srcset="${base}.webp">`));
  assert.ok(html.includes(`src="${base}.png"`));
  const webp=fs.readFileSync(path.join(__dirname,'../client/public',base+'.webp'));
  assert.equal(webp.toString('ascii',0,4),'RIFF');assert.equal(webp.toString('ascii',8,12),'WEBP');
 }
});
