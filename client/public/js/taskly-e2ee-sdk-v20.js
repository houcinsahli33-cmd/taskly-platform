'use strict';

// Le bundle UMD V20 n'est charge QUE pour une demande de test E2EE.
// Le SDK V19 reste le SDK public des appels ordinaires.
(function (global) {
    let sdk = null;
    let loading = null;

    function get() { return sdk; }

    function load() {
        if (sdk) return Promise.resolve(sdk);
        if (loading) return loading;

        const standard = global.LivekitClient;
        if (!standard?.Room) {
            return Promise.reject(new Error('SDK LiveKit V19 indisponible.'));
        }
        if (typeof document === 'undefined' || !document.head) {
            return Promise.reject(new Error('Chargement du SDK E2EE impossible.'));
        }

        loading = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/js/vendor/livekit-client-e2ee-pilot.umd.js?v=20';
            script.async = true;

            function restore() { global.LivekitClient = standard; }

            script.onload = () => {
                const experimental = global.LivekitClient;
                restore();

                if (experimental === standard ||
                    !experimental?.Room ||
                    !experimental?.ExternalE2EEKeyProvider ||
                    typeof experimental.isE2EESupported !== 'function' ||
                    !experimental.isE2EESupported()) {
                    reject(new Error('SDK V20 E2EE incompatible avec ce navigateur.'));
                    return;
                }
                sdk = experimental;
                resolve(sdk);
            };

            script.onerror = () => {
                restore();
                script.remove();
                reject(new Error('Chargement du SDK E2EE V20 impossible.'));
            };

            document.head.appendChild(script);
        }).finally(() => { loading = null; });

        return loading;
    }

    global.TasklyE2EESdk = Object.freeze({ load, get });
})(window);
