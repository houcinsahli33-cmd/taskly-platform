'use strict';
/*
 * V25 Taskly: independent peer-identity verification for E2EE negotiations.
 * OFF unless TASKLY_E2EE_V25_TEST_DEMANDE_IDS is configured on the server.
 * Fingerprints must be checked OUTSIDE Taskly (in person / trusted channel).
 * Neither the Taskly server nor LiveKit is an identity trust anchor.
 * Distinct browser profiles/devices may have distinct identity keys.
 */
(function (global) {
    if (!global.crypto?.subtle) return;
    const DB = 'taskly-e2ee-identity-trust-v25';
    const STORE = 'pins';
    const expected = () => {
        const api = global.TasklyE2EEIdentityV24;
        if (!api?.loadOrCreateIdentity || !api?.verifyHandshake) {
            throw new Error('Identite V24 indisponible.');
        }
        return api;
    };
    function scope(role, accountId) {
        if (!['client','artisan'].includes(role) ||
            !Number.isSafeInteger(accountId) || accountId < 1 || accountId > 2147483647)
            throw new Error('Identifiant Taskly invalide.');
        return `${role}:${accountId}`;
    }
    function fingerprint(value) {
        if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
            throw new Error('Empreinte invalide (64 caracteres hexadecimaux requis).');
        }
        return value;
    }
    function openDb() {
        if (!global.indexedDB) throw new Error('Stockage des empreintes indisponible.');
        return new Promise((resolve,reject) => {
            const req=global.indexedDB.open(DB,1);
            req.onupgradeneeded=() => req.result.createObjectStore(STORE);
            req.onsuccess=()=>resolve(req.result);
            req.onerror=()=>reject(req.error || new Error('Stockage indisponible.'));
        });
    }
    async function transact(mode,key,value) {
        const db=await openDb();
        try {
            return await new Promise((resolve,reject)=>{
                const tx=db.transaction(STORE,mode);
                const store=tx.objectStore(STORE);
                const req=mode==='readonly'?store.get(key):store.put(value,key);
                req.onsuccess=()=>resolve(req.result);
                req.onerror=()=>reject(req.error || new Error('Empreinte indisponible.'));
                tx.onerror=()=>reject(tx.error || new Error('Stockage interrompu.'));
                tx.onabort=()=>reject(tx.error || new Error('Stockage annule.'));
            });
        } finally {db.close();}
    }
    const pinKey=(selfRole,selfId,peerRole,peerId)=>
        scope(selfRole,selfId)+'|'+scope(peerRole,peerId);
    async function getOwnIdentity(role,accountId) {
        const id=await expected().loadOrCreateIdentity(role,accountId);
        return Object.freeze({role,accountId,identityPublicKey:id.identityPublicKey,
            fingerprint:await expected().fingerprint(id.identityPublicKey),
            verificationCode:await expected().shortVerificationCode(id.identityPublicKey)});
    }
    async function trustPeer({selfRole,selfAccountId,peerRole,peerAccountId,
                              verifiedFingerprint,verifiedOutsideTaskly}) {
        if (verifiedOutsideTaskly !== true) {
            throw new Error('Verification externe obligatoire. Ne faites pas confiance au serveur Taskly seul.');
        }
        const fp=fingerprint(verifiedFingerprint);
        const key=pinKey(selfRole,selfAccountId,peerRole,peerAccountId);
        const previous=await transact('readonly',key);
        if (previous && previous !== fp) {
            throw new Error('Identite du pair modifiee : verification humaine requise.');
        }
        if (!previous) await transact('readwrite',key,fp);
        return true;
    }
    async function trustedFingerprint({selfRole,selfAccountId,peerRole,peerAccountId}) {
        const key=pinKey(selfRole,selfAccountId,peerRole,peerAccountId);
        const result=await transact('readonly',key);
        if (!result) throw new Error('Interlocuteur non verifie. Verifiez son empreinte hors de Taskly.');
        return fingerprint(result);
    }
    async function sign({role,accountId,demandeId,callId,session}) {
        if (!session || typeof session.publicKey !== 'string') {
            throw new Error('Session E2EE manquante.');
        }
        const identity=await expected().loadOrCreateIdentity(role,accountId);
        return expected().signHandshake(identity,{
            role,accountId,demandeId,callId,
            ephemeralPublicKey:session.publicKey
        });
    }
    async function verify({packet,selfRole,selfAccountId,peerRole,
                           peerAccountId,demandeId,callId,ephemeralPublicKey}) {
        const fp=await trustedFingerprint({selfRole,selfAccountId,peerRole,peerAccountId});
        if (!packet || packet.ephemeralPublicKey !== ephemeralPublicKey) {
            throw new Error('Cle E2EE substituee : appel refuse.');
        }
        return expected().verifyHandshake(packet,{
            role:peerRole,accountId:peerAccountId,demandeId,callId,
            ephemeralPublicKey
        },fp);
    }
    global.TasklyE2EEIdentityGateV25=Object.freeze({
        getOwnIdentity,trustPeer,trustedFingerprint,sign,verify
    });
})(window);
