'use strict';

// Phase 2A : backend de persistance uniquement. Aucune route exposee,
// aucune autorisation derivee du texte d'une adresse, aucun SMTP automatique.
const {serviceForAddress, SERVICE_ADDRESSES} = require('./tasklyMailSystemAddresses');

function failure(message, status=403) {
  return Object.assign(new Error(message), {status});
}
function positiveId(id) {
  const n=Number(id);
  if(!Number.isSafeInteger(n)||n<=0)throw failure('Identifiant invalide.',400);
  return n;
}
function validBody(body) {
  if(typeof body!=='string'||!body.trim()||body.length>10000)
    throw failure('Message invalide.',400);
  return body.trim();
}
function validSubject(subject) {
  if(typeof subject!=='string'||!subject.trim()||subject.length>200)
    throw failure('Objet invalide.',400);
  return subject.trim();
}
function createServiceThreads({transaction, userMailbox, authorizeAdmin}) {
  if(typeof transaction!=='function'||typeof userMailbox!=='function'||typeof authorizeAdmin!=='function')
    throw new TypeError('Dependances de securite requises.');

  // userMailbox(conn, userId) DOIT authentifier/prover le proprietaire via
  // le profil et la boite existante avant de retourner {user_id,address}.
  async function verifiedUser(conn, uid) {
    const box=await userMailbox(conn,uid);
    if(!box||Number(box.user_id)!==uid||typeof box.address!=='string'||
      !/^[^\s@]+@[a-z0-9-]+\.taskly\.(?:test|dz)$/i.test(box.address))
      throw failure('Boite utilisateur non autorisee.');
    return box;
  }
  // authorizeAdmin(adminContext) DOIT verifier une session admin et les
  // permissions cote serveur. Jamais un role fourni par le navigateur.
  async function checkAdmin(context) {
    if(await authorizeAdmin(context)!==true)throw failure('Administration non autorisee.');
    return positiveId(context?.userId);
  }
  async function createFromUser(userId, recipient, subject, body) {
    const uid=positiveId(userId), service=serviceForAddress(recipient);
    if(service!=='support')throw failure('Destinataire indisponible.',404);
    const s=validSubject(subject), text=validBody(body);
    return transaction(async conn=>{
      const box=await verifiedUser(conn,uid);
      const [insert]=await conn.query(
        `INSERT INTO taskly_mail_service_threads (service_name,user_id,user_address,subject)
         VALUES ('support',?,?,?)`, [uid,box.address,s]);
      const threadId=positiveId(insert.insertId);
      await conn.query(
        `INSERT INTO taskly_mail_service_entries (thread_id,sender_kind,sender_user_id,body)
         VALUES (?,'user',?,?)`, [threadId,uid,text]);
      return {threadId,serviceAddress:SERVICE_ADDRESSES.support};
    });
  }
  async function readForUser(userId, threadId) {
    const uid=positiveId(userId), tid=positiveId(threadId);
    return transaction(async conn=>{
      await verifiedUser(conn,uid);
      const [threads]=await conn.query(
        `SELECT id,service_name,user_id,subject,created_at,updated_at
         FROM taskly_mail_service_threads WHERE id=? AND user_id=?`, [tid,uid]);
      if(!threads[0])throw failure('Conversation introuvable.',404);
      const [entries]=await conn.query(
        `SELECT id,sender_kind,body,created_at FROM taskly_mail_service_entries
         WHERE thread_id=? ORDER BY id LIMIT 100`, [tid]);
      return {thread:threads[0],entries};
    });
  }
  async function readForAdmin(adminContext, threadId) {
    await checkAdmin(adminContext);
    const tid=positiveId(threadId);
    return transaction(async conn=>{
      const [threads]=await conn.query(
        `SELECT id,service_name,user_id,user_address,subject,created_at,updated_at
         FROM taskly_mail_service_threads WHERE id=?`,[tid]);
      if(!threads[0]||threads[0].service_name!=='support')throw failure('Conversation introuvable.',404);
      const [entries]=await conn.query(
        `SELECT id,sender_kind,body,created_at FROM taskly_mail_service_entries
         WHERE thread_id=? ORDER BY id LIMIT 100`,[tid]);
      return {thread:threads[0],entries};
    });
  }
  async function replyAsAdmin(adminContext, threadId, body) {
    const aid=await checkAdmin(adminContext),tid=positiveId(threadId),text=validBody(body);
    return transaction(async conn=>{
      const [threads]=await conn.query(
        `SELECT id FROM taskly_mail_service_threads
         WHERE id=? AND service_name='support' FOR UPDATE`,[tid]);
      if(!threads[0])throw failure('Conversation introuvable.',404);
      const [insert]=await conn.query(
        `INSERT INTO taskly_mail_service_entries (thread_id,sender_kind,sender_admin_id,body)
         VALUES (?,'admin',?,?)`,[tid,aid,text]);
      await conn.query('UPDATE taskly_mail_service_threads SET updated_at=NOW() WHERE id=?',[tid]);
      return {entryId:positiveId(insert.insertId),threadId:tid};
    });
  }
  return Object.freeze({createFromUser,readForUser,readForAdmin,replyAsAdmin});
}
module.exports={createServiceThreads};
