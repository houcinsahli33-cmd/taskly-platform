'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = relative => fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8');

const pages = ['accueil', 'demandes', 'profil', 'support'];
for (const p of pages) {
  test(`La page client ${p} applique le nouveau style sans remplacer ses scripts`, () => {
    const html = read(`client/private/client/${p}.html`);
    assert.match(html, /\/css\/client-refonte\.css/);
    assert.match(html, /\/css\/client-design-fidele\.css/);
    assert.match(html, /\/js\/auth\.js/);
    assert.match(html, /\/js\/client-dashboard\.js/);
    assert.match(html, new RegExp(`data-workspace-page="${p}"`));
    assert.match(html, /data-require-role="client"/);
  });
}
test('Le design ne contient pas de modifications aux fichiers de rôle admin ou artisan', () => {
  const css = read('client/public/css/client-design-fidele.css');
  for (const line of css.split('\n')) {
    if (line.trim().startsWith('body.dashboard-page[')) {
      assert.match(line, /data-require-role="client"/);
    }
  }
  assert.match(read('client/public/js/auth.js'), /\/images\/logo\/taskly-logo\.svg/);
  assert.ok(fs.existsSync(path.resolve(__dirname,'../client/public/images/logo/taskly-logo.svg')));
});
test('Les véritables champs du support et les trois points d ouverture restent présents', () => {
  const html = read('client/private/client/support.html');
  for (const id of ['contact-form','contact-name','contact-email','contact-subject','contact-message',
    'client-support-follow-dialog','follow-form','follow-id','follow-email','follow-result']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.ok((html.match(/data-open-support-follow/g)||[]).length >= 3);
  assert.match(html, /<noscript>[\s\S]*href="\/follow-message\.html"/);
  assert.match(html, /\/js\/contact\.js/);
  assert.match(html, /\/js\/client-support-follow-modal\.js/);
});
test('Le suivi reutilise exactement la route securisee id et e-mail du PFE', () => {
  const code = read('client/public/js/contact.js');
  assert.match(code, /function initialiserSuiviSupport\(/);
  assert.match(code, /\/api\/contact\/suivi\?contactId=/);
  assert.match(code, /encodeURIComponent\(email\)/);
  assert.match(read('server/routes/contactRoutes.js'), /router\.get\("\/suivi"/);
  const modal = read('client/public/js/client-support-follow-modal.js');
  assert.match(modal, /dialog\.showModal\(\)/);
  assert.match(modal, /dialog\.close\(\)/);
  assert.doesNotMatch(modal, /\/api\/contact\/suivi|fetch\(/);
});
test('Les fonctions originelles de demandes, avis, annulation et signalements ne disparaissent pas', () => {
  const html = read('client/private/client/demandes.html');
  for (const id of ['client-requests','client-request-search','review-form','report-form','client-demand-how']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  const js = read('client/public/js/client-dashboard.js');
  for (const endpoint of ['/api/demandes/client','/api/avis','/api/signalements']) assert.ok(js.includes(endpoint));
  assert.match(js, /\/api\/demandes\/\$\{id\}\/annuler/);
  assert.match(js, /'acceptee','en_cours'/);
  assert.match(js, /\/artisans\.html/);
});
test('Le profil affiche de vraies données compte et preserve ses formulaires de sécurité', () => {
  const js=read('client/public/js/client-dashboard.js');
  assert.match(js,/requeteAPI\('\/api\/account'\)/);
  assert.match(js,/client-profile-hero/);
  assert.match(js,/client-profile-fields/);
  assert.match(js,/echapperHTML\(utilisateur\.nom/);
  for(const id of ['client-photo-form','client-photo-input','client-photo-delete','account-profile-editor'])
    assert.match(read('client/private/client/profil.html'),new RegExp(`id="${id}"`));
  const actions=read('client/public/js/account-profile.js');
  assert.match(actions,/\/api\/account\/email\/request/);
  assert.match(actions,/\/api\/account\/password/);
  assert.match(actions,/confirmation:'SUPPRIMER'/);
  assert.match(read('client/public/css/client-refonte.css'),/\.taskly-confirm-dialog \[data-delete\]/);
});
test('La navigation persistante existante reste dans client-navigation-stable.js',()=>{
  const js=read('client/public/js/client-navigation-stable.js');
  assert.match(js,/taskly-client-content-frame/);
  assert.match(js,/popstate/);
  assert.match(js,/\/espace\/client\//);
});
