const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

function chargerControleur(adminModel) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, 'server/controllers/adminController.js'), 'utf8');
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: name => {
      if (name === '../models/adminModel') return adminModel;
      if (name === '../models/serviceModel') return {};
      throw Error('Import inattendu : ' + name);
    },
    console,
  });
  return module.exports;
}

function response() {
  return {
    statusCode: 200,
    status(n) { this.statusCode = n; return this; },
    json(d) { this.data = d; return this; },
  };
}

for (const action of ['bloquerUtilisateur', 'debloquerUtilisateur']) {
  test('Un artisan passe obligatoirement par Examiner : ' + action, async () => {
    let modifications = 0;
    const ctrl = chargerControleur({
      trouverUtilisateurParId: async () => ({ id: 5, role: 'artisan' }),
      bloquerUtilisateur: async () => { modifications++; return { affectedRows: 1 }; },
      debloquerUtilisateur: async () => { modifications++; return { affectedRows: 1 }; },
    });
    const res = response();
    await ctrl[action]({ params: { id: '5' }, body: { motifBlocage: 'Document illisible' } }, res);
    assert.equal(res.statusCode, 409);
    assert.match(res.data.message, /Examiner le dossier/);
    assert.equal(modifications, 0);
  });
}

test('Les clients peuvent encore être modérés par les actions classiques', async () => {
  let modifications = 0;
  const ctrl = chargerControleur({
    trouverUtilisateurParId: async () => ({ id: 6, role: 'client' }),
    bloquerUtilisateur: async () => { modifications++; return { affectedRows: 1 }; },
    debloquerUtilisateur: async () => { modifications++; return { affectedRows: 1 }; },
  });
  for (const fn of ['bloquerUtilisateur', 'debloquerUtilisateur']) {
    const res = response();
    await ctrl[fn]({ params: { id: '6' }, body: { motifBlocage: 'Compte signalé par plusieurs clients' } }, res);
    assert.equal(res.statusCode, 200);
  }
  assert.equal(modifications, 2);
});

test('Le motif de blocage doit être une chaîne de 5 à 500 caractères', async () => {
  let calls = 0;
  const ctrl = chargerControleur({ trouverUtilisateurParId: async () => { calls++; } });
  for (const motifBlocage of [0, null, {}, 'Non', 'a'.repeat(501)]) {
    const res = response();
    await ctrl.bloquerUtilisateur({ params: { id: '8' }, body: { motifBlocage } }, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(calls, 0);
});

test('Dossier de vérification : l’historique des décisions est retourné de façon privée', async () => {
  const handlers = {};
  const queries = [];
  const route = {
    use() {}, get(url, cb) { handlers[url] = cb; return this; },
    put() { return this; }, post() { return this; },
  };
  const db = { query: async (sql, params) => {
    queries.push([sql, params]);
    if (sql.includes('SELECT id FROM artisans WHERE id=')) return [[{ id: 4 }]];
    if (sql.includes('FROM verification_audit')) return [[{ id: 14, ancien_statut: 'en_attente', nouveau_statut: 'approuve', admin_nom: 'Démo' }]];
    return [[]];
  }};
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'server/routes/adminVerificationRoutes.js'), 'utf8'), {
    module, exports: module.exports, console, Date,
    require(name) {
      if (name === 'express') return { Router: () => route };
      if (name === '../config/db') return { promise: () => db };
      if (name === '../middleware/authMiddleware') return { verifierConnexion() {}, verifierAdmin() {} };
      if (name === '../middleware/documentUpload') return { dossier: '.' };
      if (name === '../middleware/securityMiddleware') return { limiter: () => () => {} };
      if (name === 'fs' || name === 'path') return require(name);
      throw Error('Import inattendu : ' + name);
    },
  });
  const res = response();
  res.set = (name, val) => { res.headers ||= {}; res.headers[name] = val; return res; };
  await handlers['/artisans/:id/documents']({ params: { id: '4' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.data.historique[0].nouveau_statut, 'approuve');
  assert.ok(queries.some(([sql, params]) => sql.includes('FROM verification_audit') && params[0] === 4));
});

test('Le formulaire support artisan n’ajoute pas plusieurs écouteurs de suppression', async () => {
  const domEvents = {};
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, hidden: false, textContent: '', innerHTML: '', value: '',
      listeners: {},
      addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); },
      querySelector() { return { disabled: false }; },
      reset() {},
    });
    return elements.get(id);
  }
  let callCount = 0;
  const context = {
    document: {
      getElementById: element,
      addEventListener(name, handler) { domEvents[name] = handler; },
    },
    requeteAPI: async url => {
      callCount++;
      if (url === '/api/artisan-support/context') return {
        active: false,
        message: 'En attente',
        compte: { email: 'exemple@gmail.com', verification_statut: 'en_attente' },
        messages: [{ id: 7, statut: 'nouveau', message: 'Première demande' }],
        documents: [],
      };
      return { message: 'Envoi effectué', contactId: 17 };
    },
    echapperHTML: str => String(str),
    libelleStatut: str => str,
    FormData: class { constructor() {} },
    confirm: () => false,
    location: { replace() {} },
    console,
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'client/public/js/artisan-pending.js'), 'utf8'), context);
  domEvents.DOMContentLoaded();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(element('pending-delete-form').listeners.submit.length, 1);
  const supportHandler = element('pending-support-form').listeners.submit[0];
  element('pending-message').value = 'Question concernant ma validation';
  supportHandler({ preventDefault() {}, currentTarget: element('pending-support-form') });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(callCount >= 3); // chargement, envoi, rechargement historique
  assert.equal(element('pending-delete-form').listeners.submit.length, 1);
  assert.match(element('pending-support-status').textContent, /Numéro de suivi : 17/);
});
