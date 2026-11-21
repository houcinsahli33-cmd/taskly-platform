'use strict';

// Réglages indépendants pour chaque boîte, jamais pour l'identité entière.
const defaults=Object.freeze({
 notify_email:true,
 signature_enabled:false,
 signature:'',
 confirm_delete:true,
 preview_enabled:true,
 auto_save:true
});
const names=Object.keys(defaults);

function normalize(row){
 const r={...defaults};
 if(!row)return r;
 for(const name of names){
  if(name==='signature')r.signature=typeof row.signature==='string'?row.signature:'';
  else r[name]=Boolean(Number(row[name]));
 }
 return r;
}
function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!names.includes(k))){
  throw Object.assign(new Error('Préférences invalides.'),{status:400});
 }
 const result={};
 for(const name of names){
  if(!Object.hasOwn(input,name))throw Object.assign(new Error('Préférences incomplètes.'),{status:400});
  if(name==='signature'){
   if(typeof input.signature!=='string'||input.signature.length>1200)throw Object.assign(new Error('Signature limitée à 1 200 caractères.'),{status:400});
   result.signature=input.signature;
  }else{
   if(typeof input[name]!=='boolean')throw Object.assign(new Error('Option invalide : '+name),{status:400});
   result[name]=input[name];
  }
 }
 return result;
}
async function load(conn,id){
 const [rows]=await conn.query('SELECT notify_email,signature_enabled,signature,confirm_delete,preview_enabled,auto_save FROM taskly_mail_preferences WHERE user_id=?',[id]);
 return normalize(rows[0]);
}
async function save(conn,id,input){
 const p=validate(input);
 await conn.query(`INSERT INTO taskly_mail_preferences (user_id,notify_email,signature_enabled,signature,confirm_delete,preview_enabled,auto_save)
 VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE notify_email=VALUES(notify_email),signature_enabled=VALUES(signature_enabled),signature=VALUES(signature),confirm_delete=VALUES(confirm_delete),preview_enabled=VALUES(preview_enabled),auto_save=VALUES(auto_save)`,
 [id,Number(p.notify_email),Number(p.signature_enabled),p.signature,Number(p.confirm_delete),Number(p.preview_enabled),Number(p.auto_save)]);
 return p;
}
module.exports={defaults,normalize,validate,load,save};
