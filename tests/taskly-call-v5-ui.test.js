'use strict';
/* Régression statique : aucune API/route de signalisation modifiée ici. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('V5 : Client et Artisan chargent les mêmes styles et contrôleurs', () => {
    for (const role of ['client','artisan']) {
        const html=read(`client/private/${role}/messagerie.html`);
        assert.match(html, /taskly-call-ui\.js/);
        assert.match(html, /taskly-call-livekit\.js/);
        assert.match(html, /taskly-call-premium\.js/);
        assert.match(html, /taskly-call-maquette-v5\.css/);
        assert.doesNotMatch(html, /taskly-call-layout-v3\.(css|js)/);
        assert.doesNotMatch(html, /taskly-call-maquette-v4\.css/);
    }
});
test('V5 : aucun faux flux video ni suppression des vrais boutons', () => {
    const css=read('client/public/css/taskly-call-maquette-v5.css');
    const premium=read('client/public/js/taskly-call-premium.js');
    for (const name of ['accept','reject','end','mic','camera','sound']) {
        assert.match(css, new RegExp('data-tc="'+name+'"'));
    }
    assert.match(css, /\[data-tc=remote\]/);
    assert.match(css, /\[data-tc=local\]/);
    assert.match(premium, /patchCallPrototype/);
    assert.match(premium, /originalShow\.apply\(this, args\)/);
    assert.match(premium, /taskly-call-v5/);
    assert.doesNotMatch(css, /Chiffré de bout en bout/);
});
test('V5 : modal shell garde un fallback si navigation non compatible', () => {
    const js=read('client/public/js/taskly-call-premium.js');
    assert.match(js, /window\.top\.location\.origin !== window\.location\.origin/);
    assert.match(js, /document\.adoptNode\(dialog\)/);
    assert.match(js, /target\.adoptNode\(dialog\)/);
    assert.match(js, /dialog\.addEventListener\('close'/);
});
test('V5 : appel entrant global conserve le rejet et la navigation de secours', () => {
    const script=read('client/public/js/taskly-call-notifications.js');
    assert.match(script, /'action: 'reject'|action: 'reject'/);
    assert.match(script, /taskly:open-call/);
    assert.match(script, /window\.open\(/);
    assert.match(script, /\['client', 'artisan'\]/);
});
