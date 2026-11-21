'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'client/public/css/taskly-pro-design-v2.css'),'utf8');
test('design V2 : tous les styles sont limites a la messagerie et aux appels',()=>{
  const clean=css.replace(/\/\*[\s\S]*?\*\//g,'');
  const blocks=clean.matchAll(/(?:^|\})\s*([^{}]+)\s*\{/gm);
  for(const [, raw] of blocks){
    const selector=raw.trim();
    if(selector.startsWith('@') || selector==='') continue;
    assert.ok(selector.split(',').every(s=>s.trim().startsWith('body[data-workspace-page="messagerie"]')), 'Regle hors zone messagerie : '+selector.slice(0,120));
  }
});
test('design V2 : ne change ni API, ni moteur LiveKit/Krisp, ni navigation du site',()=>{
  for(const name of ['#site-header','.side-nav','.dashboard-shell','LiveKit','KrispNoiseFilter']){
    assert.ok(!css.includes(name), 'Regle ou logique interdite : '+name);
  }
  assert.match(css,/\.cw-grid/);
  assert.match(css,/\.taskly-call-dialog\.taskly-call-premium/);
  assert.match(css,/@media \(max-width:480px\)/);
});
test('design V2 : les deux pages message peuvent charger la feuille de style',()=>{
  const installer=fs.readFileSync(path.join(root,'scripts/install-taskly-pro-design-v2.cjs'),'utf8');
  assert.match(installer,/client\/private\/client\/messagerie\.html/);
  assert.match(installer,/client\/private\/artisan\/messagerie\.html/);
  assert.match(installer,/data-taskly-pro-design/);
});
