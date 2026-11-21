'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'client/public/js/taskly-call-layout-v3.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'client/public/css/taskly-call-layout-v3.css'), 'utf8');
function testEnvironment({ desktop = true, hidden = false } = {}) {
    const body = { appendChild(el) { el.parentElement = body; } };
    const host = {
        isConnected: true,
        appendChild(el) { el.parentElement = host; },
        getBoundingClientRect() { return { width: 580, height: 600 }; }
    };
    const document = {
        body, readyState: 'complete',
        querySelector(selector) { return selector === '#chat-workspace .cw-thread' ? host : null; }
    };
    const window = {
        addEventListener() {},
        matchMedia() { return { matches: desktop }; },
        getComputedStyle() { return { display: hidden ? 'none' : 'flex' }; }
    };
    class UI {
        constructor() {
            const classes = new Set(['taskly-call-dialog']);
            this.dialog = {
                open: false, parentElement: body,
                classList: {
                    add(name) { classes.add(name); },
                    remove(name) { classes.delete(name); },
                    contains(name) { return classes.has(name); }
                },
                showModal() { this.open = true; this.modal = true; },
                show() { this.open = true; this.modal = false; }
            };
        }
        show() { this.dialog.showModal(); return 'existing call logic preserved'; }
    }
    window.TasklyCallUI = UI;
    vm.runInNewContext(js, { window, document, Object });
    return { ui: new UI(), body, host };
}
test('V3 : sur ordinateur, appel dans la colonne centrale, sans fond floute', () => {
    const { ui, host } = testEnvironment();
    assert.equal(ui.show(), 'existing call logic preserved');
    assert.equal(ui.dialog.parentElement, host);
    assert.equal(ui.dialog.modal, false);
    assert.equal(ui.dialog.classList.contains('taskly-call-docked'), true);
    assert.equal(Object.hasOwn(ui.dialog, 'showModal'), false);
});
test('V3 : sur mobile, le dialogue modal Taskly original est conserve', () => {
    const { ui, body } = testEnvironment({ desktop: false });
    ui.show();
    assert.equal(ui.dialog.parentElement, body);
    assert.equal(ui.dialog.modal, true);
});
test('V3 : si la conversation est masquee, conserver le dialogue original', () => {
    const { ui, body } = testEnvironment({ hidden: true });
    ui.show();
    assert.equal(ui.dialog.parentElement, body);
    assert.equal(ui.dialog.modal, true);
});
test('V3 : style sans scroll dans le dialogue, sans alteration de la navigation', () => {
    assert.match(css, /\.taskly-call-dialog\.taskly-call-premium\s*\{[\s\S]*?overflow:\s*hidden\s*!important/);
    assert.match(css, /\.taskly-call-docked\[open\]/);
    assert.match(css, /\.tc-videos/);
    assert.match(css, /max-height:\s*calc\(100dvh - 24px\)/);
    assert.doesNotMatch(css, /#site-header|\.side-nav|\.dashboard-shell|\.brand\b/);
    for (const match of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(?:^|\})\s*([^{}]+)\s*\{/gm)) {
        const selector = match[1].trim();
        if (!selector || selector.startsWith('@')) continue;
        assert.ok(selector.split(',').every(s=>s.trim().startsWith('body[data-workspace-page="messagerie"]')),
            'CSS hors messagerie : ' + selector.slice(0,100));
    }
});
test('V3 : installateur et retour arriere pour client et artisan', () => {
    const install = fs.readFileSync(path.join(root, 'scripts/install-taskly-call-layout-v3.cjs'), 'utf8');
    const rollback = fs.readFileSync(path.join(root, 'scripts/rollback-taskly-call-layout-v3.cjs'), 'utf8');
    for (const role of ['client', 'artisan']) {
        assert.match(install, new RegExp(role));
    }
    assert.match(rollback, /data-taskly-call-layout/);
    assert.doesNotMatch(js, /livekit-token|\.connect\(|KrispNoiseFilter|api\/demandes|stopRing/);
});
