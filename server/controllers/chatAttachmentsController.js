'use strict';
const {upload}=require('../middleware/documentUpload');
const access=require('./chatController');
const model=require('../models/chatModel');
const files=require('../services/chatAttachments');
const db=require('../config/db');
function active(){return process.env.TASKLY_CHAT_ATTACHMENTS_ENABLED==='true';}
async function recevoir(req,res,next){
 if(!active())return res.status(404).json({message:'Pièces jointes indisponibles.'});
 try{
  // Refuser une personne non autorisee avant de lire le flux multipart.
  const p=req.tasklyChatFileAccess||await access.verifierParticipant(req,res);if(!p)return;
  if(p.demande.statut!=='acceptee'||Number(p.demande.messagerie_bloquee)===1)return res.status(403).json({message:'Conversation fermée ou désactivée.'});
  req.tasklyChatFileAccess=p;
  upload.single('fichier')(req,res,error=>{
   if(error)return res.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({message:'Fichier refusé : PDF, JPEG ou PNG, 3 Mo maximum.'});
   next();
  });
 }catch(e){console.error('Autorisation chat fichier :',e.code||e.name);return res.status(503).json({message:'Envoi de fichier indisponible.'});}
}
async function envoyer(req,res){
 try{
  res.set('Cache-Control','private, no-store');
  if(!active())return res.status(404).json({message:'Pièces jointes indisponibles.'});
  const p=req.tasklyChatFileAccess||await access.verifierParticipant(req,res);if(!p)return;
  if(p.demande.statut!=='acceptee'||Number(p.demande.messagerie_bloquee)===1)return res.status(403).json({message:'Conversation fermée ou désactivée.'});
  if(req.body?.contenu!=null&&typeof req.body.contenu!=='string')return res.status(400).json({message:'Message invalide.'});
  const texte=(req.body?.contenu||'').trim();
  if(texte.length>4000)return res.status(400).json({message:'Message trop long.'});
  const desc=files.decrire(req.file);
  const id=await model.envoyerFichier(p.demandeId,p.role,p.profilId,texte||'Pièce jointe',req.file,desc);
  if(!id)return res.status(409).json({message:'Cette demande ne permet plus l’envoi.'});
  return res.status(201).json({id:String(id),message:'Fichier envoyé.'});
 }catch(e){console.error('Chat pièce jointe :',e.code||e.name);return res.status(e.status||503).json({message:e.status?e.message:'Envoi du fichier indisponible.'});}
}
async function telecharger(req,res){
 try{
  res.set('Cache-Control','private, no-store');
  if(!active())return res.status(404).json({message:'Pièces jointes indisponibles.'});
  const p=await access.verifierParticipant(req,res);if(!p)return;
  if(!access.historiqueAutorise(p.demande))return res.status(403).json({message:'Conversation inaccessible.'});
  if(!files.idMessage(req.params.messageId))return res.status(400).json({message:'Message invalide.'});
  const doc=await files.lire(db.promise(),p.demandeId,req.params.messageId);
  const ascii=doc.filename.replace(/[^\x20-\x7E]/g,'_').replace(/["\\]/g,'_').slice(0,150);
  res.set('Content-Type',doc.media_type);
  res.set('Content-Disposition',`attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`);
  res.set('X-Content-Type-Options','nosniff');
  res.set('Content-Length',String(doc.contenu.length));
  return res.status(200).send(doc.contenu);
 }catch(e){console.error('Lecture pièce jointe :',e.code||e.name);return res.status(e.status||503).json({message:e.status?e.message:'Téléchargement indisponible.'});}
}
module.exports={recevoir,envoyer,telecharger};
