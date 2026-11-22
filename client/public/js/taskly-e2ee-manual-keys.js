'use strict';

(function (global) {
    let secret = null;

    function clear() {
        if (secret) secret.fill(0);
        secret = null;
    }

    function fromHex(value) {
        if (typeof value !== 'string' ||
            !/^[0-9a-fA-F]{64}$/.test(value)) {
            throw new Error('Cle E2EE invalide : 64 caracteres hexadecimaux requis.');
        }

        const result = new Uint8Array(32);

        for (let i = 0; i < 32; i++) {
            result[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
        }

        return result;
    }

    function generate() {
        if (!global.crypto?.getRandomValues) {
            throw new Error('Generateur securise indisponible.');
        }

        const bytes = new Uint8Array(32);
        global.crypto.getRandomValues(bytes);

        clear();
        secret = bytes;

        return Array.from(bytes, b =>
            b.toString(16).padStart(2, '0')
        ).join('');
    }

    function importHex(hex) {
        const bytes = fromHex(hex);
        clear();
        secret = bytes;
    }

    function requireKey() {
        if (!secret) {
            throw new Error('Cle E2EE requise avant l appel.');
        }

        return secret.slice().buffer;
    }

    global.TasklyE2EEManualKeys = Object.freeze({
        generate,
        importHex,
        requireKey,
        clear,
        ready: () => secret !== null
    });

})(window);