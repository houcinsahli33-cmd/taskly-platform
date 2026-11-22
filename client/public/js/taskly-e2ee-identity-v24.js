'use strict';
/*
 * Taskly V24 identity prototype (not loaded by Taskly production pages).
 * The authenticated peer fingerprint MUST be obtained over an independent,
 * trusted channel. Merely receiving a key from Taskly's signaling server is
 * NOT proof of the other party's identity.
 */
(function (global) {
    const crypto = global.crypto;
    if (!crypto?.subtle) return;
    const subtle = crypto.subtle;
    const encoder = new TextEncoder();
    const PREFIX = 'Taskly-E2EE-Identity-V24';
    const DATABASE = 'taskly-e2ee-identity-v24';

    function encode(bytes) {
        let s = '';
        for (const b of bytes) s += String.fromCharCode(b);
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function decode(value, expectedLength) {
        if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
            throw new Error('Cle ou signature invalide.');
        }
        const s = value.replace(/-/g, '+').replace(/_/g, '/');
        const bytes = Uint8Array.from(atob(s + '='.repeat((4 - s.length % 4) % 4)),
            c => c.charCodeAt(0));
        if (bytes.length !== expectedLength || encode(bytes) !== value) {
            throw new Error('Format cryptographique invalide.');
        }
        return bytes;
    }
    function validScope(role, accountId) {
        if (!['client', 'artisan'].includes(role) ||
            !Number.isSafeInteger(accountId) || accountId < 1 || accountId > 2147483647) {
            throw new Error('Identite Taskly invalide.');
        }
        return role + ':' + accountId;
    }
    function validContext(data) {
        if (!data || typeof data !== 'object' ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.callId || '') ||
            !Number.isSafeInteger(data.demandeId) || data.demandeId < 1) {
            throw new Error('Contexte appel invalide.');
        }
        validScope(data.role, data.accountId);
        decode(data.ephemeralPublicKey, 65);
        return data;
    }
    function transcript(data) {
        validContext(data);
        return encoder.encode(JSON.stringify([
            PREFIX, data.role, data.accountId, data.demandeId,
            data.callId, data.ephemeralPublicKey
        ]));
    }
    async function generateIdentity(role, accountId) {
        const scope = validScope(role, accountId);
        const pair = await subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
        if (pair.privateKey.extractable) throw new Error('Cle privee non protegee.');
        const raw = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
        if (raw.length !== 65 || raw[0] !== 4) throw new Error('Cle identite invalide.');
        return Object.freeze({ scope, privateKey: pair.privateKey,
            identityPublicKey: encode(raw) });
    }
    async function fingerprint(identityPublicKey) {
        const raw = decode(identityPublicKey, 65);
        if (raw[0] !== 4) throw new Error('Cle publique identite invalide.');
        const digest = new Uint8Array(await subtle.digest('SHA-256', raw));
        return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
    }
    async function shortVerificationCode(identityPublicKey) {
        const digest = await subtle.digest('SHA-256',
            encoder.encode(PREFIX + ':verify:' + await fingerprint(identityPublicKey)));
        const chars = Array.from(new Uint8Array(digest).slice(0, 6),
            b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        return chars.replace(/.{4}(?=.)/g, '$&-');
    }
    async function signHandshake(identity, data) {
        if (!identity?.privateKey ||
            identity.scope !== validScope(data.role, data.accountId)) {
            throw new Error('Mauvaise identite pour cette conversation.');
        }
        const msg = transcript(data);
        const rawSig = new Uint8Array(await subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' }, identity.privateKey, msg));
        return Object.freeze({ ...data, identityPublicKey: identity.identityPublicKey,
            signature: encode(rawSig) });
    }
    async function verifyHandshake(packet, expected, trustedIdentityFingerprint) {
        if (typeof trustedIdentityFingerprint !== 'string' ||
            !/^[a-f0-9]{64}$/.test(trustedIdentityFingerprint)) {
            throw new Error('Identite non verifiee : empreinte de confiance requise.');
        }
        const msg = transcript(packet);
        if (!expected || packet.role !== expected.role ||
            packet.accountId !== expected.accountId ||
            packet.demandeId !== expected.demandeId ||
            packet.callId !== expected.callId) {
            throw new Error('Identite ou contexte appel incoherent.');
        }
        const actualFingerprint = await fingerprint(packet.identityPublicKey);
        if (actualFingerprint !== trustedIdentityFingerprint) {
            throw new Error('Identite distante modifiee : appel refuse.');
        }
        const publicKey = await subtle.importKey('raw',
            decode(packet.identityPublicKey, 65),
            { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
        const valid = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' },
            publicKey, decode(packet.signature, 64), msg);
        if (!valid) throw new Error('Signature de session invalide : appel refuse.');
        return true;
    }
    // Optional persistent identity storage. The private CryptoKey stays
    // non-extractable. No insecure localStorage fallback is permitted.
    function openStore() {
        return new Promise((resolve, reject) => {
            if (!global.indexedDB) return reject(new Error('Stockage securise indisponible.'));
            const request = global.indexedDB.open(DATABASE, 1);
            request.onupgradeneeded = () => request.result.createObjectStore('identities');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Stockage indisponible.'));
        });
    }
    async function loadOrCreateIdentity(role, accountId) {
        const scope = validScope(role, accountId);
        const db = await openStore();
        try {
            const record = await new Promise((resolve, reject) => {
                const req = db.transaction('identities', 'readonly')
                    .objectStore('identities').get(scope);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            if (record) {
                if (record.scope !== scope || !record.privateKey || !record.identityPublicKey)
                    throw new Error('Identite locale invalide.');
                return record;
            }
            const identity = await generateIdentity(role, accountId);
            await new Promise((resolve, reject) => {
                const tx = db.transaction('identities', 'readwrite');
                tx.objectStore('identities').add(identity, scope);
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error || new Error('Sauvegarde annulee.'));
            });
            return identity;
        } finally { db.close(); }
    }
    global.TasklyE2EEIdentityV24 = Object.freeze({
        generateIdentity, loadOrCreateIdentity, signHandshake,
        verifyHandshake, fingerprint, shortVerificationCode
    });
})(window);
