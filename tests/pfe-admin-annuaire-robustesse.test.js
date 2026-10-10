const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dbPath = require.resolve('../server/config/db');
let pilote = async () => [[]];
require.cache[dbPath] = {
  id:dbPath, filename:dbPath, loaded:true,
  exports:{promise:()=>({query:(sql,params)=>pilote(sql,params)})}
};
const artisanModel = require('../server/models/artisanModel');
const contactModel = require('../server/models/contactModel');

// Une requête doit filtrer les comptes privés avant la pagination.
test('annuaire : 37 artisans visibles par pages de 12 et restriction des comptes', async () => {
  const appels = [];
  pilote = async (sql, params) => {
    appels.push({sql, params});
    if (sql.includes('COUNT(*) AS total FROM artisans')) return [[{total:37}]];
    assert.match(sql, /a\.verification_statut = 'approuve'/);
    assert.match(sql, /u\.statut_compte = 'actif'/);
    assert.match(sql, /u\.email_verified = 1/);
    const limit = params.at(-2), offset = params.at(-1);
    return [Array.from({length:Math.max(0,Math.min(limit,37-offset))},(_,i)=>({id:offset+i+1}))];
  };
  const pages = [];
  for(let page=1; page<=4; page++) pages.push(await artisanModel.trouverTousLesArtisans({serviceId:'3'}, {page,limit:12}));
  assert.deepEqual(pages.map(p=>p.artisans.length),[12,12,12,1]);
  assert.deepEqual(pages.map(p=>p.hasMore),[true,true,true,false]);
  assert.deepEqual(pages.flatMap(p=>p.artisans.map(a=>a.id)),Array.from({length:37},(_,i)=>i+1));
  assert.equal(appels.length,8);
  assert.ok(appels.every(({sql,params})=>sql.includes('COUNT(*)') ? params[0] === '3' : params[0] === '3'));
});

test('support : anciens champs MySQL acceptés en lecture sans révéler les données privées',async()=>{
  const appels=[];
  pilote=async(sql,params)=>{
    appels.push(sql);
    if (sql.includes('date_traitement, user_id, contexte')) {
      const error = Object.assign(new Error("Unknown column 'user_id' in 'field list'"),{code:'ER_BAD_FIELD_ERROR'});
      throw error;
    }
    return [[{id:1,nom:'Client',contexte:'public',user_id:null,login_verified_at:null}]];
  };
  const messages=await contactModel.listerMessagesContact('nouveau');
  assert.equal(messages[0].contexte,'public');
  assert.equal(messages[0].user_id,null);
  assert.match(appels[1], /WHERE statut = \?/);
  assert.match(appels[1], /NULL AS login_verified_at/);
});

test('support : une vraie panne DB ne doit pas être transformée en liste vide',async()=>{
  pilote=async()=>{throw Object.assign(new Error('Table absente'),{code:'ER_NO_SUCH_TABLE'})};
  await assert.rejects(contactModel.listerMessagesContact(), {code:'ER_NO_SUCH_TABLE'});
});

test('sidebar : position stable sur ordinateur, barre horizontale sur petit écran',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../client/public/css/admin-workspace.css'),'utf8');
  assert.match(css,/position:\s*sticky/);
  assert.match(css,/top:\s*0/);
  assert.match(css,/height:\s*100vh/);
  assert.match(css,/@media\(max-width:\s*800px\)/);
  const html=fs.readFileSync(path.join(__dirname,'../client/private/admin-dashboard.html'),'utf8');
  assert.match(html,/\/css\/admin-workspace.css/);
  assert.match(html,/data-require-role="admin"/);
});

test('statistiques : si le support échoue, les compteurs de base restent consultables',async()=>{
  const adminModel=require('../server/models/adminModel');
  const controller=require('../server/controllers/adminController');
  const originals={};
  const noms=['compter','demandesParStatut','derniersUtilisateurs','dernieresDemandes','derniersAvis','derniersMessagesContact'];
  for(const nom of noms) originals[nom]=adminModel[nom];
  adminModel.compter=async(table)=>{
    if(table==='contacts_support') throw Object.assign(new Error('support unavailable'),{code:'ER_NO_SUCH_TABLE'});
    return table==='users'?25:3;
  };
  adminModel.demandesParStatut=async()=>[];
  adminModel.derniersUtilisateurs=async()=>[{id:1}];
  adminModel.dernieresDemandes=async()=>[];
  adminModel.derniersAvis=async()=>[];
  adminModel.derniersMessagesContact=async()=>{throw Object.assign(new Error('support unavailable'),{code:'ER_NO_SUCH_TABLE'})};
  const errors=console.error;
  console.error=()=>{};
  let code,body;
  const res={status(val){code=val;return this},json(val){body=val;return this}};
  try {
    await controller.statistiques({},res);
    assert.equal(code,200);
    assert.equal(body.statistiques.totalUsers,25);
    assert.equal(body.statistiques.totalContactsSupport,null);
    assert.deepEqual(body.modulesIndisponibles.sort(),['derniersContactsSupport','totalContactsSupport']);
    assert.deepEqual(body.derniersUtilisateurs,[{id:1}]);
  }finally{
    for(const nom of noms) adminModel[nom]=originals[nom];
    console.error=errors;
  }
});
