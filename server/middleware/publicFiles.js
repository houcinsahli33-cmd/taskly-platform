// Sert la source unique client/public, y compris dans la fonction Vercel.
// Les HTML de client/private ne peuvent jamais être résolus par ce middleware.
const path=require('path');
const publicRoot=path.resolve(__dirname,'../../client/public');
const extensions=new Set(['.html','.css','.js','.json','.svg','.png','.jpg','.jpeg','.gif','.webp','.avif','.ico','.woff','.woff2','.ttf','.otf']);
const privatePages=new Set(['admin-login.html','admin-dashboard.html','client-dashboard.html','artisan-dashboard.html']);
function resolvePublicPath(urlPath){
 if(urlPath==='/')urlPath='/index.html';
 let decoded;try{decoded=decodeURIComponent(urlPath);}catch{return null;}
 if(!decoded.startsWith('/')||decoded.includes('\\')||decoded.includes('\0')||decoded.split('/').some(s=>s.startsWith('.')))return null;
 const file=path.resolve(publicRoot,'.'+decoded);
 if(!file.startsWith(publicRoot+path.sep)||privatePages.has(path.basename(file).toLowerCase())||!extensions.has(path.extname(file).toLowerCase()))return null;
 return file;
}
function publicFiles(req,res,next){
 if(!['GET','HEAD'].includes(req.method))return next();
 const file=resolvePublicPath(req.path);if(!file)return next();
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 res.setHeader('Cache-Control','no-cache');
 res.sendFile(path.relative(publicRoot,file),{root:publicRoot,dotfiles:'deny',cacheControl:false},error=>{
  if(!error)return;
  if(res.headersSent)return next(error);
  if(error.status===404||error.code==='ENOENT')return next();
  next(error);
 });
}
module.exports={publicFiles,resolvePublicPath};
