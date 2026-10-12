const express=require('express');const fs=require('fs').promises;const path=require('path');
const db=require('../config/db').promise();const {verifierConnexion,verifierArtisan}=require('../middleware/authMiddleware');
const {upload,dossier,formatValide}=require('../middleware/documentUpload');
const router=express.Router();router.use(verifierConnexion,verifierArtisan);
router.get('/status',async(req,res)=>{
 try{const [rows]=await db.query('SELECT id,verification_statut,verification_commentaire FROM artisans WHERE user_id=?',[req.session.utilisateur.id]);
  if(!rows[0])return res.status(404).json({message:'Profil inexistant.'});
  const [docs]=await db.query('SELECT id,type_document,original_name,media_type,created_at FROM artisan_documents WHERE artisan_id=? ORDER BY created_at DESC',[rows[0].id]);
  res.json({statut:rows[0].verification_statut,commentaire:rows[0].verification_commentaire,documents:docs});
 }catch(e){console.error(e.message);res.status(500).json({message:'Erreur serveur.'});}
});
// Un artisan peut consulter uniquement ses propres pièces privées.
router.get('/documents/:id',async(req,res)=>{
  res.set('Cache-Control','no-store, private');
  const id=Number(req.params.id);
  if(!/^[1-9]\d*$/.test(String(req.params.id))||!Number.isSafeInteger(id))return res.status(400).end();
  try{
    const [rows]=await db.query(`SELECT d.stored_name,d.media_type FROM artisan_documents d
      JOIN artisans a ON a.id=d.artisan_id WHERE d.id=? AND a.user_id=?`,[id,req.session.utilisateur.id]);
    const doc=rows[0];if(!doc)return res.status(404).end();
    if(!/^[a-f0-9]{64}$/.test(doc.stored_name))return res.status(404).end();
    const allowed=['application/pdf','image/jpeg','image/png'];
    const media=allowed.includes(doc.media_type)?doc.media_type:'application/octet-stream';
    const inline=req.query?.afficher==='1'&&allowed.includes(doc.media_type);
    res.set('Content-Type',media);res.set('X-Content-Type-Options','nosniff');
    if(inline)res.set('Content-Security-Policy',"sandbox; default-src 'none'; style-src 'unsafe-inline'");
    const extension={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'}[media]||'bin';
    res.set('Content-Disposition',`${inline?'inline':'attachment'}; filename="justificatif-${id}.${extension}"`);
    const stored=await require('../services/fileStorage').lire(doc.stored_name,true);
    if(stored)return res.send(stored.contenu);
    return res.sendFile(path.join(dossier,doc.stored_name));
  }catch(e){console.error(e.message);return res.status(500).end();}
});
router.post('/documents', upload.single('document'), async (req,res) => {
  if(!req.file)return sansCache(res).status(400).json({message:'Document requis.'});
  const type=String(req.body?.type_document||'');
  if(!types.has(type) || !formatValide(req.file.buffer,req.file.mimetype))
    return sansCache(res).status(400).json({message:'Type ou fichier invalide.'});
  const remplacement=String(req.body?.remplacer_document_id||'').trim();
  const documentId=remplacement?Number(remplacement):null;
  if(remplacement && (!Number.isSafeInteger(documentId)||documentId<1))
    return sansCache(res).status(400).json({message:'Document à remplacer invalide.'});
  let conn;
  try {
    conn=await db.getConnection();await conn.beginTransaction();
    const [artisans]=await conn.query('SELECT id,verification_statut FROM artisans WHERE user_id=? FOR UPDATE',[req.session.utilisateur.id]);
    if(!artisans[0]){await conn.rollback();return sansCache(res).status(404).json({message:'Profil artisan introuvable.'});}
    const artisan=artisans[0];
    if(documentId){
      const [existants]=await conn.query('SELECT id FROM artisan_documents WHERE id=? AND artisan_id=? FOR UPDATE',[documentId,artisan.id]);
      if(!existants.length){await conn.rollback();return sansCache(res).status(404).json({message:'Ce document ne fait pas partie de votre dossier.'});}
    }
    // L'enregistrement du blob, la pièce et la remise en verification sont atomiques.
    const stored=await enregistrer(req.file,true,conn);
    const valeurs=[type,stored,nomFichier(req.file.originalname),req.file.mimetype,req.file.size];
    if(documentId){
      await conn.query('UPDATE artisan_documents SET type_document=?,stored_name=?,original_name=?,media_type=?,taille=? WHERE id=? AND artisan_id=?', [...valeurs,documentId,artisan.id]);
    } else {
      await conn.query('INSERT INTO artisan_documents (type_document,stored_name,original_name,media_type,taille,artisan_id) VALUES (?,?,?,?,?,?)',[...valeurs,artisan.id]);
    }
    await conn.query("UPDATE artisans SET verification_statut='en_attente',verification_commentaire=NULL WHERE id=?",[artisan.id]);
    await conn.commit();
    sansCache(res).status(201).json({message:'Justificatif enregistré. Nouvelle vérification administrative requise.',nouvelleVerification:artisan.verification_statut==='approuve'});
  } catch(e){if(conn)await conn.rollback().catch(()=>{});console.error('Justificatif artisan:',e.code||e.message);
    sansCache(res).status(e.status||500).json({message:e.status?e.message:'Impossible d’enregistrer le document.'});
  } finally {conn?.release();}
});
module.exports=router;
