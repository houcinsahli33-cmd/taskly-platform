'use strict';
const crypto=require('node:crypto');
function slug(s){return String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,25).replace(/-+$/,'');}
function domaine(value){const d=String(value||'').trim().toLowerCase();return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)&&d.length<=150?d:null;}
function adresse(profil,domain,collision=false){
 const d=domaine(domain);if(!d)throw Error('Domaine Taskly Mail non configuré.');
 const id=Number(profil.id);if(!Number.isSafeInteger(id)||id<=0)throw Error('Identifiant invalide.');
 const isClient=profil.role==='client';
 const base=[slug(profil.nom),slug(profil.prenom)].filter(Boolean).join('.')||(isClient?'client':'artisan');
 const local=collision?base.slice(0,45)+'.'+id:base;
 const metier=isClient?'client':(slug(profil.service_nom)||'service-'+Number(profil.service_id));
 const result=local+'@'+metier+'.'+d;if(result.length>254)throw Error('Adresse trop longue.');return result;
}
function empreinte(secret,userId,address,code){
 if(typeof secret!=='string'||Buffer.byteLength(secret)<32)throw Object.assign(Error('Confirmation indisponible.'),{status:503});
 const id=Number(userId);if(!Number.isSafeInteger(id)||id<1)throw Error('Identifiant invalide.');
 // Conserve le format des empreintes originales (identifiant numérique SQL).
 return crypto.createHmac('sha256',secret).update(JSON.stringify(['professional-mail-v1',id,address,code])).digest('hex');
}
function peutDemander(old,profilIdentique){
 if(!old)return true;
 if(!['pending_confirmation','cancelled'].includes(old.status))throw Object.assign(Error('Une demande a déjà été traitée ou attend une décision. Contactez le support.'),{status:409});
 if(!profilIdentique)throw Object.assign(Error('Votre profil a changé. Contactez le support.'),{status:409});
 const age=Number(old.age);
 if(old.age==null||!Number.isFinite(age)||age<60)throw Object.assign(Error('Veuillez attendre une minute.'),{status:429});
 return true;
}
function codeValide(secret,row,code){if(typeof code!=='string'||!/^\d{6}$/.test(code)||!/^[a-f0-9]{64}$/.test(row.code_hash||''))return false;return crypto.timingSafeEqual(Buffer.from(row.code_hash,'hex'),Buffer.from(empreinte(secret,row.user_id,row.proposed_address,code),'hex'));}
module.exports={slug,domaine,adresse,empreinte,codeValide,peutDemander};
