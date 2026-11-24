'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=join(__dirname,'..');
const code=rel=>readFileSync(join(root,rel),'utf8');
const v24=code('client/public/js/taskly-e2ee-identity-v24.js');
const v25=code('client/public/js/taskly-e2ee-identity-gate-v25.js');
const v22=code('client/public/js/taskly-e2ee-auto-keys.js');
function mockDb() {
    const data=new Map();
    const db = {
        close() {},
        createObjectStore() {},
        transaction(name,mode) {
            const tx={oncomplete:null,onerror:null,onabort:null,
                objectStore() {
                    return {
                        get(key) {
                            const req={};
                            queueMicrotask(()=>{req.result=data.get(name+':'+key);req.onsuccess?.();});
                            return req;
                        },
                        put(value,key) {return store(value,key);},
                        add(value,key) {return store(value,key);}
                    };
                }
            };
            function store(value,key) {
                const req={};
                queueMicrotask(()=>{
                    data.set(name+':'+key,value);
                    req.result=key;req.onsuccess?.();
                    queueMicrotask(()=>tx.oncomplete?.());
                });
                return req;
            }
            return tx;
        }
    };
    return {open(name, version) {
        const req={result:db};
        queueMicrotask(()=>{
            req.onupgradeneeded?.();
            queueMicrotask(()=>req.onsuccess?.());
        });
        return req;
    }};
}
function browser() {
    const w={crypto:webcrypto,indexedDB:mockDb()};
    const context=vm.createContext({window:w,TextEncoder,Uint8Array,ArrayBuffer,
        Number,String,JSON,Array,Object,Error,RegExp,btoa,atob,Promise});
    for (const src of [v24,v22,v25]) vm.runInContext(src,context);
    return {
        identity:w.TasklyE2EEIdentityV24,
        auto:w.TasklyE2EEAutoKeys,
        gate:w.TasklyE2EEIdentityGateV25
    };
}
const cid='11fb9d9f-f8c9-4b57-aa5d-4d0b27efa082';
async function actors() {
    const client=browser(),artisan=browser();
    const cIdentity=await client.gate.getOwnIdentity('client',150002);
    const aIdentity=await artisan.gate.getOwnIdentity('artisan',270002);
    return {client,artisan,cIdentity,aIdentity};
}
async function trustPair(a) {
    await a.client.gate.trustPeer({selfRole:'client',selfAccountId:150002,
        peerRole:'artisan',peerAccountId:270002,
        verifiedFingerprint:a.aIdentity.fingerprint,verifiedOutsideTaskly:true});
    await a.artisan.gate.trustPeer({selfRole:'artisan',selfAccountId:270002,
        peerRole:'client',peerAccountId:150002,
        verifiedFingerprint:a.cIdentity.fingerprint,verifiedOutsideTaskly:true});
}
test('V25: signature ECDH liee au profil, demande et appel, cle verifiee',async()=>{
    const a=await actors(); await trustPair(a);
    const c=await a.client.auto.create(),art=await a.artisan.auto.create();
    const signedC=await a.client.gate.sign({role:'client',accountId:150002,
        demandeId:270002,callId:cid,session:c});
    const signedA=await a.artisan.gate.sign({role:'artisan',accountId:270002,
        demandeId:270002,callId:cid,session:art});
    assert.equal(await a.client.gate.verify({packet:signedA,
        selfRole:'client',selfAccountId:150002,peerRole:'artisan',peerAccountId:270002,
        demandeId:270002,callId:cid,ephemeralPublicKey:art.publicKey}),true);
    assert.equal(await a.artisan.gate.verify({packet:signedC,
        selfRole:'artisan',selfAccountId:270002,peerRole:'client',peerAccountId:150002,
        demandeId:270002,callId:cid,ephemeralPublicKey:c.publicKey}),true);
    const kc=await a.client.auto.derive(c,art.publicKey,cid,270002);
    const ka=await a.artisan.auto.derive(art,c.publicKey,cid,270002);
    assert.equal(Buffer.from(kc).toString('hex'),Buffer.from(ka).toString('hex'));
    const proof=await a.artisan.auto.proof(ka,cid,'accept');
    assert.equal(await a.client.auto.verify(kc,cid,'accept',proof),true);
});
test('V25: sans preuve externe de l empreinte, aucun appel authentifie',async()=>{
    const a=await actors();const art=await a.artisan.auto.create();
    const packet=await a.artisan.gate.sign({role:'artisan',accountId:270002,
        demandeId:270002,callId:cid,session:art});
    await assert.rejects(a.client.gate.verify({packet,
        selfRole:'client',selfAccountId:150002,peerRole:'artisan',peerAccountId:270002,
        demandeId:270002,callId:cid,ephemeralPublicKey:art.publicKey}),/non verifie/);
    await assert.rejects(a.client.gate.trustPeer({selfRole:'client',selfAccountId:150002,
        peerRole:'artisan',peerAccountId:270002,
        verifiedFingerprint:a.aIdentity.fingerprint,verifiedOutsideTaskly:false}),/externe/);
});
test('V25: cle publique remplacee, identite falsifiee et rejeu interdits',async()=>{
    const a=await actors();await trustPair(a);
    const original=await a.artisan.auto.create();
    const malicious=await a.client.auto.create();
    const packet=await a.artisan.gate.sign({role:'artisan',accountId:270002,
        demandeId:270002,callId:cid,session:original});
    const check=override=>a.client.gate.verify({packet,
        selfRole:'client',selfAccountId:150002,
        peerRole:'artisan',peerAccountId:270002,
        demandeId:270002,callId:cid,
        ephemeralPublicKey:original.publicKey,...override});
    await assert.rejects(check({ephemeralPublicKey:malicious.publicKey}),/substituee/);
    await assert.rejects(check({callId:'9cfbfccf-3d0b-4428-82f2-a0ca0d9e1e53'}),/incoherent/);
    await assert.rejects(check({demandeId:270003}),/incoherent/);
    const changedIdentity=await a.artisan.identity.generateIdentity('artisan',270002);
    const forged=await a.artisan.identity.signHandshake(changedIdentity,{
        role:'artisan',accountId:270002,demandeId:270002,callId:cid,
        ephemeralPublicKey:original.publicKey});
    await assert.rejects(check({packet:forged}),/modifiee/);
});
test('V25: empreinte epinglee ne peut pas etre remplacee silencieusement',async()=>{
    const a=await actors();await trustPair(a);
    await assert.rejects(a.client.gate.trustPeer({
        selfRole:'client',selfAccountId:150002,peerRole:'artisan',peerAccountId:270002,
        verifiedFingerprint:'a'.repeat(64),verifiedOutsideTaskly:true}),/modifiee/);
});
test('V25: pilote strict coupe par defaut et moteur V19 preserve',()=>{
    const ui=code('client/public/js/taskly-call-ui.js');
    const c=code('server/controllers/chatController.js');
    const service=code('server/services/chatCallService.js');
    assert.equal(require('node:crypto').createHash('sha256')
        .update(code('client/public/js/taskly-call-livekit.js').replace(/\r\n/g,"\n").replace(/\n/g,"\r\n")).digest('hex'),
        '54ac63dfc920644f550ec698957c0e576be3857ed2efb13a09a27d3e5339e081');
    assert.match(c,/TASKLY_E2EE_V25_TEST_DEMANDE_IDS/);
    assert.match(c,/if \(!e2eeRequisPourDemande\(demandeId\)\) return false/);
    assert.match(service,/call\.e2eeIdentityRequired/);
    assert.match(service,/call\.e2eeOfferIdentity/);
    assert.match(service,/call\.e2eeAnswerIdentity/);
    assert.match(service,/call\.e2eeConfirmIdentity/);
    assert.match(ui,/verifyIdentityPacket\(active,/);
    assert.match(ui,/await this\.verifyIdentityPacket\(call,/);
    assert.match(ui,/action:'e2ee-identity-offer'/);
    for (const role of ['client','artisan']) {
        const html=code(`client/private/${role}/messagerie.html`);
        assert.match(html,/taskly-e2ee-identity-v24\.js/);
        assert.match(html,/taskly-e2ee-identity-gate-v25\.js/);
    }
});
test('V25: serveur rejette signature dont role, compte ou contexte ne correspondent pas',async()=>{
    const svc=code('server/services/chatCallService.js');
    const calls=[];
    const redis={eval:async(src,input)=>{
        calls.push(input);
        return JSON.stringify({code:200,message:'ok',call:null});
    }};
    const exports={};
    const sandbox={exports,module:{exports},Buffer,Date,Number,String,JSON,
        process:{env:{TASKLY_LIVEKIT_ENABLED:'true',TASKLY_LIVEKIT_BROWSER_ENABLED:'true'}},
        require(name) {
            if(name==='node:crypto')return {randomUUID:()=>cid};
            if(name==='../config/sessionStore')return {obtenirClientRedis:()=>redis};
            throw Error(name);
        }};
    vm.runInNewContext(svc,sandbox);
    const service=sandbox.module.exports;
    const acces={demandeId:270002,clientId:150002,artisanId:270002,role:'artisan'};
    const x=await actors();
    const session=await x.artisan.auto.create();
    const packet=await x.artisan.gate.sign({role:'artisan',accountId:270002,
        demandeId:270002,callId:cid,session});
    const ok=await service.signaler(acces,'accept',{
        id:cid,transport:'livekit',e2eeRequired:true,
        e2eeIdentityRequired:true,e2eePublicKey:session.publicKey,
        e2eeProof:'A'.repeat(43),e2eeIdentityPacket:packet
    });
    assert.equal(ok.code,200);
    assert.equal(calls.length,1);
    const argv=calls[0].arguments;
    assert.equal(JSON.parse(argv[15]).identityPublicKey,packet.identityPublicKey);
    for (const bad of [
        {...packet,role:'client'},
        {...packet,accountId:123456},
        {...packet,callId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'},
        {...packet,ephemeralPublicKey:'A'.repeat(87)}
    ]) {
        const r=await service.signaler(acces,'accept',{
            id:cid,transport:'livekit',e2eeRequired:true,
            e2eeIdentityRequired:true,e2eePublicKey:session.publicKey,
            e2eeProof:'A'.repeat(43),e2eeIdentityPacket:bad
        });
        assert.equal(r.code,400);
    }
    assert.equal(calls.length,1);
});
test('V25: sans mode strict, une signature injectee est refusee',async()=>{
    const source=code('server/services/chatCallService.js');
    const redis={eval:async()=>JSON.stringify({code:200,call:null})};
    const sandbox={module:{exports:{}},Buffer,Date,Number,String,JSON,
        process:{env:{TASKLY_LIVEKIT_ENABLED:'true',TASKLY_LIVEKIT_BROWSER_ENABLED:'true'}},
        require:n=>n==='node:crypto'?{randomUUID:()=>cid}
            :n==='../config/sessionStore'?{obtenirClientRedis:()=>redis}:null};
    vm.runInNewContext(source,sandbox);
    const api=sandbox.module.exports;
    const r=await api.signaler({demandeId:270002,clientId:150002,artisanId:270002,
       role:'client'},'start',{mode:'audio',transport:'livekit',
       e2eeRequired:true,e2eePublicKey: 'BA' + 'A'.repeat(85),e2eeIdentityPacket:{}});
    assert.equal(r.code,409);
});
