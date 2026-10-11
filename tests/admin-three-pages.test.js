const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const load=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const html=name=>load(`client/private/admin/${name}.html`);
const ui=load('client/public/js/admin-three-pages.js');
const integration=load('client/public/js/admin-settings.js');
const css=load('client/public/css/admin-three-pages.css');
const sidebar=html('verification').match(/<aside class="admin-sidebar"[\s\S]*?<\/aside>/)?.[0];
function normalizeSidebar(text){return text.match(/<aside class="admin-sidebar"[\s\S]*?<\/aside>/)?.[0].replaceAll('class="active" aria-current="page" ','').replace(/\s+/g,' ').trim();}
test('Trois rubriques distinctes, sidebar identique, onglet actif seulement',()=>{
 assert.ok(sidebar);
 for(const kind of ['site','account','admins']){
  const page=html(kind);
  assert.match(page,new RegExp(`id="admin-${kind}"`));
  assert.match(page,new RegExp(`data-workspace-page="${kind}"`));
  assert.equal((page.match(/aria-current="page"/g)||[]).length,1);
  assert.ok(page.includes(`data-admin-tab="${kind}"`));
  assert.equal(normalizeSidebar(page),normalizeSidebar(sidebar));
  assert.match(page,/\/css\/admin-three-pages\.css/);
  assert.match(page,/\/js\/admin-three-pages\.js/);
 }
});
test('Parametres : champs conserves pour la logique locale, apercu non persistant et liens HTTPS uniquement',()=>{
 const page=html('site');
 for(const name of ['email','facebook','instagram','twitter','linkedin'])assert.match(page,new RegExp(`name="${name}"`));
 assert.match(page,/id="site-settings-form"/);
 assert.match(page,/id="site-settings-status"/);
 assert.match(page,/src="\/js\/site-settings\.js"/);
 assert.match(page,/id="site-settings-reload"/);
 assert.match(ui,/requeteAPI\('\/api\/site-settings'\)/);
 assert.match(ui,/url\.protocol==='https:'/);
 assert.match(ui,/target\.replaceChildren\(\)/);
 assert.doesNotMatch(ui,/\/api\/admin-settings\/site[^\s]*['"],\s*\{\s*method:\s*'PUT'/);
});
test('Mon compte : toutes les operations sensibles utilisent encore les API existantes',()=>{
 const page=html('account');
 for(const id of ['admin-profile-form','admin-password-form','admin-email-request-form','admin-email-verify-form','admin-profile-nom','admin-profile-prenom','admin-profile-email','admin-password-old','admin-password-new','admin-password-repeat','admin-email-new','admin-email-password','admin-email-code'])assert.ok(page.includes(`id="${id}"`),id);
 for(const route of ['/api/admin-settings/me','/api/admin-settings/password','/api/admin-settings/email/request','/api/admin-settings/email/verify'])assert.ok(integration.includes(route));
 assert.match(ui,/dialog\.showModal\(\)/);
 assert.match(ui,/dialog\.close\(\)/);
});
test('Administrateurs : compteurs reelles donnees API, invitation et protection du principal',()=>{
 const page=html('admins');
 for(const id of ['admin-invite-form','admin-invite-nom','admin-invite-prenom','admin-invite-email','admin-invite-password','admin-admins-list','admin-invites-list','admin-audit-list','t-admin-count-total','t-admin-count-active','t-admin-count-invites','t-admin-count-history','t-admin-search'])assert.ok(page.includes(`id="${id}"`),id);
 assert.match(integration,/\/api\/admin-settings\/admins\/invite/);
 assert.match(integration,/data-admin-toggle/);
 assert.match(integration,/data-invite-revoke/);
 assert.match(ui,/admins\.filter\(a=>a\.statut_compte==='actif'\)\.length/);
 assert.match(page,/Compte principal protégé/);
});
test('Code d interface limite aux pages admin et sans ecriture SQL ni simulation de success',()=>{
 assert.match(css,/body\.admin-three-page/);
 assert.doesNotMatch(ui,/fetch\(.+method:\s*['"](?:POST|PUT|DELETE)/);
 assert.doesNotMatch(ui,/INSERT INTO|UPDATE users|DELETE FROM/);
 assert.match(integration,/taskly:admin-list-loaded/);
 assert.match(integration,/taskly:admin-account-loaded/);
 assert.match(integration,/taskly:admin-saved/);
});

test('Presentation fidele : pictogrammes SVG, badges et journal reels, sans texte demo',()=>{
 const site=html('site'),account=html('account'),admins=html('admins');
 for(const page of [site,account,admins])assert.match(page,/class="t-admin-svg/);
 assert.match(admins,/t-admin-stat-icon/);
 assert.match(integration,/function renderAdministrateur/);
 assert.match(integration,/t-admin-admin-avatar/);
 assert.match(integration,/t-admin-timeline-entry/);
 assert.match(integration,/escape|safe\(a\.email\)/);
 assert.match(account,/id="t-admin-account-status"/);
 assert.match(ui,/badge\.classList\.toggle/);
 assert.doesNotMatch(admins,/admin@taskly\.test|Nadia Benali/);
 assert.doesNotMatch(account,/admin@taskly\.test|Nadia Benali/);
});

test('Regressions : zero reste zero et le placeholder social reste un noeud sur',()=>{
 assert.match(ui,/value===null\|\|value===undefined/);
 assert.match(ui,/placeholder\.textContent='Liens à renseigner'/);
 assert.match(integration,/t-admin-admin-options/);
 assert.doesNotMatch(integration,/fakeUsers|mockedAdmins|Nadia Benali/);
});
