'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('client/public/artisan-pending.html');
const css=read('client/public/css/artisan-pending-fidele.css');
const js=read('client/public/js/artisan-pending-premium.js');
test('pending premium : tous les éléments utilisés par le code métier sont uniques',()=>{
 const original=read('client/public/js/artisan-pending.js');
 const ids=[...new Set(Array.from(original.matchAll(/\$\('([^']+)'\)/g),m=>m[1]))];
 for(const id of [...ids,'pending-support-status','pending-doc-status','site-header','site-footer'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,id);
 assert.match(html,/id="pending-forms"[^>]*\bhidden/);
 assert.match(html,/href="\/login\.html"/);
 assert.match(html,/id="pending-message"[^>]*minlength="10"[^>]*maxlength="5000"[^>]*required/);
});
test('pending premium : mêmes champs de dépôt et de suppression, sans option fictive',()=>{
 assert.match(html,/id="pending-doc" name="document" type="file"[^>]*accept="\.pdf,\.jpg,\.jpeg,\.png" required/);
 assert.match(html,/<select id="pending-doc-type" name="type_document"[^>]*><option value="diplome">Diplôme<\/option><option value="certificat">Certificat<\/option><\/select>/);
 assert.match(html,/id="pending-delete-password"[^>]*type="password"[^>]*maxlength="72"[^>]*autocomplete="current-password" required/);
 assert.match(html,/id="pending-delete-form"[\s\S]*?<button class="btn danger" type="submit">/);
});
test('pending premium : marge partagée avec la page artisans et contact public même si accès refusé',()=>{
 assert.match(html,/class="container pending-content"/);
 assert.match(html,/class="pp-public pp-public-fallback"[\s\S]*?href="\/contact\.html"/);
 assert.match(css,/#pending-forms\[hidden\]\+\.pp-public-fallback\{display:flex\}/);
});
test('pending premium : décoration seule, conserve le submit et la confirmation existants',()=>{
 assert.doesNotMatch(js,/\b(?:fetch|requeteAPI|localStorage|sessionStorage)\b|\.submit\(/);
 assert.match(js,/actions\.append\(save,cancel\)/);
 assert.match(js,/check\.required=true/);
 assert.match(js,/check\.checked=false;password\.value='';password\.type='password'/);
 assert.match(js,/dialog\.taskly-confirm-dialog/);
 assert.match(read('client/public/js/artisan-pending.js'),/window\.confirmerSuppressionCompte\(\)/);
});
