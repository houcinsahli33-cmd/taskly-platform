'use strict';
const keys = ['email', 'facebook', 'instagram', 'twitter', 'linkedin'];
const defaults = Object.freeze({email:'support@taskly.dz',facebook:'',instagram:'',twitter:'',linkedin:''});
function valider(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !keys.includes(key))) throw Object.assign(Error('Paramètres inconnus.'), {status:400});
  const settings = {};
  for (const key of keys) {
    if (typeof input[key] !== 'string') throw Object.assign(Error('Renseignez tous les champs du formulaire.'), {status:400});
    const value = input[key].trim();
    if (key === 'email') {
      if (value.length > 254 || !/^[^\s@<>]{1,64}@[^\s@<>]+\.[^\s@<>]{2,}$/.test(value))
        throw Object.assign(Error('Adresse e-mail de contact invalide.'), {status:400});
      settings[key] = value.toLowerCase();
    } else {
      if (!value) {settings[key] = ''; continue;}
      let url;
      try { url = new URL(value); } catch { throw Object.assign(Error('Lien '+key+' invalide.'), {status:400}); }
      if (value.length > 500 || url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /[\s<>]/.test(value))
        throw Object.assign(Error('Utilisez un lien HTTPS public sans identifiants pour '+key+'.'), {status:400});
      settings[key] = url.href;
    }
  }
  return settings;
}
async function lire(sql) {
  const [rows] = await sql.query('SELECT cle, valeur FROM site_settings');
  const settings = {...defaults};
  for (const row of rows) if (keys.includes(row.cle)) settings[row.cle] = row.valeur;
  // Même les valeurs insérées hors de l'application passent la validation.
  return valider(settings);
}
async function enregistrer(pool, settings, adminId) {
  const values = valider(settings);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const key of keys) await conn.query(
      'INSERT INTO site_settings (cle,valeur) VALUES (?,?) ON DUPLICATE KEY UPDATE valeur=VALUES(valeur)', [key,values[key]]);
    await conn.query('INSERT INTO admin_audit_logs (admin_user_id,action,detail) VALUES (?,?,?)',
      [adminId,'site_settings_update','Coordonnées publiques du site modifiées.']);
    await conn.commit();
    return values;
  } catch (error) {await conn.rollback(); throw error;}
  finally {conn.release();}
}
module.exports = {keys, defaults, valider, lire, enregistrer};
