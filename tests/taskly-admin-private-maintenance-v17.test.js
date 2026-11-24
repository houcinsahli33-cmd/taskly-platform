"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const register=require("../server/routes/tasklyAdminPrivateMaintenanceV17");
function fixture(enabled=true,failed=0){
    let handler,invocations=0;
    register({get(route,fn){assert.equal(route,"/api/internal/taskly-apv17-maintenance");handler=fn;}},{config:{CRON_SECRET:"synthetic",TASKLY_ADMIN_PRIVATE_CLEANUP_V17_ENABLED:String(enabled)},run:async()=>{invocations++;return {failed};}});
    return {count:()=>invocations,async invoke(header){const result={status:200};await handler({get:()=>header},{set(k,v){assert.equal(v,"private, no-store");},status(v){result.status=v;return this;},end(){},json(v){result.body=v;}});return result;}};
}
test("APV17 maintenance: disabled and wrong secrets rejected",async()=>{
    const f=fixture();for(const header of ["","Bearer wrong","Bearer synthetix"])assert.equal((await f.invoke(header)).status,404);assert.equal(f.count(),0);const off=fixture(false);assert.equal((await off.invoke("Bearer synthetic")).status,404);assert.equal(off.count(),0);
});
test("APV17 maintenance: authorized execution and failure status",async()=>{
    const f=fixture();assert.equal((await f.invoke("Bearer synthetic")).body.ok,true);assert.equal(f.count(),1);const bad=fixture(true,1);assert.equal((await bad.invoke("Bearer synthetic")).status,503);
});
