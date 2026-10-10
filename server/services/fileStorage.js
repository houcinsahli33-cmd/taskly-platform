const crypto = require('crypto');
const db = require('../config/db').promise();
const {formatValide} = require('../middleware/documentUpload');
async function enregistrer(file, prive, connexion = db) {
  if (!file || !formatValide(file.buffer, file.mimetype)) {
    const e = new Error('Fichier invalide. PDF, JPEG ou PNG requis.'); e.status = 400; throw e;
  }
  if (!prive && !['image/jpeg','image/png'].includes(file.mimetype)) {
    const e = new Error('Photo JPEG ou PNG requise.'); e.status=400; throw e;
  }
  const id = crypto.randomBytes(32).toString('hex');
  await connexion.query('INSERT INTO stored_files (id,media_type,prive,contenu) VALUES (?,?,?,?)', [id,file.mimetype,prive?1:0,file.buffer]);
  return id;
}
async function lire(id, prive) {
  if (!/^[a-f0-9]{64}$/.test(id)) return null;
  const [rows] = await db.query('SELECT media_type,contenu FROM stored_files WHERE id=? AND prive=?',[id,prive?1:0]);
  return rows[0];
}
module.exports={enregistrer,lire};
