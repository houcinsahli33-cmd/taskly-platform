const session=require('express-session');
async function creerSessionStore() {
  if (process.env.REDIS_URL) {
    const {createClient}=require('redis');const {RedisStore}=require('connect-redis');
    const client=createClient({url:process.env.REDIS_URL});client.on('error',e=>console.error('Redis :',e.message));await client.connect();
    return new RedisStore({client,prefix:'taskly:sess:'});
  }
  if (process.env.NODE_ENV==='production') throw new Error('REDIS_URL obligatoire en production : MemoryStore interdit.');
  console.warn('Mode local uniquement : sessions en memoire. Redis requis pour 10 000 connexions.');
  return new session.MemoryStore();
}
module.exports={creerSessionStore};
