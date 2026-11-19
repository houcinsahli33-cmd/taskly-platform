'use strict';
// Diagnostic opt-in : durées uniquement, aucun identifiant ni contenu de session.
function mesurer(res,nom,debut){
 if(process.env.TASKLY_PERF_TIMING!=='true'||res.headersSent||typeof res.append!=='function')return;
 res.append('Server-Timing',`${nom};dur=${(Number(process.hrtime.bigint()-debut)/1e6).toFixed(2)}`);
}
function sessionMesuree(middleware,req,res,next){
 if(process.env.TASKLY_PERF_TIMING!=='true')return middleware(req,res,next);
 const debut=process.hrtime.bigint();
 return middleware(req,res,error=>{mesurer(res,'session_middleware',debut);next(error);});
}
module.exports={mesurer,sessionMesuree};
