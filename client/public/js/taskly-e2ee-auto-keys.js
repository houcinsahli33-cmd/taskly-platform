'use strict';
// ECDH ephemeral par appel, aucun secret dans le serveur ni les URL.
// Les cles publiques transmises par le serveur sont liees aux comptes connectes,
// mais leur identite n'est pas independamment authentifiee (MITM serveur possible).
(function (global) {
    const crypto = global.crypto;
    if (!crypto?.subtle) return;
    const subtle = crypto.subtle;

    function b64url(bytes) {
        const data = Array.from(bytes, x => String.fromCharCode(x)).join('');
        return btoa(data).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    }
    function decode(value) {
        if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
            throw new Error('Cle publique E2EE invalide.');
        }
        const base = value.replace(/-/g,'+').replace(/_/g,'/');
        const padded = base + '='.repeat((4-base.length%4)%4);
        return Uint8Array.from(atob(padded), c=>c.charCodeAt(0));
    }
    function context(callId, demandeId) {
        if (typeof callId !== 'string' || !/^[a-z0-9-]{36}$/i.test(callId) ||
            !Number.isSafeInteger(Number(demandeId)) || Number(demandeId)<=0) {
            throw new Error('Contexte E2EE invalide.');
        }
        return new TextEncoder().encode('taskly-e2ee-v22:' + demandeId + ':' + callId);
    }
    async function create() {
        const pair = await subtle.generateKey(
            {name:'ECDH',namedCurve:'P-256'},false,['deriveBits']
        );
        const pub = new Uint8Array(await subtle.exportKey('raw',pair.publicKey));
        if (pub.length!==65 || pub[0]!==4) throw new Error('Cle ECDH incompatible.');
        return {privateKey:pair.privateKey,publicKey:b64url(pub)};
    }
    async function derive(session,remotePublic,callId,demandeId) {
        if (!session?.privateKey) throw new Error('Session E2EE absente.');
        const raw = decode(remotePublic);
        if (raw.length!==65 || raw[0]!==4) throw new Error('Cle ECDH invalide.');
        const remote=await subtle.importKey(
            'raw',raw,{name:'ECDH',namedCurve:'P-256'},false,[]
        );
        const bits=await subtle.deriveBits({name:'ECDH',public:remote},session.privateKey,256);
        const salt=context(callId,demandeId);
        const base=await subtle.importKey('raw',bits,'HKDF',false,['deriveBits']);
        const key=await subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,
            info:new TextEncoder().encode('Taskly LiveKit E2EE media key v22')},base,256);
        new Uint8Array(bits).fill(0);
        return key;
    }
    async function proof(key,callId,role) {
        if (!(key instanceof ArrayBuffer) || key.byteLength!==32 ||
            !['accept','caller'].includes(role)) throw new Error('Preuve E2EE impossible.');
        const hmac=await subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
        const input=new TextEncoder().encode('taskly-key-confirm-v22:'+callId+':'+role);
        return b64url(new Uint8Array(await subtle.sign('HMAC',hmac,input)));
    }
    async function verify(key,callId,role,candidate) {
        try {
            const expected=decode(await proof(key,callId,role));
            const provided=decode(candidate);
            if (expected.length!==provided.length) return false;
            let diff=0;
            for(let i=0;i<expected.length;i++)diff |= expected[i]^provided[i];
            return diff===0;
        } catch { return false; }
    }
    global.TasklyE2EEAutoKeys=Object.freeze({create,derive,proof,verify});
})(window);
