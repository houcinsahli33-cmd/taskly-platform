'use strict';
const model=require('../models/adminSignalementsModel');
const {envoyerCourrielAdmin}=require('../services/adminMailService');
function entier(val,max=1000000000) {if(typeof val!=='string'||!/^[1-9]\d*$/.test(val))return null;const n=Number(val);return Number.isSafeInteger(n)&&n<=max?n:null;}
function erreurServeur(res,error){
 console.error('Administration signalements :',error.code||error.message);
 // Explicitement demander la migration au lieu de masquer le problème par des données fictives.
 return res.status(error.code==='ER_BAD_FIELD_ERROR'||error.code==='ER_NO_SUCH_TABLE'?503:500)
  .json({message:'Suivi des signalements indisponible. Vérifiez la migration MySQL et la connexion serveur.'});
}
async function lister(req,res){
 const q=req.query||{};
 const page=q.page===undefined?1:entier(q.page,100000);
 const limite=q.limite===undefined?6:entier(q.limite,50);
 const statut=q.statut??'tous',priorite=q.priorite??'toutes',tri=q.tri??'recent',recherche=q.recherche??'';
 if(!page||!limite|| !['tous',...model.STATUTS].includes(statut) || !['toutes',...model.PRIORITES].includes(priorite)||
  !['recent','ancien','priorite'].includes(tri)||typeof recherche!=='string'||recherche.length>100)
  return res.status(400).json({message:'Filtres invalides.'});
 try{return res.json(await model.lister({page,limite,statut,priorite,tri,recherche:recherche.trim()}));}
 catch(e){return erreurServeur(res,e);}
}
async function examiner(req,res){
 const id=entier(req.params.id);if(!id)return res.status(400).json({message:'Identifiant invalide.'});
 try{const data=await model.dossier(id);return data?res.json(data):res.status(404).json({message:'Signalement introuvable.'});}
 catch(e){return erreurServeur(res,e);}
}
async function modifier(req,res){
 const id=entier(req.params.id);if(!id)return res.status(400).json({message:'Identifiant invalide.'});
 const {statut,priorite}=req.body||{};
 if((statut===undefined&&priorite===undefined)|| (statut!==undefined&&!model.STATUTS.includes(statut))||
  (priorite!==undefined&&!model.PRIORITES.includes(priorite))||Object.keys(req.body||{}).some(k=>!['statut','priorite'].includes(k)))
  return res.status(400).json({message:'Statut ou priorité invalide.'});
 try{
  const resultat=await model.modifier(id,req.session.utilisateur.id,{statut,priorite});
  return resultat?res.json({message:'Signalement mis à jour.',signalement:resultat}):res.status(404).json({message:'Signalement introuvable.'});
 }catch(e){return erreurServeur(res,e);}
}
async function notifier(req,res){
 const id=entier(req.params.id);if(!id)return res.status(400).json({message:'Identifiant invalide.'});
 const {sujet,corps}=req.body||{};
 if(typeof sujet!=='string'||!sujet.trim()||sujet.length>160 ||typeof corps!=='string'||corps.trim().length<10||corps.length>5000 ||
  Object.keys(req.body||{}).some(k=>!['sujet','corps'].includes(k)))return res.status(400).json({message:'Sujet ou message invalide.'});
 try{
  const donnees=await model.dossier(id);
  if(!donnees)return res.status(404).json({message:'Signalement introuvable.'});
  if(donnees.signalement.statut!=='traite')return res.status(409).json({message:'Marquez le signalement comme traité avant d’envoyer le message.'});
  if(!donnees.signalement.signaleur_email)return res.status(409).json({message:'Le déclarant n’a pas d’adresse e-mail.'});
  const notificationId=await model.creerNotification(id,req.session.utilisateur.id,donnees.signalement.signaleur_email,sujet.trim(),corps.trim());
  try{
   await envoyerCourrielAdmin(donnees.signalement.signaleur_email,sujet.trim(),corps.trim());
   await model.terminerNotification(notificationId,true);
   return res.json({message:'E-mail envoyé au déclarant.',notificationId});
  } catch(emailError){
   await model.terminerNotification(notificationId,false).catch(err=>console.error('Journal de notification :',err.code||err.message));
   console.error('Envoi signalement :',emailError.code||emailError.message);
   return res.status(503).json({message:'E-mail non envoyé. Vérifiez la configuration SMTP ; vous pouvez réessayer.'});
  }
 }catch(e){return erreurServeur(res,e);}
}
module.exports={lister,examiner,modifier,notifier};
