const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('client/private/admin/taskly-mail.html','utf8');
const js=fs.readFileSync('client/public/js/taskly-mail-admin-validated-v6.js','utf8');
const css=fs.readFileSync('client/public/css/taskly-mail-admin-validated-v6.css','utf8');
test('V8: les 3 onglets ont un panneau et les ressources v3',()=>{
 for(const id of ['support','mailboxes','admin-mail']){assert.match(html,new RegExp('id="tmv3-tab-'+id+'"'));assert.match(html,new RegExp('id="tmv3-view-'+id+'"'));}
 assert.match(html,/taskly-mail-admin-validated-v6\.css\?v=3/);
 assert.match(html,/taskly-mail-admin-validated-v6\.js\?v=3/);
});
test('V8: navigation a trois onglets avec gestion des fleches et des panneaux',()=>{
 assert.match(js,/function chooseTab\(i\)/);assert.match(js,/stopImmediatePropagation/);assert.match(js,/fullPanels\.forEach/);assert.match(js,/ArrowRight/);
 assert.match(css,/#tmv3-view-admin-mail:not\(\[hidden\]\)/);
});
test('V8: pas de courriers inventes ni de fonction d envoi activee',()=>{
 assert.match(js,/newBtn\.disabled=true/);assert.match(js,/send\.disabled=true/);assert.match(js,/messages=\[\]/);
});
