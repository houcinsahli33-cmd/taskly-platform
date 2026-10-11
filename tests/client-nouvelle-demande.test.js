'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function simulateNavigation() {
  const registered = {};
  const actions = [];
  const fakeDoc = {
    body: {dataset: {}}, documentElement: {}, title: 'Vue d’ensemble',
    querySelector: selector => selector === '.dashboard-shell > .dashboard-content' ? {} : null,
    addEventListener: (event, callback) => { registered['embedded:' + event] = callback; }
  };
  const frame = {
    id: 'taskly-client-content-frame',
    classList: {remove() {}, toggle() {}},
    contentDocument: fakeDoc,
    contentWindow: {location: {href: 'https://taskly.test/espace/client/accueil?taskly_client_embed=1'}},
    addEventListener: (event, callback) => {registered['iframe:' + event] = callback;}
  };
  const location = {
    href: 'https://taskly.test/espace/client/accueil',
    origin: 'https://taskly.test',
    pathname: '/espace/client/accueil', search: '', hash: '',
    assign: url => actions.push({kind: 'top-level', url})
  };
  const sidebar = {addEventListener() {}};
  const document = {
    getElementById: id => id === frame.id ? frame : null,
    querySelector: id => id === '.sidebar' ? sidebar : null,
    querySelectorAll: () => [], title: ''
  };
  class MutationObserver {observe() {} disconnect() {}}
  const history = {pushState: (_state, _title, url) => actions.push({kind: 'history', url}), replaceState() {}};
  const context = {document, location, history, MutationObserver, URL, addEventListener() {}};
  vm.runInNewContext(read('client/public/js/client-navigation-stable.js'), context);
  registered['iframe:load']();
  assert.equal(typeof registered['embedded:click'], 'function');
  actions.length = 0;
  function click(href, {hash = false, ctrlKey = false, target = '', onclick = false} = {}) {
    let prevented = false;
    const anchor = {
      href: new URL(href, location.href).href, target,
      hasAttribute: name => name === 'download' ? false : (name === 'onclick' && onclick),
      getAttribute: name => name === 'href' ? (hash ? '#fonctionnement' : href) : null
    };
    registered['embedded:click']({
      target: {closest: selector => selector === 'a[href]' ? anchor : null},
      button: 0, ctrlKey, metaKey: false, altKey: false, shiftKey: false,
      defaultPrevented: false, preventDefault() {prevented = true;}
    });
    return prevented;
  }
  return {click, actions, frame};
}

test('« Nouvelle demande » lance la sélection d’un artisan sans recréer le formulaire métier', () => {
  const page = read('client/private/client/accueil.html');
  assert.match(page, /class="client-hero-action" href="\/artisans\.html\?nouvelleDemande=1"/);
  const publicForm = read('client/public/artisans.html');
  for (const id of ['artisans-filter-form', 'request-form', 'request-artisan-id', 'request-address', 'request-date'])
    assert.ok(publicForm.includes(`id="${id}"`), `Formulaire ou filtre manquant : ${id}`);
  const publicJs = read('client/public/js/artisans.js');
  assert.match(publicJs, /ouvrirDemandeArtisan/);
  assert.match(publicJs, /requeteAPI\("\/api\/demandes",\s*\{/);
  assert.match(read('server/routes/demandeRoutes.js'), /router\.post\("\/", verifierConnexion, verifierClient, demandeController\.creerDemande\)/);
});

test('Le lien Nouvelle demande ouvre l’annuaire en haut de fenêtre, pas dans l’iframe interdite', () => {
  const navigation = simulateNavigation();
  assert.equal(navigation.click('/artisans.html?nouvelleDemande=1'), true);
  assert.equal(navigation.actions.length, 1);
  assert.deepEqual(navigation.actions[0], {kind: 'top-level', url: 'https://taskly.test/artisans.html?nouvelleDemande=1'});
});

test('Explorer les artisans utilise la même sortie de cadre, sans démarrer une demande', () => {
  assert.match(read('client/public/js/client-dashboard.js'), /href="\/artisans\.html">Explorer les artisans/);
  const navigation = simulateNavigation();
  assert.equal(navigation.click('/artisans.html'), true);
  assert.deepEqual(navigation.actions, [{kind: 'top-level', url: 'https://taskly.test/artisans.html'}]);
});

test('Les liens du support sortent aussi du cadre ; les rubriques client y restent', () => {
  const outside = simulateNavigation();
  assert.equal(outside.click('/follow-message.html'), true);
  assert.deepEqual(outside.actions, [{kind: 'top-level', url: 'https://taskly.test/follow-message.html'}]);
  const inside = simulateNavigation();
  assert.equal(inside.click('/espace/client/demandes'), true);
  assert.equal(inside.actions.some(a => a.kind === 'top-level'), false);
  assert.ok(inside.frame.src.includes('/espace/client/demandes?taskly_client_embed=1'));
});

test('Ancres locales, clics avec Ctrl et handlers spécifiques ne sont pas interceptés', () => {
  const navigation = simulateNavigation();
  assert.equal(navigation.click('#fonctionnement', {hash: true}), false);
  assert.equal(navigation.click('/artisans.html', {ctrlKey: true}), false);
  assert.equal(navigation.click('/artisans.html', {onclick: true}), false);
  assert.equal(navigation.click('/artisans.html', {target: '_blank'}), false);
  assert.equal(navigation.actions.length, 0);
});

test('Un lien vers un autre site reste sous le contrôle normal du navigateur', () => {
  const navigation = simulateNavigation();
  assert.equal(navigation.click('https://example.org/'), false);
  assert.equal(navigation.actions.length, 0);
});

test('Le guide Nouvelle demande s’affiche seulement sur l’annuaire avec le paramètre dédié', () => {
  const code = read('client/public/js/artisans.js');
  assert.match(code, /afficherGuideNouvelleDemande\(\);/);
  const functionCode = code.match(/function afficherGuideNouvelleDemande\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(functionCode);
  for (const [param, expected] of [['1', true], [null, false]]) {
    let inserted = null;
    const fakeForm = {insertAdjacentElement(_position, el) { inserted = el; }};
    const ctx = {
      obtenirParametre: name => name === 'nouvelleDemande' ? param : null,
      document: {
        getElementById: id => id === 'artisans-filter-form' ? fakeForm : null,
        createElement: () => ({setAttribute(key, value) {this[key] = value;}})
      }
    };
    vm.runInNewContext(functionCode + '\nafficherGuideNouvelleDemande()', ctx);
    assert.equal(Boolean(inserted), expected);
    if (inserted) {
      assert.match(inserted.textContent, /choisissez un artisan/i);
      assert.match(inserted.textContent, /Envoyer une demande/);
      assert.equal(inserted.role, 'status');
    }
  }
});

test('Les fichiers admin, le vrai logo et la logique de session ne sont pas concernés', () => {
  assert.match(read('client/public/js/auth.js'), /\/images\/logo\/taskly-logo\.svg/);
  assert.match(read('server/config/sessionConfig.js'), /maxAge:4\*60\*60\*1000/);
  assert.match(read('client/private/client/accueil.html'), /Comment ça marche \?/);
});
