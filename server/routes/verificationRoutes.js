const express=require('express');const fs=require('fs').promises;const path=require('path');
const db=require('../config/db').promise();const {verifierConnexion,verifierArtisan}=require('../middleware/authMiddleware');
const {upload,dossier,formatValide}=require('../middleware/documentUpload');
const router=express.Router();router.use(verifierConnexion,verifierArtisan);
router.get('/status',async(req,res)=>{
 try{const [rows]=await db.query('SELECT id,verification_statut,verification_commentaire FROM artisans WHERE user_id=?',[req.session.utilisateur.id]);
  if(!rows[0])return res.status(404).json({message:'Profil inexistant.'});
  const [docs]=await db.query('SELECT id,type_document,original_name,created_at FROM artisan_documents WHERE artisan_id=? ORDER BY created_at DESC',[rows[0].id]);
  res.json({statut:rows[0].verification_statut,commentaire:rows[0].verification_commentaire,documents:docs});
 }catch(e){console.error(e.message);res.status(500).json({message:'Erreur serveur.'});}
});
router.post('/documents',upload.single('document'),async(req,res)=>{
  if(!req.file)return res.status(400).json({message:'Document requis.'});
  const nettoyer=()=>fs.unlink(req.file.path).catch(()=>{});
  try{
    const type=String(req.body.type_document||'');
    if(!['identite','diplome','certificat','qualification'].includes(type)) {await nettoyer();return res.status(400).json({message:'Type invalide.'});}
    const contenu=await fs.readFile(req.file.path);
    if(!formatValide(contenu,req.file.mimetype)){await nettoyer();return res.status(400).json({message:'Fichier invalide.'});}
    const [rows]=await db.query('SELECT id,verification_statut FROM artisans WHERE user_id=?',[req.session.utilisateur.id]);
    if(!rows[0] || rows[0].verification_statut==='approuve'){await nettoyer();return res.status(403).json({message:'Depot non autorise.'});}
    await db.query(`INSERT INTO artisan_documents (artisan_id,type_document,stored_name,original_name,media_type,taille) VALUES (?,?,?,?,?,?)`,
      [rows[0].id,type,req.file.filename,path.basename(req.file.originalname).slice(0,255),req.file.mimetype,req.file.size]);
    await db.query("UPDATE artisans SET verification_statut='en_attente',verification_commentaire=NULL WHERE id=?",[rows[0].id]);
    res.status(201).json({message:'Document depose. Examen administratif en attente.'});
  }catch(e){await nettoyer();console.error(e.message);res.status(500).json({message:'Erreur serveur.'});}
});
module.exports=router;
