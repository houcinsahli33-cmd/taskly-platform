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
router.post('/documents',upload.single('document'),async(req,res)=>{
  if(!req.file)return res.status(400).json({message:'Document requis.'});
  const nettoyer=async()=>{};
  try{
    const type=String(req.body.type_document||'');
    if(!['identite','diplome','certificat','qualification'].includes(type)) {await nettoyer();return res.status(400).json({message:'Type invalide.'});}
    const contenu=req.file.buffer;
    if(!formatValide(contenu,req.file.mimetype)){await nettoyer();return res.status(400).json({message:'Fichier invalide.'});}
    const [rows]=await db.query('SELECT id,verification_statut FROM artisans WHERE user_id=?',[req.session.utilisateur.id]);
    if(!rows[0] || rows[0].verification_statut==='approuve'){await nettoyer();return res.status(403).json({message:'Depot non autorise.'});}
    const stored = await require('../services/fileStorage').enregistrer(req.file,true);
    await db.query(`INSERT INTO artisan_documents (artisan_id,type_document,stored_name,original_name,media_type,taille) VALUES (?,?,?,?,?,?)`,
      [rows[0].id,type,stored,path.basename(req.file.originalname).slice(0,255),req.file.mimetype,req.file.size]);
    await db.query("UPDATE artisans SET verification_statut='en_attente',verification_commentaire=NULL WHERE id=?",[rows[0].id]);
    res.status(201).json({message:'Document depose. Examen administratif en attente.'});
  }catch(e){await nettoyer();console.error(e.message);res.status(500).json({message:'Erreur serveur.'});}
});
module.exports=router;
