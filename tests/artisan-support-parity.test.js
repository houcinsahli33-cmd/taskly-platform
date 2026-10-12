'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('support artisan : mêmes formulaires et mêmes points d’accès au suivi que le client', () => {
  const client = read('client/private/client/support.html');
  const artisan = read('client/private/artisan/support.html');
  for (const id of ['contact-form','contact-name','contact-email','contact-subject','contact-message',
    'client-support-follow-dialog','follow-form','follow-email','follow-id','follow-result']) {
    assert.ok(client.includes(`id="${id}"`), `client ${id}`);
    assert.ok(artisan.includes(`id="${id}"`), `artisan ${id}`);
    assert.equal((artisan.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `${id} unique`);
  }
  for (const klass of ['client-heading','client-support-banner','client-support-columns','client-support-aside',
    'client-support-history','client-follow-form']) {
    assert.ok(artisan.includes(`class="${klass}`), klass);
  }
  assert.ok((artisan.match(/data-open-support-follow/g) || []).length >= 3);
  assert.match(artisan, /data-require-role="artisan"/);
  assert.match(artisan, /\/js\/contact\.js/);
  assert.match(artisan, /\/js\/client-support-follow-modal\.js/);
  assert.match(artisan, /\/css\/artisan-support-fidele\.css/);
  assert.match(artisan, /<noscript>[\s\S]*href="\/follow-message\.html"/);
  assert.doesNotMatch(artisan, /href="\/follow-message\.html"[^>]*data-open-support-follow/);
  assert.match(artisan, /href="\/espace\/artisan\/support" class="active"/);
});

test('support artisan : CSS exclusivement dans la page artisan/support et suppression rouge', () => {
  const css = read('client/public/css/artisan-support-fidele.css');
  assert.match(css, /data-require-role="artisan"\]\[data-workspace-page="support"\]/);
  assert.match(css, /\.client-support-banner/);
  assert.match(css, /\.client-support-follow-dialog/);
  assert.match(css, /\.client-follow-form/);
  for (const line of css.split('\n')) {
    if (line.trim().startsWith('body.dashboard-page[')) {
      assert.match(line, /data-require-role="artisan"\]\[data-workspace-page="support"\]/);
    }
  }
  const profile = read('client/public/css/artisan-design-fidele.css');
  assert.match(profile, /#account-profile-editor \.workspace-actions > \.workspace-action:last-child\s*\{\s*grid-column:auto!important/);
  assert.match(profile, /\.workspace-dialog \.account-danger \.btn\.danger[\s\S]*background:#c72e44!important/);
  assert.match(profile, /\.taskly-confirm-dialog \[data-delete\]/);
  assert.match(read('client/public/js/account-profile.js'), /confirmation:'SUPPRIMER'/);
});

for (const role of ['client', 'artisan']) {
  test(`fenêtre suivi support : ${role} peut ouvrir et fermer sans nouvelle API`, () => {
    let initialized;
    const dialogs = {};
    const followResult = { replaceChildren() { this.empty = true; } };
    const email = { value: '' }, id = { focus() { this.focused = true; } };
    const form = { reset() { this.resetCalled = true; } };
    const dialog = { open:false, handlers: {}, addEventListener(type, fn) {this.handlers[type]=fn;},
      showModal() {this.open=true;}, close() {this.open=false; this.handlers.close?.();} };
    const elements = {'client-support-follow-dialog':dialog,'follow-result':followResult,
      'follow-form':form,'follow-email':email,'follow-id':id};
    const doc = {body:{dataset:{requireRole:role, workspacePage:'support'}}, handlers: {},
      getElementById(name) {return elements[name];}, addEventListener(type, fn) {this.handlers[type]=fn;} };
    const ctx = {window:{utilisateurCourant:{email:'exemple@test.fr'}}, document:doc};
    vm.runInNewContext(read('client/public/js/client-support-follow-modal.js'), ctx);
    doc.handlers.DOMContentLoaded();
    const opener = {isConnected:true, focus(){this.focused=true;}};
    const event = {target:{closest(sel){return sel==='[data-open-support-follow]'?opener:null;}},preventDefault(){this.prevented=true;}};
    doc.handlers.click(event);
    assert.equal(event.prevented,true);
    assert.equal(dialog.open,true);
    assert.equal(form.resetCalled,true);
    assert.equal(email.value,'exemple@test.fr');
    assert.equal(id.focused,true);
    const close = {target:{closest(sel){return sel==='[data-close-support-follow]'?{}:null;}},preventDefault(){}};
    doc.handlers.click(close);
    assert.equal(dialog.open,false);
    assert.equal(opener.focused,true);
  });
}
