const session=require('express-session');
module.exports=function configurerSession(store){
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET doit contenir au moins 32 caracteres aleatoires.');
  return session({name:'artisans.sid',store,secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,
    cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:2*60*60*1000}});
};
