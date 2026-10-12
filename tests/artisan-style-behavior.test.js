const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const load=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('recherche artisan combine statut, nom et message sans modifier les données reçues',()=>{
 const ctx={document:{addEventListener(){}},console};vm.createContext(ctx);
 vm.runInContext(load('client/public/js/artisan-dashboard.js'),ctx);
 const demandes=[{id:1,client_nom:'Belaïd',client_prenom:'Nadia',statut:'acceptee',message:'Fuite cuisine'}, {id:2,client_nom:'Saïdi',statut:'en_attente',message:'Cuisine'}];
 const avant=JSON.stringify(demandes);
 assert.equal(ctx.filtrerDemandesArtisan(demandes,'acceptee',' CUISINE ')[0].id,1);
 assert.equal(ctx.filtrerDemandesArtisan(demandes,'en_attente','Nadia').length,0);
 assert.equal(ctx.filtrerDemandesArtisan(demandes,'','Saïdi')[0].id,2);
 assert.equal(JSON.stringify(demandes),avant);
});
test('statut utilisateur : compte bloqué prioritaire, dossier en attente non traité, validé actif',()=>{
 const ctx={document:{getElementById(){return null}},echapperHTML:v=>String(v).replaceAll('<','&lt;'),nomComplet:a=>a.nom,formatDate:()=>'',tronquer:v=>v};vm.createContext(ctx);
 const code=load('client/public/js/admin-users-page.js').replace('  // Remplace le rendu générique','  globalThis.ligneUtilisateur=ligneUtilisateur; return;\n  // Remplace le rendu générique');
 vm.runInContext(code,ctx);
 const a={id:1,nom:'<script>',role:'artisan',statut_compte:'actif',verification_statut:'en_attente'};
 assert.match(ctx.ligneUtilisateur(a),/account-status non_traite/);
 assert.match(ctx.ligneUtilisateur(a),/>Non traité<\/span>/);
 assert.match(ctx.ligneUtilisateur({...a,statut_compte:'bloque'}),/account-status bloque/);
 assert.match(ctx.ligneUtilisateur({...a,verification_statut:'approuve'}),/account-status actif/);
 assert.match(ctx.ligneUtilisateur({...a,role:'client'}),/account-status actif/);
 assert.doesNotMatch(ctx.ligneUtilisateur(a),/<script>/);
});
