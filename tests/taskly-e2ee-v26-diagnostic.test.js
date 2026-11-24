'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto,createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const code=read('client/public/js/taskly-e2ee-identity-gate-v25.js');

function environment({slowCommit=false}={}) {
    const data=new Map();
    let writes=0;
    const indexedDB={open(){
        const db={
            close(){},
            createObjectStore(){},
            transaction(name,mode){
                const tx={oncomplete:null,onerror:null,onabort:null};
                const keyPrefix=name+':';
                tx.objectStore=()=>({
                    get(key){
                        const req={};
                        queueMicrotask(()=>{req.result=data.get(keyPrefix+key);req.onsuccess?.()});
                        return req;
                    },
                    put(value,key){
                        const req={result:key};
                        queueMicrotask(()=>{
                            // Pretend IndexedDB accepted the request, but has NOT committed.
                            req.onsuccess?.();
                            const commit=()=>{
                                data.set(keyPrefix+key,value);
                                writes++;
                                tx.oncomplete?.();
                            };
                            if(slowCommit) setTimeout(commit,30);
                            else queueMicrotask(commit);
                        });
                        return req;
                    }
                });
                return tx;
            }
        };
        const req={result:db};
        queueMicrotask(()=>{req.onupgradeneeded?.();queueMicrotask(()=>req.onsuccess?.())});
        return req;
    }};
    const fakeV24={
        loadOrCreateIdentity:async()=>({identityPublicKey:'public'}),
        verifyHandshake:async()=>true,
        fingerprint:async()=> 'a'.repeat(64),
        shortVerificationCode:async()=> 'CODE-TEST',
        signHandshake:async()=>({})
    };
    const win={crypto:webcrypto,indexedDB,TasklyE2EEIdentityV24:fakeV24};
    vm.runInNewContext(code,{window:win,Number,Error,RegExp,String,Promise,JSON,Object,Uint8Array});
    return {gate:win.TasklyE2EEIdentityGateV25,getWrites:()=>writes};
}
const peer={selfRole:'artisan',selfAccountId:270002,peerRole:'client',peerAccountId:150002};
const pin='b'.repeat(64);

test('V26: inspection de confiance est en lecture seule, ne cree aucun pair',async()=>{
    const x=environment();
    const status=await x.gate.inspectTrust(peer);
    assert.equal(status.role,'artisan');
    assert.equal(status.accountId,270002);
    assert.equal(status.identityCode,'CODE-TEST');
    assert.equal(status.ownFingerprint,'a'.repeat(64));
    assert.equal(status.peerTrusted,false);
    assert.equal(status.trustedPeerFingerprint,null);
    assert.equal(x.getWrites(),0);
});

test('V26: confiance effectivement durable apres commit et inspection',async()=>{
    const x=environment();
    await x.gate.trustPeer({...peer,verifiedFingerprint:pin,verifiedOutsideTaskly:true});
    const status=await x.gate.inspectTrust(peer);
    assert.equal(status.peerTrusted,true);
    assert.equal(status.trustedPeerFingerprint,pin);
    assert.equal(x.getWrites(),1);
    await assert.rejects(x.gate.trustPeer({...peer,verifiedFingerprint:'c'.repeat(64),verifiedOutsideTaskly:true}),/modifiee/);
    assert.equal(x.getWrites(),1);
});

test('V26: succes du put ne suffit pas; attendre le commit IndexedDB',async()=>{
    const x=environment({slowCommit:true});
    let completed=false;
    const action=x.gate.trustPeer({...peer,verifiedFingerprint:pin,verifiedOutsideTaskly:true})
        .then(()=>{completed=true});
    await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(completed,false,'trustPeer returned before the transaction committed');
    assert.equal(x.getWrites(),0);
    await action;
    assert.equal(completed,true);
    assert.equal(x.getWrites(),1);
});

test('V26: pilote strict conserve la verification cryptographique et le moteur V19',()=>{
    const src=read('client/public/js/taskly-call-ui.js');
    assert.match(src,/await window\.TasklyE2EEIdentityGateV25\.verify\(/);
    assert.match(src,/await window\.TasklyE2EEIdentityGateV25\.trustedFingerprint\(/);
    assert.match(src,/console\.warn\('\[Taskly E2EE V25\] Appel entrant refuse :',reason\)/);
    const sha=createHash('sha256').update(read('client/public/js/taskly-call-livekit.js').replace(/\r\n/g,"\n").replace(/\n/g,"\r\n")).digest('hex');
    assert.equal(sha,'54ac63dfc920644f550ec698957c0e576be3857ed2efb13a09a27d3e5339e081');
});
