'use strict';
// Contrat d'intégration HTTPS. Aucun fournisseur réel n'est livré par ce module.
function unavailable(){return Object.assign(new Error('Service de messagerie professionnelle indisponible.'),{status:503});}
function bad(message){return Object.assign(new Error(message),{status:400});}
function config(env=process.env){
 if(env.TASKLY_MAIL_GATEWAY_ENABLED!=='true')return null;
 try{const url=new URL(env.TASKLY_MAIL_GATEWAY_URL);const secret=env.TASKLY_MAIL_GATEWAY_SECRET;
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||!secret||Buffer.byteLength(secret)<32||/[\r\n]/.test(secret))return null;
  return {origin:url.origin,secret};
 }catch{return null;}
}
const providerId=v=>typeof v==='string'&&/^[A-Za-z0-9_:.@-]{1,128}$/.test(v);
const keyValid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
function email(v){
 if(typeof v!=='string'||v.length>254)return false;
 const parts=v.split('@');if(parts.length!==2)return false;
 const [local,domain]=parts;
 if(local.length>64||!local||local.startsWith('.')||local.endsWith('.')||local.includes('..')||! /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local))return false;
 const labels=domain.split('.');return labels.length>=2&&/^[a-z]{2,63}$/i.test(labels.at(-1))&&labels.every(x=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(x));
}
function validateDraft(value){
 const {to='',subject='',body=''}=value||{};
 if(typeof to!=='string'||to.length>254||/[\r\n\x00]/.test(to)||typeof subject!=='string'||subject.length>200||/[\r\n\x00]/.test(subject)||typeof body!=='string'||Buffer.byteLength(body)>32000||body.includes('\u0000'))throw bad('Destinataire, objet ou texte invalide ou trop long.');
 return {to:to.trim(),subject,body};
}
function validateSend(value){const d=validateDraft(value);if(!email(d.to)||!d.subject.trim()||!d.body.trim()||!keyValid(value?.key))throw bad('Destinataire, objet, texte et identifiant d’envoi requis.');return {...d,key:value.key};}
function folder(v){if(!['inbox','sent'].includes(v))throw bad('Dossier invalide.');return v;}
function cursor(v){if(v===undefined||v===null||v==='')return null;if(typeof v!=='string'||! /^[A-Za-z0-9_.~=-]{1,240}$/.test(v))throw bad('Curseur invalide.');return v;}
function messageId(v){if(!providerId(v))throw bad('Identifiant de message invalide.');return v;}
function string(v,max){if(typeof v!=='string'||v.length>max)throw unavailable();return v;}
function message(data,full=false){
 if(!data||!providerId(data.id)||!email(data.from)||!email(data.to)||typeof data.date!=='string'||data.date.length>40||!Number.isFinite(Date.parse(data.date)))throw unavailable();
 const result={id:data.id,from:data.from,to:data.to,subject:string(data.subject,500),date:data.date};
 if(full)result.body=string(data.body,65000);return result;
}
function createGateway({env=process.env,fetcher=globalThis.fetch}={}){
 const cfg=config(env);
 async function call(path,payload){
  if(!cfg)throw unavailable();
  try{
   const r=await fetcher(cfg.origin+path,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+cfg.secret,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
   if(!r.ok||!/^application\/json(?:;|$)/i.test(r.headers.get('content-type')||''))throw unavailable();
   const reader=r.body.getReader();let size=0;const chunks=[];
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>512000){await reader.cancel();throw unavailable();}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
   return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }catch{throw unavailable();}
 }
 function scope(mailbox){if(!providerId(mailbox?.provider_id)||!email(mailbox?.address))throw unavailable();return {mailboxId:mailbox.provider_id,address:mailbox.address};}
 function owner(data,mailbox){if(!data||data.mailboxId!==mailbox.provider_id||data.address!==mailbox.address)throw unavailable();}
 return {
  configured:!!cfg,
  async provision(address,idempotencyKey){if(!email(address)||!/^[a-f0-9]{64}$/.test(idempotencyKey))throw unavailable();const r=await call('/v1/mailboxes/provision',{address,idempotencyKey});if(!providerId(r?.mailboxId)||r.address!==address||r.state!=='ready')throw unavailable();return r.mailboxId;},
  async list(mailbox,box,next){const f=folder(box);const r=await call('/v1/messages/list',{...scope(mailbox),folder:f,cursor:cursor(next),limit:25});owner(r,mailbox);if(!Array.isArray(r.messages)||r.messages.length>25)throw unavailable();const messages=r.messages.map(m=>message(m));let continuation;try{continuation=cursor(r.next);}catch{throw unavailable();}if(continuation&&continuation===cursor(next))throw unavailable();if(new Set(messages.map(m=>m.id)).size!==messages.length)throw unavailable();return {messages,next:continuation};},
  async read(mailbox,id){const mid=messageId(id);const r=await call('/v1/messages/read',{...scope(mailbox),id:mid});owner(r,mailbox);const m=message(r.message,true);if(m.id!==mid)throw unavailable();return m;},
  async send(mailbox,value){const d=validateSend(value);const r=await call('/v1/messages/send',{...scope(mailbox),to:d.to,subject:d.subject,body:d.body,idempotencyKey:d.key});owner(r,mailbox);if(r.state!=='accepted'||!providerId(r.messageId))throw unavailable();return {id:r.messageId};}
 };
}
module.exports={createGateway,config,validateDraft,validateSend,folder,cursor,messageId,providerId,email};
