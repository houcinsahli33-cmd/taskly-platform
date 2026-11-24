'use strict';
// Storage and ACLs only. No encryption/key exchange is implemented server-side.
const { ECDH } = require('node:crypto');
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
      typeof input.ciphertext!=='string' || !/^[A-Za-z0-9_-]{23,16384}$/.test(input.ciphertext))
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
    if(!['admin','user'].includes(role))throw error('Role invalide.',403);
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
    const peerColumn=role==='admin'?'member_user_id':'admin_user_id';

    const [rows]=await db.query(
      `SELECT CAST(t.id AS CHAR) AS id,
              t.admin_user_id,t.member_user_id,t.updated_at,
              u.role AS peer_role,
              CONCAT_WS(' ',u.prenom,u.nom) AS peer_name
       FROM taskly_admin_private_threads t
       JOIN users u ON u.id=t.${peerColumn}
       WHERE t.${column}=?
         AND u.statut_compte='actif'
         AND u.email_verified=1
       ORDER BY t.updated_at DESC,t.id DESC
       LIMIT 100`,
      [user]
    );
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
  function validatePublicKey(value) {
    if (typeof value !== 'string' ||
        !/^[A-Za-z0-9_-]{87}$/.test(value)) {
      throw error('Cle publique invalide.');
    }

    const raw = Buffer.from(value, 'base64url');

    if (raw.length !== 65 ||
        raw[0] !== 4 ||
        raw.toString('base64url') !== value) {
      throw error('Format de cle invalide.');
    }

    try {
      ECDH.convertKey(
        raw, 'prime256v1',
        undefined, undefined, 'uncompressed'
      );
    } catch {
      throw error('Point cryptographique invalide.');
    }

    return value;
  }

  async function publishPublicKey(uid, role, tid, input) {
    const user = id(uid);
    const thread = threadId(tid);
    const publicKey = validatePublicKey(input);

    return tx(async c => {
      await check(c, user, role, thread);

      await c.query(
        `INSERT INTO taskly_admin_private_public_keys
          (thread_id,user_id,public_key)
         VALUES (CAST(? AS UNSIGNED),?,?)
         ON DUPLICATE KEY UPDATE public_key=public_key`,
        [thread, user, publicKey]
      );

      const [rows] = await c.query(
        `SELECT public_key
         FROM taskly_admin_private_public_keys
         WHERE thread_id=CAST(? AS UNSIGNED)
           AND user_id=? LIMIT 1`,
        [thread, user]
      );

      if (!rows[0] || rows[0].public_key !== publicKey) {
        throw error('Identite deja enregistree.',409);
      }

      return { registered:true };
    });
  }

  async function getPublicKeys(uid, role, tid) {
    const user = id(uid);
    const thread = threadId(tid);

    const participants = await check(db,user,role,thread);

    const [rows] = await db.query(
      `SELECT u.id AS userId,u.role,k.public_key AS publicKey
       FROM users u
       LEFT JOIN taskly_admin_private_public_keys k
         ON k.user_id=u.id
         AND k.thread_id=CAST(? AS UNSIGNED)
       WHERE u.id IN (?,?)
       ORDER BY u.id`,
      [
        thread,
        participants.admin_user_id,
        participants.member_user_id
      ]
    );

    return rows;
  }

  async function contacts(adminId, input) {
    const aid=id(adminId);

    await validAccount(db,aid,'admin');

    if(typeof input!=='string' ||
       input.trim().length<2 ||
       input.trim().length>100){
      throw error('Recherche invalide.');
    }

    const q=input.trim();

    const [rows]=await db.query(
      `SELECT id AS userId,role,
              CONCAT_WS(' ',prenom,nom) AS name
       FROM users
       WHERE role IN ('client','artisan')
         AND statut_compte='actif'
         AND email_verified=1
         AND (
           LOCATE(?,CONCAT_WS(' ',prenom,nom))>0
           OR CAST(id AS CHAR)=?
         )
       ORDER BY prenom,nom,id
       LIMIT 30`,
      [q,q]
    );

    return rows;
  }

  async function unread(uid,role) {
    const user=id(uid);

    if(!['admin','user'].includes(role)){
      throw error('Role invalide.',403);
    }

    await validAccount(db,user,role);

    const own=role==='admin'
      ? 'admin_user_id'
      : 'member_user_id';

    const peer=role==='admin'
      ? 'member_user_id'
      : 'admin_user_id';

    const allowedPeer=role==='admin'
      ? "p.role IN ('client','artisan')"
      : "p.role='admin'";

    const [rows]=await db.query(
      `SELECT CAST(t.id AS CHAR) AS id,
              COUNT(*) AS unread
       FROM taskly_admin_private_threads t
       JOIN taskly_admin_private_messages m
         ON m.thread_id=t.id
       JOIN users p ON p.id=t.${peer}
       LEFT JOIN taskly_admin_private_receipts r
         ON r.message_id=m.id
         AND r.reader_user_id=?
       WHERE t.${own}=?
         AND m.sender_user_id=t.${peer}
         AND ${allowedPeer}
         AND p.statut_compte='actif'
         AND p.email_verified=1
         AND r.message_id IS NULL
       GROUP BY t.id`,
      [user,user]
    );

    const threads=rows.map(row=>{
      const count=Number(row.unread);

      if(!Number.isSafeInteger(count)||count<0){
        throw error('Compteur invalide.',503);
      }

      return {
        id:String(row.id),
        unread:count
      };
    });

    const total=threads.reduce(
      (sum,t)=>sum+t.unread,0
    );

    if(!Number.isSafeInteger(total)){
      throw error('Compteur invalide.',503);
    }

    return {total,threads};
  }

  async function markRead(uid,role,tid,input) {
    const user=id(uid);
    const thread=threadId(tid);

    if(!['admin','user'].includes(role)){
      throw error('Role invalide.',403);
    }

    if(!Array.isArray(input) ||
       input.length<1 ||
       input.length>50 ||
       input.some(value=>typeof value!=='string')){
      throw error('Liste de messages invalide.');
    }

    const ids=[...new Set(input.map(threadId))];

    return tx(async c=>{
      const t=await check(c,user,role,thread);

      const partner=Number(
        t[role==='admin'
          ? 'member_user_id'
          : 'admin_user_id']
      );

      const placeholders=ids.map(
        ()=>'CAST(? AS UNSIGNED)'
      ).join(',');

      await c.query(
        `INSERT INTO taskly_admin_private_receipts
           (message_id,reader_user_id)
         SELECT m.id,?
         FROM taskly_admin_private_messages m
         WHERE m.thread_id=CAST(? AS UNSIGNED)
           AND m.sender_user_id=?
           AND m.id IN (${placeholders})
         ON DUPLICATE KEY UPDATE
           read_at=taskly_admin_private_receipts.read_at`,
        [user,thread,partner,...ids]
      );

      return {ok:true};
    });
  }

  const calls = require(
    './tasklyAdminPrivateCallsV17'
  ).createCallService({
    tx,check,id,threadId
  });

  return {
    calls,
    unread,markRead,
    contacts,open,list,read,send,
    publishPublicKey,getPublicKeys
  };
}
module.exports={createService,envelope};
