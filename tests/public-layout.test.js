const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const {resolvePublicPath,publicFiles}=require('../server/middleware/publicFiles');
test('architecture client : un seul public et pages privées protégées',()=>{
 assert.equal(fs.existsSync(path.join(root,'public')),false);
 assert.equal(fs.existsSync(path.join(root,'private')),false);
 for(const name of ['client-dashboard.html','artisan-dashboard.html','admin-dashboard.html','admin-login.html']){
  assert.equal(fs.existsSync(path.join(root,'client/public',name)),false,name);
  assert.equal(fs.existsSync(path.join(root,'client/private',name)),name==='admin-login.html',name);
  if(name!=='admin-login.html')assert.equal(fs.existsSync(path.join(root,'client/private',name.replace('-dashboard.html',''),name==='admin-dashboard.html'?'overview.html':'accueil.html')),true,name);
 }
 const app=fs.readFileSync(path.join(root,'server/app.js'),'utf8');
 assert.ok(app.includes("require('./routes/workspacePages')"));
 assert.match(fs.readFileSync(path.join(root,'server/routes/workspacePages.js'),'utf8'),/verifierConnexion/);
 const config=require('../vercel.json');assert.equal(config.functions['index.js'].includeFiles,'client/**');
});
test('fichiers publics : parcours privés, traversée et dotfiles refusés',()=>{
 for(const url of ['/admin-login.html','/admin-dashboard.html','/client-dashboard.html','/artisan-dashboard.html','/../private/admin-dashboard.html','/%2e%2e/private/admin-dashboard.html','/.env','/images/../secret.json','/js\\secret.js','/%00.json','/%zz'])assert.equal(resolvePublicPath(url),null,url);
 for(const url of ['/css/style.css','/js/api.js','/images/icons/favicon.svg'])assert.ok(fs.existsSync(resolvePublicPath(url)),url);
});
test('fichiers publics : une requête POST passe aux routes applicatives',()=>{
 let next=0;publicFiles({method:'POST',path:'/index.html'},{sendFile(){throw Error('ne doit pas servir de fichier');}},()=>next++);assert.equal(next,1);
});
