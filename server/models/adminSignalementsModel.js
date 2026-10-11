'use strict';
// Gestion privée des signalements. Les champs de suivi requièrent la migration dédiée.
const db = require('../config/db');
const STATUTS = Object.freeze(['nouveau','non_traite','en_cours','traite']);
const PRIORITES = Object.freeze(['basse','moyenne','haute']);
const COLONNES = `s.id,s.demande_id,s.motif,s.description,s.created_at,s.statut,s.priorite,
 s.date_traitement,s.traite_par_user_id,d.statut AS demande_statut,d.message AS demande_message,d.created_at AS demande_created_at,
 decl.id AS signaleur_user_id,decl.nom AS signaleur_nom,decl.prenom AS signaleur_prenom,
 decl.email AS signaleur_email,decl.role AS signaleur_role,decl.statut_compte AS signaleur_statut_compte,
 cible.id AS signale_user_id,cible.nom AS signale_nom,cible.prenom AS signale_prenom,
 cible.email AS signale_email,cible.role AS signale_role,cible.statut_compte AS signale_statut_compte`;
const FROM = ` FROM signalements s
 JOIN users decl ON decl.id=s.signaleur_user_id
 JOIN users cible ON cible.id=s.signale_user_id
 LEFT JOIN demandes d ON d.id=s.demande_id`;

