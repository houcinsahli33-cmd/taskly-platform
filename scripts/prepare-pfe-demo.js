// Nettoyage sur liste figée, après sauvegarde de la base et validation humaine.
// Par défaut : aperçu en lecture seule. Aucun compte n'est modifié au lancement.
require('dotenv').config({path:require('path').join(__dirname,'../server/.env')});
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {candidat, correspond} = require('./pfe-cleanup-rules');
const pool = require('../server/config/db');
const dossier = path.resolve(__dirname,'../.taskly-private');
const snapshotPath = path.join(dossier,'nettoyage-pfe.json');
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const prepare = args.includes('--prepare');
const validation = args.find(a => a.startsWith('--confirm='))?.slice('--confirm='.length);

function empreinte(snapshot) {
  return crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}
async function lister(conn) {
  const [rows] = await conn.query("SELECT id,email,role FROM users WHERE LOWER(email) LIKE '%sahli%' OR LOWER(email) LIKE '%shl%' ORDER BY id");
  return rows.map(r=>({id:Number(r.id),email:r.email,role:r.role}));
}
async function executer() {
  const conn=await pool.promise().getConnection();
  try {
    if (apply) {
      if (!fs.existsSync(snapshotPath)) throw Error('Aucune liste préparée. Lancez d’abord --prepare, puis vérifiez les candidats.');
      const snapshot = JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
      if (!Array.isArray(snapshot.candidats) || !snapshot.date || !snapshot.candidats.length) throw Error('Instantané absent, vide ou invalide.');
      if (Date.now()-Date.parse(snapshot.date)>24*3600*1000 || Date.parse(snapshot.date)>Date.now()) throw Error('Aperçu expiré (24 heures). Refaire --prepare.');
      if (!validation || validation !== empreinte(snapshot)) throw Error('Confirmation requise : --apply --confirm=<empreinte exacte affichée dans --prepare>.');
      if (new Set(snapshot.candidats.map(u=>u.id)).size !== snapshot.candidats.length) throw Error('IDs dupliqués. Suppression annulée.');
      await conn.beginTransaction();
      try {
        // Contrôler la liste exacte sous verrou avant la moindre écriture.
        for (const u of snapshot.candidats) {
          if(!candidat(u)) throw Error('Un compte protégé figure dans la liste.');
          const [current]=await conn.query('SELECT id,email,role FROM users WHERE id=? FOR UPDATE',[u.id]);
          if (!current[0] || !candidat(current[0]) || current[0].role!==u.role || current[0].email!==u.email)
            throw Error('Un compte a changé depuis l’aperçu : annulation totale.');
        }
        for (const u of snapshot.candidats) {
          await require('../server/services/accountDeletion').supprimer(conn,u.id,null,{operateur:true});
        }
        await conn.commit();
        fs.renameSync(snapshotPath,snapshotPath+'.applique');
        console.log(`${snapshot.candidats.length} compte(s) client/artisan supprimé(s) conformément à l’aperçu. Aucun admin concerné.`);
      } catch(error) { await conn.rollback();throw error; }
      return;
    }
    const rows=await lister(conn);
    const candidats=rows.filter(candidat);
    const proteges=rows.filter(u=>u.role==='admin' && correspond(u.email));
    console.log('\nComptes clients/artisans candidats (aucune suppression effectuée) :');
    console.table(candidats);
    console.log('\nAdministrateurs correspondants protégés, jamais supprimés :');
    console.table(proteges);
    console.log(`${candidats.length} candidat(s) ; ${proteges.length} administrateur(s) protégé(s).`);
    if(prepare) {
      const snapshot={date:new Date().toISOString(),candidats};
      fs.mkdirSync(dossier,{recursive:true,mode:0o700});
      fs.writeFileSync(snapshotPath,JSON.stringify(snapshot,null,2),{mode:0o600,flag:'w'});
      console.log('Liste préparée pour 24 heures. Vérifier les comptes, puis sauvegarder la base.');
      console.log('Empreinte de confirmation : '+empreinte(snapshot));
      console.log('La suppression est une commande distincte et irréversible : --apply --confirm=<empreinte>.');
    } else console.log('Aperçu seul. Pour fixer une liste après vérification : npm run demo:prepare');
  } finally { conn.release();await pool.promise().end(); }
}
if (require.main === module) executer().catch(e=>{console.error('Nettoyage interrompu :',e.message);process.exitCode=1;});
module.exports={empreinte};
