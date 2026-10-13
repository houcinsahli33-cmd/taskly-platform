'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifierConnexion } = require('../server/middleware/authMiddleware');
const { verifierInactivite, INACTIVITE_MS } = require('../server/services/sessionActivity');
const adminPath = '/entree-privee-' + 'a'.repeat(48);
process.env.ADMIN_ENTRY_PATH = adminPath;
const cas = [
  ['/verification/documents/7', 'text/html', false, null],
  ['/api/account', 'text/html', false, null],
  ['/api/admin/users', 'text/html', true, null],
  [adminPath + '/dashboard', undefined, true, null],
  [adminPath + '/dashboard', 'text/html', true, adminPath + '?session=expiree'],
  ['/artisan-dashboard.html', undefined, false, null],
  ['/artisan-dashboard.html', 'text/html,application/xhtml+xml', false, '/login.html?session=expiree'],
  ['/espace/client/demandes', 'text/html', false, '/login.html?session=expiree'],
  ['/espace/artisan/demandes', 'text/html', false, '/login.html?session=expiree'],
  ['/espace/artisan/demandes', '*/*', false, null],
];
function requete(url, accept, admin = false, expire = false) {
  return {
    originalUrl: url, method: 'GET', tasklyAdminContext: admin,
    get(name) { return name.toLowerCase() === 'accept' ? accept : undefined; },
    session: expire ? { utilisateur: { id: 42 }, lastUserActivityAt: Date.now() - INACTIVITE_MS - 10, destroy(callback) { callback(); } } : {},
    sessionID: undefined
  };
}
function reponse() {
  return { code: null, corps: null, destination: null, cookies: [],
    status(code) { this.code=code; return this; },
    json(body) { this.corps=body; return this; },
    redirect(code,url) { this.code=code; this.destination=url; return this; },
    clearCookie(name) { this.cookies.push(name); return this; },
  };
}
for (const [url,accept,admin,attendu] of cas) {
  test(`route ${url} avec Accept=${accept || 'absent'} : ${attendu?'302':'401'}`, async () => {
    const req=requete(url,accept,admin), res=reponse();
    await verifierConnexion(req,res,()=>{ throw Error('Pas de session : next interdit'); });
    assert.equal(res.code,attendu?302:401);
    assert.equal(res.destination,attendu);
    if(!attendu)assert.equal(res.corps.code,'SESSION_EXPIREE');
  });
}
for (const [url,accept,admin,attendu] of cas) {
  test(`session inactive ${url} : ${attendu?'302':'401'}`, async () => {
    const req=requete(url,accept,admin,true), res=reponse();
    await verifierInactivite(req,res,()=>{ throw Error('Session expirée : next interdit'); });
    assert.equal(res.code,attendu?302:401);
    assert.equal(res.destination,attendu);
    assert.deepEqual(res.cookies,[admin?'taskly.admin.sid':'artisans.sid']);
  });
}
