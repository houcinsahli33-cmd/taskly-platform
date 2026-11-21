'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
test('premium: presentation is scoped to existing call dialogs and messaging', () => {
    const css = read('client/public/css/taskly-call-premium.css');
    assert.match(css, /\.taskly-call-dialog\.taskly-call-premium/);
    assert.match(css, /body\[data-workspace-page="messagerie"\]/);
    assert.match(css, /@media \(max-width: 600px\)/);
});
test('premium: phone ring respects user-gesture and can be stopped', () => {
    const js = read('client/public/js/taskly-call-premium.js');
    assert.match(js, /AudioContext/);
    assert.match(js, /async function unlock\(/);
    assert.match(js, /function stop\(requester\)/);
    assert.match(js, /function start\(requester/);
});
test('premium: existing LiveKit media, chat, and call buttons are reused', () => {
    const js = read('client/public/js/taskly-call-premium.js');
    assert.match(js, /window\.TasklyCallUI/);
    assert.match(js, /switchActiveDevice/);
    assert.match(js, /\[data-tc="accept"\]/);
    assert.match(js, /#cw-messages/);
});
