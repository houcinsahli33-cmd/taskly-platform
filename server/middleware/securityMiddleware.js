const crypto=require('crypto');
// Compteur atomique partagé en production, mémoire bornée en développement.
const buckets=new Map();
const SCRIPT=`local n=redis.call('INCR',KEYS[1]);
if n==1 or redis.call('PTTL',KEYS[1])<0 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end;
return {n,redis.call('PTTL',KEYS[1])}`;
function limiter({fenetre=15*60*1000,max=15,parCompte=false}={}) {
  if(!Number.isSafeInteger(fenetre)||fenetre<=0||!Number.isSafeInteger(max)||max<=0)throw new Error('Limiteur invalide');
  return async (req,res,next) => {
    const ip=req.ip || req.socket?.remoteAddress || 'unknown';
    // Express accepte les variantes de casse : elles doivent partager le même quota.
    const base = String(req.baseUrl || '').toLowerCase();
    const route = String(req.route?.path || req.path || '').toLowerCase();

    let source;

    if (parCompte) {
        const user = req.session?.utilisateur;

        if (!user ||
            !['client','artisan'].includes(user.role) ||
            !/^[1-9]\d{0,9}$/.test(String(user.id)) ||
            Number(user.id) > 2147483647) {
            return res.status(403).json({
                message: 'Acces refuse.'
            });
        }

        source = JSON.stringify([
            'compte-v1',
            base,
            route,
            String(req.method).toUpperCase(),
            user.role,
            Number(user.id)
        ]);
    } else {
        source = JSON.stringify([base,route,ip]);
    }
    let count,ttl;
    try {
      if(process.env.REDIS_URL || process.env.NODE_ENV==='production') {
        const secret=process.env.SESSION_SECRET;
        if(!secret||Buffer.byteLength(secret)<32)throw new Error('Secret invalide');
        const redis=require('../config/sessionStore').obtenirClientRedis();
        if(!redis)throw new Error('Redis indisponible');
        const cle='taskly:security:general:'+crypto.createHmac('sha256',secret).update(source).digest('hex');
        const resultat=await redis.eval(SCRIPT,{keys:[cle],arguments:[String(fenetre)]});
        count=Number(resultat[0]);ttl=Number(resultat[1]);
        if(!Number.isSafeInteger(count)||count<1||!Number.isFinite(ttl)||ttl<0)throw new Error('Compteur invalide');
      } else {
        const maintenant=Date.now();
        let b=buckets.get(source);
        if(!b||b.expires<=maintenant){
          if(buckets.size>=20000){
            for(const [k,v] of buckets)if(v.expires<=maintenant)buckets.delete(k);
            if(buckets.size>=20000&&!buckets.has(source))throw new Error('Limiteur saturé');
          }
          b={count:0,expires:maintenant+fenetre};
        }
        b.count++;buckets.set(source,b);count=b.count;ttl=b.expires-maintenant;
      }
    } catch(error) {
      return res.status(503).json({message:'Protection temporairement indisponible. Réessayez plus tard.'});
    }
    if(count>max){
      res.set('Retry-After',String(Math.max(1,Math.ceil(ttl/1000))));
      return res.status(429).json({message:'Trop de tentatives. Reessayez plus tard.'});
    }
    next();
  };
}
function csrfToken(req,res) {
  if (!req.session.csrfToken) req.session.csrfToken=crypto.randomBytes(32).toString('hex');
  res.set('Cache-Control','private, no-store');
  res.json({csrfToken:req.session.csrfToken});
}
// Ce middleware est monté sur /api et les routes mutantes : ne jamais
// reclassifier l'URL brute (variantes de casse, slash, route imbriquée).
function verifierCsrf(req, res, next) {

    if (
        ['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    ) {
        return next();
    }

    const attendu = req.session?.csrfToken;
    const fourni = req.get('X-CSRF-Token');

    // Validation du format des jetons
    const jetonValide = token =>
        typeof token === 'string' &&
        token.length === 64 &&
        /^[a-f0-9]{64}$/.test(token);

    if (
        !jetonValide(attendu) ||
        !jetonValide(fourni) ||
        !crypto.timingSafeEqual(
            Buffer.from(attendu, 'hex'),
            Buffer.from(fourni, 'hex')
        )
    ) {
        return res.status(403).json({
            message: 'Jeton de securite manquant ou expire. Actualisez la page.'
        });
    }

    next();
}
module.exports={limiter,csrfToken,verifierCsrf};
