'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

delete process.env.REDIS_URL;
process.env.NODE_ENV = 'test';

const { limiter } = require('../server/middleware/securityMiddleware');

async function run(middleware, route, method, id, ip = '127.0.0.1') {

    let status = 200;

    const req = {
        ip,
        method,
        baseUrl: '/api/demandes',
        route: { path: route },
        session: {
            utilisateur: { role: 'client', id }
        }
    };

    const res = {
        set() { return this; },
        status(code) { status = code; return this; },
        json() { return this; }
    };

    await middleware(req, res, () => {});

    return status;
}

test('Appels : GET et POST independants', async () => {
    const m = limiter({max:1,parCompte:true});
    assert.equal(await run(m,'/a','GET',10),200);
    assert.equal(await run(m,'/a','POST',10),200);
    assert.equal(await run(m,'/a','POST',10),429);
});

test('Appels : utilisateurs du meme WiFi independants', async () => {
    const m = limiter({max:1,parCompte:true});
    assert.equal(await run(m,'/b','POST',10),200);
    assert.equal(await run(m,'/b','POST',11),200);
    assert.equal(await run(m,'/b','POST',10),429);
});

test('Appels : changement IP ne contourne pas le quota', async () => {
    const m = limiter({max:1,parCompte:true});
    assert.equal(await run(m,'/c','POST',10,'127.0.0.1'),200);
    assert.equal(await run(m,'/c','POST',10,'127.0.0.2'),429);
});

test('Autres API : protection originale conservee', async () => {
    const m = limiter({max:1});
    assert.equal(await run(m,'/d','GET',10),200);
    assert.equal(await run(m,'/d','POST',11),429);
});