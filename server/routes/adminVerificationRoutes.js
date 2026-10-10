const express=require('express');const fs=require('fs');const path=require('path');
const db=require('../config/db').promise();const {verifierConnexion,verifierAdmin}=require('../middleware/authMiddleware');
const {dossier}=require('../middleware/documentUpload');
const router=express.Router();router.use(verifierConnexion,verifierAdmin);
router.get('/artisans',async(req,res)=>{
  try{const [rows]=await db.query(`SELECT a.id,a.verification_statut,a.verification_commentaire,a.ville,u.nom,u.prenom,u.email,s.nom AS service_nom,
    (SELECT COUNT(*) FROM artisan_documents d WHERE d.artisan_id=a.id) AS documents_count
    FROM artisans a JOIN users u ON u.id=a.user_id JOIN services s ON s.id=a.service_id ORDER BY a.created_at DESC LIMIT 200`);
    res.json({artisans:rows});}catch(e){console.error(e.message);res.status(500).json({message:'Erreur serveur.'});}
});
router.get('/artisans/:id/documents',async(req,res)=>{
  try{const [rows]=await db.query('SELECT id,type_document,original_name,created_at FROM artisan_documents WHERE artisan_id=?',[req.params.id]);res.json({documents:rows});}
  catch(e){console.error(e.message);res.status(500).json({message:'Erreur serveur.'});}
});
router.get('/documents/:id',async(req,res)=>{
  try{const [rows]=await db.query('SELECT stored_name,original_name,media_type FROM artisan_documents WHERE id=?',[req.params.id]);
   const doc=rows[0];if(!doc)return res.status(404).end();
   const file=path.join(dossier,doc.stored_name);if(!/^[a-f0-9]{64}$/.test(doc.stored_name))return res.status(400).end();
   res.set('Cache-Control','no-store');res.set('Content-Type',doc.media_type);res.set('Content-Disposition',`attachment; filename="justificatif-${req.params.id}"`);res.sendFile(file);
  }catch(e){console.error(e.message);res.status(500).json({message:'Erreur serveur.'});}
});
router.put('/artisans/:id/decision',async(req,res)=>{
  const statut=String(req.body.statut||'');const commentaire=String(req.body.commentaire||'').trim().slice(0,500);
  if(!['approuve','refuse','a_completer'].includes(statut))return res.status(400).json({message:'Statut invalide.'});
  if(statut!=='approuve' && commentaire.length<5)return res.status(400).json({message:'Motif de cinq caracteres minimum.'});
  const conn=await db.getConnection();
  try{await conn.beginTransaction();
    const [rows]=await conn.query('SELECT id,verification_statut FROM artisans WHERE id=? FOR UPDATE',[req.params.id]);
    if(!rows[0]){await conn.rollback();return res.status(404).json({message:'Artisan introuvable.'});}
    if(statut==='approuve'){
      const [types]=await conn.query('SELECT DISTINCT type_document FROM artisan_documents WHERE artisan_id=?',[req.params.id]);
      const connus=new Set(types.map(x=>x.type_document));
      if(!connus.has('identite') || !['diplome','certificat','qualification'].some(t=>connus.has(t))){await conn.rollback();return res.status(400).json({message:'Identite et justificatif de qualification requis.'});}
    }
    await conn.query('UPDATE artisans SET verification_statut=?,verification_commentaire=? WHERE id=?',[statut,commentaire||null,req.params.id]);
    await conn.query('INSERT INTO verification_audit (artisan_id,admin_user_id,ancien_statut,nouveau_statut,commentaire) VALUES (?,?,?,?,?)',
      [req.params.id,req.session.utilisateur.id,rows[0].verification_statut,statut,commentaire||null]);
    await conn.commit();res.json({message:'Decision enregistree.'});
  }catch(e){await conn.rollback();console.error(e.message);res.status(500).json({message:'Erreur serveur.'});}
  finally{conn.release();}
});
module.exports=router;
