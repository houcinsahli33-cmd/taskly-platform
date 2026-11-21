'use strict';
const crypto=require('node:crypto');
const formats={'application/pdf':'.pdf','image/jpeg':'.jpg','image/png':'.png'};
const MAX=3*1024*1024;
const failure=(message,status=400)=>Object.assign(new Error(message),{status});
function describe(file){
 if(!file || !Object.hasOwn(formats,file.mimetype)||!Buffer.isBuffer(file.buffer)||!file.buffer.length||file.buffer.length>MAX)throw failure('Fichier invalide : PDF, JPEG ou PNG, 3 Mo maximum.');
 const b=file.buffer,m=file.mimetype;
 if(!(m==='application/pdf'?b.subarray(0,5).toString('ascii')==='%PDF-':m==='image/jpeg'?b.subarray(0,3).equals(Buffer.from('ffd8ff','hex')):b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))))throw failure('Contenu du fichier non conforme.');
 const raw=String(file.originalname||'fichier').split(/[\\/]/).pop().normalize('NFC').replace(/[\p{C}<>:"|?*]/gu,'_').trim();
 const stem=Array.from(raw.replace(/\.[^.]*$/,'')).slice(0,100).join('').trim()||'fichier';
 return {name:stem+formats[m],mime:m,size:b.length,digest:crypto.createHash('sha256').update(b).digest('hex')};
}
async function meta(conn,owner,copy){
 const [rows]=await conn.query('SELECT a.filename AS name,a.media_type AS mime,a.byte_size AS size FROM taskly_mail_attachments a JOIN taskly_professional_mail_messages m ON m.id=a.copy_id WHERE m.owner_user_id=? AND m.id=CAST(? AS UNSIGNED)',[owner,copy]);
 return rows.map(r=>({name:r.name,mime:r.mime,size:Number(r.size)}));
}
async function retryMatches(conn,owner,message,descriptor){
 const [rows]=await conn.query("SELECT a.filename AS name,a.media_type AS mime,a.byte_size AS size,a.sha256 AS digest FROM taskly_mail_attachments a JOIN taskly_professional_mail_messages m ON m.id=a.copy_id WHERE m.owner_user_id=? AND m.message_id=? AND m.folder='sent'",[owner,message]);
 const r=rows[0];return descriptor?Boolean(r&&r.name===descriptor.name&&r.mime===descriptor.mime&&Number(r.size)===descriptor.size&&r.digest===descriptor.digest):!r;
}
async function save(conn,message,sender,target,file,descriptor,storage){
 const fileId=await storage.enregistrer(file,true,conn);
 const [result]=await conn.query("INSERT INTO taskly_mail_attachments (copy_id,file_id,filename,media_type,byte_size,sha256) SELECT id,?,?,?,?,? FROM taskly_professional_mail_messages WHERE message_id=? AND ((owner_user_id=? AND folder='sent') OR (owner_user_id=? AND folder='inbox'))",[fileId,descriptor.name,descriptor.mime,descriptor.size,descriptor.digest,message,sender,target]);
 if(result.affectedRows!==2)throw failure('Enregistrement incomplet des pièces jointes.',503);
}
async function download(conn,owner,copy){
 const [rows]=await conn.query('SELECT a.filename AS name,f.media_type AS mime,f.contenu AS content FROM taskly_mail_attachments a JOIN taskly_professional_mail_messages m ON m.id=a.copy_id JOIN stored_files f ON f.id=a.file_id AND f.prive=1 AND f.media_type=a.media_type WHERE m.owner_user_id=? AND m.id=CAST(? AS UNSIGNED)',[owner,copy]);
 const r=rows[0];if(!r||!Object.hasOwn(formats,r.mime)||!Buffer.isBuffer(r.content)||r.content.length>MAX)throw failure('Fichier introuvable.',404);
 return r;
}
module.exports={describe,meta,retryMatches,save,download,MAX};
