const session=require('express-session');
module.exports=function configurerSession(store,admin=false){
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET doit contenir au moins 32 caracteres aleatoires.');
  return session({name:admin?'taskly.admin.sid':'artisans.sid',store,secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,
    cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:4*60*60*1000}});
};
