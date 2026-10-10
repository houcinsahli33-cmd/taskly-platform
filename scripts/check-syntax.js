// Controle syntaxique sans base de donnees ni dependances installees.
const fs=require('fs');const path=require('path');const cp=require('child_process');
const root=path.resolve(__dirname,'..');let fichiers=0,erreurs=0;
function parcourir(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){
  if(['node_modules','.git','private_uploads','uploads'].includes(e.name))continue;
  const p=path.join(d,e.name);
  if(e.isDirectory())parcourir(p);else if(e.name.endsWith('.js') && !e.name.endsWith('.k6.js')){
    fichiers++;const r=cp.spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
    if(r.status!==0){erreurs++;console.error(path.relative(root,p),r.stderr);}
  }
}}
parcourir(root);
// Risque du dashboard expose directement : il DOIT etre hors /public.
if(fs.existsSync(path.join(root,'client/public/admin-dashboard.html'))){erreurs++;console.error('Dashboard admin encore public !');}
console.log(`Syntaxe JS : ${fichiers} fichiers verifies, ${erreurs} erreur(s).`);
process.exit(erreurs?1:0);
