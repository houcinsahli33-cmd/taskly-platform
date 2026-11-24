"use strict";
const {timingSafeEqual}=require("node:crypto");
function register(app,{run=()=>require("../services/tasklyAdminPrivateCleanupWorkerV17").runCleanup({db:require("../config/db").promise()}),config=process.env}={}){
    app.get("/api/internal/taskly-apv17-maintenance",async(req,res)=>{
        res.set("Cache-Control","private, no-store");
        const secret=config.CRON_SECRET;
        const token=/^Bearer ([^\s]+)$/i.exec(req.get("Authorization")||"")?.[1];
        if(config.TASKLY_ADMIN_PRIVATE_CLEANUP_V17_ENABLED!=="true"||!secret||!token)return res.status(404).end();
        const a=Buffer.from(secret),b=Buffer.from(token);
        if(a.length!==b.length||!timingSafeEqual(a,b))return res.status(404).end();
        try{
            const result=await run();
            return res.status(result.failed>0?503:200).json({ok:result.failed===0,result});
        }catch{return res.status(503).json({message:"Maintenance indisponible."});}
    });
}
module.exports=register;
