const crypto=require('crypto');
// Limiteur local de developpement ; en multi-instance, utiliser Redis / reverse proxy.
const buckets=new Map();
function limiter({fenetre=15*60*1000,max=15}={}) {
  return (req,res,next) => {
    const maintenant=Date.now(), ip=req.ip || req.socket.remoteAddress, cle=`${req.baseUrl}:${req.path}:${ip}`;
    let b=buckets.get(cle);
    if (!b || b.expires < maintenant) b={count:0,expires:maintenant+fenetre};
    b.count++;buckets.set(cle,b);
    if (buckets.size > 20000) for (const [k,v] of buckets) if(v.expires < maintenant) buckets.delete(k);
    if (b.count > max) return res.status(429).json({message:'Trop de tentatives. Reessayez plus tard.'});
    next();
  };
}
function csrfToken(req,res) {
  if (!req.session.csrfToken) req.session.csrfToken=crypto.randomBytes(32).toString('hex');
  res.json({csrfToken:req.session.csrfToken});
}
function verifierCsrf(req,res,next) {
  if (['GET','HEAD','OPTIONS'].includes(req.method) || !req.originalUrl.startsWith('/api/')) return next();
  const attendu=req.session && req.session.csrfToken;
  const fourni=req.get('X-CSRF-Token');
  if (!attendu || !fourni || attendu.length!==fourni.length ||
      !crypto.timingSafeEqual(Buffer.from(attendu),Buffer.from(fourni))) {
    return res.status(403).json({message:'Jeton de securite manquant ou expire. Actualisez la page.'});
  }
  next();
}
module.exports={limiter,csrfToken,verifierCsrf};
