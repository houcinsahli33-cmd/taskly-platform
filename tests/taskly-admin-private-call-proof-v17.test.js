"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {webcrypto,randomUUID}=require("node:crypto"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const window={crypto:webcrypto};
const context=vm.createContext({window,TextEncoder,Uint8Array,ArrayBuffer,btoa,atob});
for(const name of ["taskly-admin-private-keys-v17.js","taskly-admin-private-call-proof-v17.js"]){
    vm.runInContext(fs.readFileSync(path.join(__dirname,"../client/public/js",name),"utf8"),context);
}
const keys=window.TasklyAdminPrivateKeysV17,p=window.TasklyAdminPrivateCallProofV17;
async function fixture(){
    const admin=await keys.create("admin",1),client=await keys.create("client",2);
    const call={id:randomUUID(),threadId:"17",callerUserId:1,recipientUserId:2,kind:"video"};
    const a=await keys.derive(admin,client,client.fingerprint,call.threadId,1,call.id);
    const b=await keys.derive(client,admin,admin.fingerprint,call.threadId,1,call.id);
    return {admin,client,call,a,b};
}
test("APV17 media: both participants derive same 64 bytes",async()=>{
    const {a,b}=await fixture();assert.equal(a.byteLength,64);assert.deepEqual(Buffer.from(a),Buffer.from(b));assert.equal(p.mediaKey(a).byteLength,32);
});
test("APV17 media: different call yields different key",async()=>{
    const {admin,client,call,a}=await fixture();const other=await keys.derive(admin,client,client.fingerprint,call.threadId,1,randomUUID());assert.notDeepEqual(Buffer.from(a),Buffer.from(other));
});
test("APV17 media: trusted fingerprint required",async()=>{
    const {admin,client,call}=await fixture();await assert.rejects(keys.derive(admin,client,"0".repeat(64),call.threadId,1,call.id));
});
test("APV17 media: reciprocal proof confirmation",async()=>{
    const {a,b,call}=await fixture();const first=await p.sign(a,call,1),second=await p.sign(b,call,2);assert.equal(first.length,64);assert.equal(await p.verify(b,call,1,first),true);assert.equal(await p.verify(a,call,2,second),true);assert.notEqual(first,second);
});
test("APV17 media: replay rejected",async()=>{
    const {a,b,call}=await fixture();const signature=await p.sign(a,call,1);assert.equal(await p.verify(b,{...call,id:randomUUID()},1,signature),false);
});
test("APV17 media: mode and actor substitution rejected",async()=>{
    const {a,b,call}=await fixture();const signature=await p.sign(a,call,1);assert.equal(await p.verify(b,{...call,kind:"audio"},1,signature),false);assert.equal(await p.verify(b,call,2,signature),false);
});
test("APV17 media: corrupted proof rejected",async()=>{
    const {a,b,call}=await fixture();const signature=await p.sign(a,call,1);assert.equal(await p.verify(b,call,1,(signature[0]==="0"?"1":"0")+signature.slice(1)),false);
});
test("APV17 media: message key remains nonextractable",async()=>{
    const {admin,client,call}=await fixture();const key=await keys.derive(admin,client,client.fingerprint,call.threadId,1);assert.equal(key.extractable,false);assert.equal(key.algorithm.name,"AES-GCM");
});
