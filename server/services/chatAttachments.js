'use strict';
const crypto=require('node:crypto');
const {formatValide}=require('../middleware/documentUpload');
const MAX=3*1024*1024;
const extensions={'application/pdf':'.pdf','image/jpeg':'.jpg','image/png':'.png'};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function decrire(file){
 if(!file||!Object.hasOwn(extensions,file.mimetype)||!Buffer.isBuffer(file.buffer)||file.buffer.length<1||file.buffer.length>MAX||!formatValide(file.buffer,file.mimetype))throw fail('Fichier invalide. PDF, JPEG ou PNG (3 Mo maximum).');
 const raw=String(file.originalname||'fichier').split(/[\\/]/).pop().normalize('NFC').replace(/[\p{C}<>:"|?*]/gu,'_').trim();
 const base=Array.from(raw.replace(/\.[^.]*$/,'')).slice(0,100).join('').trim()||'fichier';
 return {filename:base+extensions[file.mimetype],mime:file.mimetype,size:file.buffer.length,sha256:crypto.createHash('sha256').update(file.buffer).digest('hex')};
}
function idMessage(s){return typeof s==='string'&&/^[1-9][0-9]{0,18}$/.test(s)&&BigInt(s)<=9223372036854775807n;}
async function lire(conn,demandeId,messageId){
 const [rows]=await conn.query(`SELECT a.filename,a.media_type,a.byte_size,a.sha256,f.contenu
  FROM taskly_chat_messages m
  JOIN taskly_chat_attachments a ON a.message_id=m.id
  JOIN stored_files f ON f.id=a.file_id AND f.prive=1 AND f.media_type=a.media_type
  WHERE m.demande_id=? AND m.id=CAST(? AS UNSIGNED) LIMIT 1`,[demandeId,messageId]);
 const r=rows[0];
 if(!r||!Object.hasOwn(extensions,r.media_type)||!Buffer.isBuffer(r.contenu)||r.contenu.length>MAX||r.contenu.length!==Number(r.byte_size)||!formatValide(r.contenu,r.media_type)||crypto.createHash('sha256').update(r.contenu).digest('hex')!==r.sha256)throw fail('Fichier introuvable.',404);
 return r;
}
module.exports={decrire,lire,idMessage,MAX};
