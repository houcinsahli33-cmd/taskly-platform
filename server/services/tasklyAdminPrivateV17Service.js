'use strict';
// Storage and ACLs only. No encryption/key exchange is implemented server-side.
const error = (message, status=400) => Object.assign(new Error(message), {status});
const id = input => {
  const s=String(input);
  if(!/^[1-9][0-9]{0,9}$/.test(s) || Number(s)>2147483647)throw error('Identifiant invalide.');
  return Number(s);
};
const threadId = input => {
  const s=String(input);
  if(!/^[1-9][0-9]{0,18}$/.test(s))throw error('Conversation invalide.');
  return s;
};
const envelope=input=>{
  if(!input || typeof input!=='object' || input.alg!=='AES-256-GCM' ||
      !Number.isSafeInteger(input.keyVersion) || input.keyVersion<1 || input.keyVersion>100000 ||
      typeof input.nonce!=='string' || !/^[A-Za-z0-9_-]{16}$/.test(input.nonce) ||
      typeof input.ciphertext!=='string' || !/^[A-Za-z0-9_-]{24,16384}$/.test(input.ciphertext))
    throw error('Enveloppe chiffree invalide.');
  return {alg:input.alg,version:input.keyVersion,nonce:input.nonce,ciphertext:input.ciphertext};
};
function createService({db}){
  if(!db || typeof db.query!=='function'||typeof db.getConnection!=='function')throw new TypeError('SQL requis.');
  async function validAccount(c,uid,role){
    const [rows]=await c.query('SELECT id,role FROM users WHERE id=? AND statut_compte=\'actif\' AND email_verified=1 LIMIT 1',[uid]);
    if(!rows[0] || !(role==='admin'?rows[0].role==='admin':['client','artisan'].includes(rows[0].role)))throw error('Compte non autorise.',403);
  }
  async function check(c,uid,role,tid){
    const [rows]=await c.query('SELECT id,admin_user_id,member_user_id FROM taskly_admin_private_threads WHERE id=CAST(? AS UNSIGNED) LIMIT 1',[tid]);
    const t=rows[0];
    if(!t || Number(t[role==='admin'?'admin_user_id':'member_user_id'])!==uid)throw error('Conversation introuvable.',404);
    await validAccount(c,uid,role);
    const partner=Number(t[role==='admin'?'member_user_id':'admin_user_id']);
    await validAccount(c,partner,role==='admin'?'user':'admin');
    return t;
  }
  async function tx(fn){let c;try{c=await db.getConnection();await c.beginTransaction();const r=await fn(c);await c.commit();return r;}catch(e){if(c)await c.rollback();throw e;}finally{c?.release();}}
  async function open(admin,member){
    const aid=id(admin),mid=id(member);
    return tx(async c=>{
      await validAccount(c,aid,'admin'); await validAccount(c,mid,'user');
      await c.query('INSERT INTO taskly_admin_private_threads (admin_user_id,member_user_id) VALUES (?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',[aid,mid]);
      const [rows]=await c.query('SELECT CAST(id AS CHAR) AS id FROM taskly_admin_private_threads WHERE admin_user_id=? AND member_user_id=? LIMIT 1',[aid,mid]);
      return {id:rows[0].id};
    });
  }
  async function list(uid,role){
    const user=id(uid); if(!['admin','user'].includes(role))throw error('Role invalide.',403);
    await validAccount(db,user,role);
    const column=role==='admin'?'admin_user_id':'member_user_id';
    const [rows]=await db.query(`SELECT CAST(id AS CHAR) AS id,admin_user_id,member_user_id,updated_at FROM taskly_admin_private_threads WHERE ${column}=? ORDER BY updated_at DESC,id DESC LIMIT 100`,[user]);
    return rows;
  }
  async function read(uid,role,tid){
    const user=id(uid),thread=threadId(tid);
    await check(db,user,role,thread);
    const [rows]=await db.query('SELECT CAST(id AS CHAR) AS id,sender_user_id,alg,key_version AS keyVersion,nonce,ciphertext,created_at FROM taskly_admin_private_messages WHERE thread_id=CAST(? AS UNSIGNED) ORDER BY id DESC LIMIT 50',[thread]);
    return rows.reverse();
  }
  async function send(uid,role,tid,raw){
    const user=id(uid),thread=threadId(tid),data=envelope(raw);
    return tx(async c=>{
      await check(c,user,role,thread);
      const [result]=await c.query('INSERT INTO taskly_admin_private_messages (thread_id,sender_user_id,alg,key_version,nonce,ciphertext) VALUES (CAST(? AS UNSIGNED),?,?,?,?,?)',[thread,user,data.alg,data.version,data.nonce,data.ciphertext]);
      await c.query('UPDATE taskly_admin_private_threads SET updated_at=CURRENT_TIMESTAMP WHERE id=CAST(? AS UNSIGNED)',[thread]);
      return {id:String(result.insertId)};
    });
  }
  return {open,list,read,send};
}
module.exports={createService,envelope};
