'use strict';
const model=require('../models/adminSupportModel');
const {envoyerCourrielAdmin}=require('../services/adminMailService');
function error(res,err){console.error('Support admin :',err.code||err.message);return res.status(err.status||503).json({message:err.status?err.message:'Service support temporairement indisponible.'});}
async function lister(req,res){try{return res.json(await model.liste(req.query));}catch(e){return error(res,e);}}
async function examiner(req,res){try{const item=await model.detail(req.params.id);return item?res.json(item):res.status(404).json({message:'Message introuvable.'});}catch(e){return error(res,e);}}
async function modifier(req,res){
  const {statut}=req.body||{};
  if(!['nouveau','en_cours','traite'].includes(statut))return res.status(400).json({message:'Statut invalide.'});
  try{
    const dossier=await model.detail(req.params.id);
    if(!dossier)return res.status(404).json({message:'Message introuvable.'});
    const compte=Boolean(dossier.message.compte_id)&&['client','artisan'].includes(dossier.message.compte_role);
    if(!compte&&statut!=='traite')return res.status(403).json({message:'Un message anonyme peut seulement etre marque comme traite.'});
    const ok=await model.statut(req.params.id,statut,req.session.utilisateur.id);
    return ok?res.json({message:'Statut enregistre.'}):res.status(404).json({message:'Message introuvable.'});
  }
  catch(e){return error(res,e);}
}
async function repondre(req,res){
  const contactId=model.idValide(req.params.id);
  const sujet=req.body?.sujet,corps=req.body?.corps,cle=req.body?.cle;
  if(!contactId || typeof sujet!=='string'||!sujet.trim()||sujet.length>160||typeof corps!=='string'||corps.trim().length<5||corps.length>5000||typeof cle!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cle)))
    return res.status(400).json({message:'Objet, message ou identifiant de demande invalide.'});
  try {
    const dossier=await model.detail(contactId);
    if(!dossier)return res.status(404).json({message:'Message introuvable.'});
    if(!dossier.message.compte_id||!['client','artisan'].includes(dossier.message.compte_role))return res.status(403).json({message:'Reponse impossible : aucun compte client ou artisan associe.'});
    const destination=dossier.message.compte_email;
    if(!destination||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)))return res.status(400).json({message:'Adresse de compte invalide.'});
    if(!process.env.SUPPORT_MAIL_FROM && !process.env.MAIL_FROM)return res.status(503).json({message:'Adresse d’envoi officielle non configuree.'});
    const reservation=await model.preparerReponse({contactId,adminId:req.session.utilisateur.id,destination,sujet:sujet.trim(),corps:corps.trim(),cle});
    if(!reservation.envoi)return res.status(409).json({message:reservation.statut==='sent'?'Cette reponse a deja ete envoyee.':'Cette tentative existe deja : consultez son historique avant de retenter.',statut:reservation.statut});
    try {
      await envoyerCourrielAdmin(destination,sujet.trim(),corps.trim(),process.env.SUPPORT_MAIL_FROM||process.env.MAIL_FROM);
    }catch(err){
      try{await model.resultatEnvoi(reservation.id,false);}catch(dbError){console.error('Etat du mail non enregistre :',dbError.code||dbError.message);}
      console.error('Reponse support SMTP echouee :',err.code||err.message);
      return res.status(502).json({message:'Envoi non confirme. Consultez l’historique avant tout nouvel essai.'});
    }
    try{await model.resultatEnvoi(reservation.id,true);}
    catch(err){console.error('Mail envoye mais suivi DB indisponible :',err.code||err.message);return res.status(503).json({message:'Envoi SMTP effectue mais suivi non confirme. Verifiez avant toute nouvelle tentative.'});}
    return res.status(200).json({message:'Reponse envoyee et historique enregistre.'});
  }catch(e){return error(res,e);}
}
module.exports={lister,examiner,modifier,repondre};