function clauses({statut='tous', priorite='toutes', recherche=''}={}) {
 const where=[], params=[];
 if(statut!=='tous'){where.push('s.statut=?');params.push(statut);}
 if(priorite!=='toutes'){where.push('s.priorite=?');params.push(priorite);}
 if(recherche){
   // Préparer LIKE avec échappement de %, _ et \\ ; aucune interpolation d'entrées dans le SQL.
   const term=`%${recherche.replace(/[\\%_]/g,m=>'\\'+m)}%`;
   where.push(`(s.motif LIKE ? ESCAPE '\\\\' OR s.description LIKE ? ESCAPE '\\\\'
     OR decl.nom LIKE ? ESCAPE '\\\\' OR decl.prenom LIKE ? ESCAPE '\\\\'
     OR cible.nom LIKE ? ESCAPE '\\\\' OR cible.prenom LIKE ? ESCAPE '\\\\'
     OR decl.email LIKE ? ESCAPE '\\\\' OR cible.email LIKE ? ESCAPE '\\\\'
     OR CAST(s.id AS CHAR) LIKE ? ESCAPE '\\\\' OR CAST(s.demande_id AS CHAR) LIKE ? ESCAPE '\\\\')`);
   params.push(...Array(10).fill(term));
 }
 return {sql: where.length?' WHERE '+where.join(' AND '):'',params};
}
async function lister({page=1,limite=6,statut='tous',priorite='toutes',recherche='',tri='recent'}={}) {
 const {sql,params}=clauses({statut,priorite,recherche});
 const tris={recent:'s.created_at DESC,s.id DESC',ancien:'s.created_at ASC,s.id ASC',priorite:"FIELD(s.priorite,'haute','moyenne','basse'),s.created_at DESC,s.id DESC"};
 const connexion=db.promise();
 const [[compte]]=await connexion.query('SELECT COUNT(*) AS total'+FROM+sql,params);
 const [signalements]=await connexion.query('SELECT '+COLONNES+FROM+sql+' ORDER BY '+tris[tri]+' LIMIT ? OFFSET ?', [...params,limite,(page-1)*limite]);
 const [stats]=await connexion.query('SELECT statut,COUNT(*) AS total FROM signalements GROUP BY statut');
 const compteurs={total:0,nouveau:0,non_traite:0,en_cours:0,traite:0};
 for(const ligne of stats){const n=Number(ligne.total||0);compteurs.total+=n;if(Object.hasOwn(compteurs,ligne.statut))compteurs[ligne.statut]=n;}
 const total=Number(compte.total||0);
 return {signalements,compteurs,total,page,pages:Math.max(1,Math.ceil(total/limite)),limite};
}
async function dossier(id) {
 const [lignes]=await db.promise().query('SELECT '+COLONNES+FROM+' WHERE s.id=? LIMIT 1',[id]);
 if(!lignes.length)return null;
 const [historique]=await db.promise().query(`SELECT h.ancien_statut,h.nouveau_statut,h.ancienne_priorite,h.nouvelle_priorite,h.created_at, u.nom AS admin_nom,u.prenom AS admin_prenom
 FROM signalement_suivi_historique h LEFT JOIN users u ON u.id=h.admin_user_id
 WHERE h.signalement_id=? ORDER BY h.id DESC LIMIT 20`,[id]);
 const [notifications]=await db.promise().query('SELECT id,statut,created_at,envoyee_at FROM signalement_suivi_notifications WHERE signalement_id=? ORDER BY id DESC LIMIT 5',[id]);
 // La demande liée est récupérée depuis ses vraies relations client / artisan.
 // On ne déduit jamais l'identité du client du rôle de la personne déclarante.
 const [demandes]=await db.promise().query(`SELECT
   d.id,d.client_id,d.artisan_id,d.message,d.adresse,d.date_souhaitee,d.statut,
   d.annulee_par,d.motif_annulation,d.date_annulation,d.date_traitement,d.created_at,
   uc.id AS client_user_id,uc.nom AS client_nom,uc.prenom AS client_prenom,uc.email AS client_email,
   ua.id AS artisan_user_id,ua.nom AS artisan_nom,ua.prenom AS artisan_prenom,ua.email AS artisan_email,
   c.telephone AS client_telephone,c.ville AS client_ville,
   a.telephone AS artisan_telephone,a.ville AS artisan_ville,
   service.nom AS service_nom
   FROM demandes d
   JOIN clients c ON c.id=d.client_id JOIN users uc ON uc.id=c.user_id
   JOIN artisans a ON a.id=d.artisan_id JOIN users ua ON ua.id=a.user_id
   LEFT JOIN services service ON service.id=a.service_id
   WHERE d.id=? LIMIT 1`,[lignes[0].demande_id]);
 const demande=demandes[0]||null;
 const s=lignes[0];
 const correspondance=demande ? {
   signaleur_est_client:Number(s.signaleur_user_id)===Number(demande.client_user_id),
   signaleur_est_artisan:Number(s.signaleur_user_id)===Number(demande.artisan_user_id),
   signale_est_client:Number(s.signale_user_id)===Number(demande.client_user_id),
   signale_est_artisan:Number(s.signale_user_id)===Number(demande.artisan_user_id),
   // Les deux parties doivent être différentes, présentes dans la demande et opposées.
   confirme:(Number(s.signaleur_user_id)===Number(demande.client_user_id)&&Number(s.signale_user_id)===Number(demande.artisan_user_id)) ||
      (Number(s.signaleur_user_id)===Number(demande.artisan_user_id)&&Number(s.signale_user_id)===Number(demande.client_user_id))
 } : {confirme:false};
 return {signalement:s,historique,notifications,demande,correspondance};
}
async function modifier(id,adminId,{statut,priorite}) {
 const conn=await db.promise().getConnection();
 try {
  await conn.beginTransaction();
  const [lignes]=await conn.query('SELECT id,statut,priorite FROM signalements WHERE id=? FOR UPDATE',[id]);
  if(!lignes.length){await conn.rollback();return null;}
  const old=lignes[0];
  const nextStatut=statut??old.statut, nextPriorite=priorite??old.priorite;
  if(old.statut!==nextStatut||old.priorite!==nextPriorite){
   await conn.query(`UPDATE signalements SET statut=?,priorite=?,
    date_traitement=CASE WHEN ?='traite' THEN COALESCE(date_traitement,NOW()) ELSE NULL END,
    traite_par_user_id=CASE WHEN ?='traite' THEN ? ELSE NULL END
    WHERE id=?`,[nextStatut,nextPriorite,nextStatut,nextStatut,adminId,id]);
   await conn.query(`INSERT INTO signalement_suivi_historique
    (signalement_id,admin_user_id,ancien_statut,nouveau_statut,ancienne_priorite,nouvelle_priorite)
    VALUES (?,?,?,?,?,?)`,[id,adminId,old.statut,nextStatut,old.priorite,nextPriorite]);
  }
  await conn.commit();
  return {statut:nextStatut,priorite:nextPriorite};
 } catch(error){await conn.rollback();throw error;} finally{conn.release();}
}
async function creerNotification(id,adminId,email,sujet,corps) {
 const [resultat]=await db.promise().query(`INSERT INTO signalement_suivi_notifications
  (signalement_id,admin_user_id,destination,sujet,corps,statut) VALUES (?,?,?,?,?,'pending')`,[id,adminId,email,sujet,corps]);
 return resultat.insertId;
}
async function terminerNotification(id,success) {
 await db.promise().query(`UPDATE signalement_suivi_notifications
 SET statut=?,envoyee_at=CASE WHEN ?='sent' THEN NOW() ELSE NULL END WHERE id=?`,[success?'sent':'failed',success?'sent':'failed',id]);
}
module.exports={STATUTS,PRIORITES,clauses,lister,dossier,modifier,creerNotification,terminerNotification};
