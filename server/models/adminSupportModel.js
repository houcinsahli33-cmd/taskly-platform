'use strict';
// Acces SQL aux demandes d'assistance. Les filtres et identifiants sont parametres.
const db = require('../config/db');
const statuts = new Set(['nouveau', 'en_cours', 'traite']);
function idValide(value) { const n=Number(value); return Number.isSafeInteger(n)&&n>0?n:null; }
function parametresListe(query={}) {
  const statut=query.statut||'tous';
  if (statut!=='tous'&&!statuts.has(statut)) throw Object.assign(new Error('Statut invalide.'),{status:400});
  const recherche=String(query.recherche||'').trim().slice(0,100);
  const tri=query.tri||'recent';
  if(!['recent','ancien'].includes(tri)) throw Object.assign(new Error('Tri invalide.'),{status:400});
  const page=Math.max(1,Math.min(100000,Number.parseInt(query.page,10)||1));
  return {statut,recherche,tri,page,taille:10};
}
async function liste(query) {
  const p=parametresListe(query);
  const conditions=[],params=[];
  if(p.statut!=='tous'){conditions.push('c.statut = ?');params.push(p.statut);}
  if(p.recherche){conditions.push('(c.sujet LIKE ? OR c.nom LIKE ? OR c.email LIKE ? OR c.message LIKE ?)');const motif=`%${p.recherche.replace(/[\\%_]/g, '\\$&')}%`;params.push(motif,motif,motif,motif);}
  const clause=conditions.length?' WHERE '+conditions.join(' AND '):'';
  const q=db.promise();
  const [[{total}]]=await q.query(`SELECT COUNT(*) AS total FROM contacts_support c${clause}`,params);
  const totalPages=Math.max(1,Math.ceil(Number(total)/p.taille));
  const page=Math.min(p.page,totalPages),offset=(page-1)*p.taille;
  const ordre=p.tri==='ancien'?'ASC':'DESC';
  const [messages]=await q.query(`SELECT c.id,c.sujet,c.message,c.nom,c.email,c.statut,c.created_at,c.date_traitement FROM contacts_support c${clause} ORDER BY c.created_at ${ordre},c.id ${ordre} LIMIT ? OFFSET ?`,[...params,p.taille,offset]);
  const [counts]=await q.query(`SELECT statut, COUNT(*) AS total FROM contacts_support GROUP BY statut`);
  const compteurs={tous:0,nouveau:0,en_cours:0,traite:0};
  for(const c of counts){ if(Object.prototype.hasOwnProperty.call(compteurs,c.statut))compteurs[c.statut]=Number(c.total);compteurs.tous+=Number(c.total); }
  return {messages,compteurs,pagination:{page,totalPages,total:Number(total),taille:p.taille}};
}
async function detail(id) {
  const n=idValide(id);if(!n)return null;
  // La liaison par email permet de retrouver un compte non active. Elle NE constitue pas
  // une authentification de l'auteur du message public.
  const [rows]=await db.promise().query(`
    SELECT c.id,c.nom,c.email,c.sujet,c.message,c.statut,c.created_at,c.date_traitement,
      c.user_id,c.contexte,c.login_verified_at,
      u.id AS compte_id,u.nom AS compte_nom,u.prenom AS compte_prenom,
      u.email AS compte_email,u.role AS compte_role,u.statut_compte AS compte_statut,
      u.email_verified AS compte_email_verifie,u.created_at AS compte_inscription
    FROM contacts_support c
    LEFT JOIN users u ON LOWER(u.email)=LOWER(c.email)
      AND (c.user_id IS NULL OR c.user_id=u.id)
    WHERE c.id=? LIMIT 1`,[n]);
  if(!rows.length)return null;
  const m=rows[0];
  m.liaison_compte=m.compte_id ? (m.user_id&&m.login_verified_at?'identite_verifiee':'correspondance_email') : 'aucun';
  const [reponses]=await db.promise().query(`SELECT r.id,r.sujet,r.corps,r.statut,r.created_at,r.envoyee_at,
    a.nom AS admin_nom,a.prenom AS admin_prenom
    FROM support_reponses r LEFT JOIN users a ON a.id=r.admin_user_id
    WHERE r.contact_id=? ORDER BY r.id DESC LIMIT 100`,[n]);
  const [historique]=await db.promise().query(`SELECT h.ancien_statut,h.nouveau_statut,h.created_at,
    a.nom AS admin_nom,a.prenom AS admin_prenom
    FROM support_suivi_historique h LEFT JOIN users a ON a.id=h.admin_user_id
    WHERE h.contact_id=? ORDER BY h.id DESC LIMIT 100`,[n]);
  return {message:m,reponses,historique};
}
async function statut(id,statut,adminId) {
  const n=idValide(id),admin=idValide(adminId);
  if(!n||!admin||!statuts.has(statut))throw Object.assign(new Error('Parametres invalides.'),{status:400});
  const conn=await db.promise().getConnection();
  try {
    await conn.beginTransaction();
    const [rows]=await conn.query('SELECT statut FROM contacts_support WHERE id=? FOR UPDATE',[n]);
    if(!rows.length){await conn.rollback();return false;}
    const precedent=rows[0].statut;
    if(precedent!==statut){
      await conn.query(`UPDATE contacts_support SET statut=?, date_traitement=CASE WHEN ?='traite' THEN NOW() ELSE NULL END WHERE id=?`,[statut,statut,n]);
      await conn.query('INSERT INTO support_suivi_historique(contact_id,admin_user_id,ancien_statut,nouveau_statut) VALUES(?,?,?,?)',[n,admin,precedent,statut]);
    }
    await conn.commit();return true;
  } catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
async function preparerReponse({contactId,adminId,destination,sujet,corps,cle}) {
  const [existing]=await db.promise().query('SELECT id,statut FROM support_reponses WHERE contact_id=? AND request_key=? LIMIT 1',[contactId,cle]);
  if(existing.length)return {envoi:false,statut:existing[0].statut};
  try {
    const [result]=await db.promise().query(`INSERT INTO support_reponses
      (contact_id,admin_user_id,destination,sujet,corps,request_key,statut)
      VALUES(?,?,?,?,?,?,'sending')`,[contactId,adminId,destination,sujet,corps,cle]);
    return {envoi:true,id:result.insertId};
  } catch(error){
    if(error.code!=='ER_DUP_ENTRY')throw error;
    const [rows]=await db.promise().query('SELECT statut FROM support_reponses WHERE contact_id=? AND request_key=? LIMIT 1',[contactId,cle]);
    return {envoi:false,statut:rows[0]?.statut||'sending'};
  }
}
async function resultatEnvoi(id,succes) {
  return db.promise().query(`UPDATE support_reponses SET statut=?,envoyee_at=CASE WHEN ?='sent' THEN NOW() ELSE NULL END WHERE id=? AND statut='sending'`,[succes?'sent':'failed',succes?'sent':'failed',id]);
}
module.exports={idValide,parametresListe,liste,detail,statut,preparerReponse,resultatEnvoi};
