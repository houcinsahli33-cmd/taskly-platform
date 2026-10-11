'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const r=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(r,p),'utf8');
const {preparerCadreClient,preparerPageClientIntegree}=require('../server/routes/clientWorkspaceNavigation');
const {INACTIVITE_MS,verifierInactivite,confirmerActivite}=require('../server/services/sessionActivity');

for(const page of ['accueil','demandes','profil','support']){
 test(`Client ${page}: cadre reprenant logo vrai et menu original, document métier complet`,()=>{
  const original=read(`client/private/client/${page}.html`);
  const shell=preparerCadreClient(original);
  const iframe=preparerPageClientIntegree(original);
  assert.match(shell,/id="site-header"/);
  assert.match(shell,/data-dashboard-link="accueil"/);
  assert.match(shell,/data-dashboard-link="support"/);
  assert.match(shell,/client-navigation-stable\.js/);
  assert.doesNotMatch(shell,/client-dashboard\.js/);
  assert.match(iframe,/data-taskly-client-embedded="1"/);
  for(const tag of original.match(/<script\s+defer[^>]*>/g)||[])assert.ok(iframe.includes(tag));
  assert.ok(iframe.includes('/css/client-refonte.css'));
 });
}
test('Les vrais formulaires et APIs de la page demandes sont preservés',()=>{
 const page=read('client/private/client/demandes.html');
 for(const id of ['client-requests','review-form','review-demande-id','report-form','report-demande-id'])assert.ok(page.includes(`id="${id}"`));
 const js=read('client/public/js/client-dashboard.js');
 for(const route of ['/api/demandes/client','/api/avis','/api/signalements','/api/demandes/${id}/annuler'])assert.ok(js.includes(route));
});
test('Le support et les formulaires du compte utilisent leurs vraies APIs',()=>{
 const page=read('client/private/client/support.html');
 for(const id of ['contact-form','contact-name','contact-email','contact-subject','contact-message'])assert.ok(page.includes(`id="${id}"`));
 assert.ok(page.includes('/follow-message.html'));
 assert.match(read('client/public/js/account-profile.js'),/\/api\/account/);
 assert.match(read('client/public/js/contact.js'),/\/api\/contact/);
});
test('Le vrai logo original n’est pas remplacé par la maquette',()=>{
 assert.ok(read('client/public/js/auth.js').includes('/images/logo/taskly-logo.svg'));
 assert.ok(fs.existsSync(path.join(r,'client/public/images/logo/taskly-logo.svg')));
});
test('La suppression reste réelle ; seulement les boutons de suppression deviennent rouges',()=>{
 const css=read('client/public/css/client-refonte.css');
 assert.match(css,/\.workspace-dialog \.account-danger \.btn\.danger/);
 assert.match(css,/\.taskly-confirm-dialog \[data-delete\]/);
 assert.ok(!read('client/public/js/account-profile.js').includes('Démonstration locale'));
 assert.ok(read('client/public/js/account-profile.js').includes("confirmation:'SUPPRIMER'"));
});
test('La nouvelle route concerne exclusivement les 4 pages client',()=>{
 const js=read('server/routes/clientWorkspaceNavigation.js');
 assert.match(js,/pages=new Set\(\['accueil','demandes','profil','support'\]\)/);
 assert.match(js,/app.get\('\/espace\/client\/:page'/);
 assert.match(js,/verifierConnexion/);
 assert.match(js,/req\.session\.utilisateur\.role!=='client'/);
 assert.doesNotMatch(js,/adminEntryPath|admin-sidebar|admin-settings/);
});
test('Expiration serveur exactement à 4 heures d’inactivité',()=>{
 assert.equal(INACTIVITE_MS,14400000);
 let next=0, destroyed=0, status=0, cleared='';
 const req={session:{utilisateur:{id:7},lastUserActivityAt:Date.now()-INACTIVITE_MS}};
 const res={clearCookie(v){cleared=v;return this;},status(v){status=v;return this;},json(){return this;}};
 req.session.destroy=cb=>{destroyed++;cb();};
 verifierInactivite(req,res,()=>next++);
 assert.equal(status,401);assert.equal(cleared,'artisans.sid');assert.equal(destroyed,1);assert.equal(next,0);
});
test('Une session encore active reste valide, et une activité explicite la renouvelle',()=>{
 const last=Date.now()-INACTIVITE_MS+1000;
 let next=0;
 const req={session:{utilisateur:{id:7},lastUserActivityAt:last}};
 verifierInactivite(req,{},()=>next++);
 assert.equal(next,1);
 assert.equal(req.session.lastUserActivityAt,last);
 let code=0,saved=0;
 req.session.save=cb=>{saved++;cb();};
 const res={status(v){code=v;return this;},end(){return this;}};
 confirmerActivite(req,res);
 assert.equal(code,204);assert.equal(saved,1);
 assert.ok(req.session.lastUserActivityAt>=last);
});
test('L’inactivité est mesurée sans être prolongée par les chargements passifs',()=>{
 const js=read('client/public/js/auth.js');
 assert.match(js,/pointerdown/);assert.match(js,/keydown/);assert.match(js,/visibilityState/);
 assert.match(js,/\/api\/auth\/activity/);
 assert.doesNotMatch(read('server/config/sessionConfig.js'),/rolling:true/);
 assert.match(read('server/config/sessionConfig.js'),/maxAge:4\*60\*60\*1000/);
});

test('Activite dans le cadre client et dans la rubrique : relais bidirectionnel de meme origine',()=>{
 const js=read('client/public/js/auth.js');
 assert.match(js,/window\.parent\.postMessage/);
 assert.match(js,/frame\.contentWindow/);
 assert.match(js,/event\.source === frame\.contentWindow/);
 assert.match(js,/event\.source === window\.parent/);
 assert.match(js,/event\.origin !== window\.location\.origin/);
});

test('Expiration : la porte d entree admin privee ne devient jamais /login.html',()=>{
 const js=read('client/public/js/auth.js');
 assert.match(js,/document\.body\.dataset\.requireRole === 'admin'/);
 assert.match(js,/window\.location\.pathname\.split\('\/dashboard'\)\[0\]/);
 assert.match(js,/location\.replace\(pageConnexionApresExpiration\(\)\)/);
});

test('Plusieurs onglets : un minuteur local ne deconnecte pas une autre session active',()=>{
 const js=read('client/public/js/auth.js');
 assert.doesNotMatch(js,/function redirigerSiExpire/);
 assert.match(js,/function verifierExpirationLocale/);
 assert.match(js,/requeteAPI\('\/api\/auth\/me'\)/);
 assert.match(js,/error\.status === 401/);
 assert.match(js,/verificationExpirationEnCours/);
});
test('Pas de renouvèlement du cookie lors des requêtes passives',()=>{
 const config=read('server/config/sessionConfig.js');
 assert.doesNotMatch(config,/rolling\s*:\s*true/);
 assert.match(config,/maxAge:4\*60\*60\*1000/);
 const activity=read('server/services/sessionActivity.js');
 assert.match(activity,/req\.session\.lastUserActivityAt\s*=\s*Date\.now\(\)/);
 assert.match(activity,/req\.session\.save/);
});
