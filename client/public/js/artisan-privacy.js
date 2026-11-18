/* Gestion de la confidentialite du profil artisan */

(() => {

    'use strict';

    window.initialiserConfidentialiteArtisan = function(panel, button) {

        if (!panel || !button || panel.dataset.privacyReady) return;

        const phone = panel.querySelector('#privacy-show-phone');
        const status = panel.querySelector('#privacy-phone-status');
        const save = panel.querySelector('#privacy-save-button');
        const message = panel.querySelector('#privacy-message');

        if (!phone || !status || !save || !message) return;

        panel.dataset.privacyReady = '1';

        let preferences = null;
        let busy = false;

        // Affichage des messages

        function afficherMessage(texte, type = '') {

            message.textContent = texte;

            message.classList.remove('is-success', 'is-error');

            if (type) {
                message.classList.add('is-' + type);
            }

        }

        // Activation ou desactivation des commandes

        function actualiserCommandes() {

            const disponible = !busy && preferences !== null;

            phone.disabled = !disponible;

            save.disabled = !disponible ||
                Number(phone.checked) === preferences?.afficher_telephone;

        }

        // Affichage de la visibilite

        function actualiserStatut() {

            const modifie = preferences !== null &&
                Number(phone.checked) !== preferences.afficher_telephone;

            status.textContent = phone.checked
                ? 'Téléphone visible aux clients vérifiés.'
                : 'Téléphone masqué.';

            if (modifie) {
                status.textContent += ' Modification non enregistrée.';
            }

            status.classList.toggle('is-visible', phone.checked);

            actualiserCommandes();

        }

        // Recuperation des preferences

        async function chargerPreferences() {

            if (busy) return;

            busy = true;
            preferences = null;

            phone.checked = false;

            status.textContent = 'Chargement des préférences...';
            status.classList.remove('is-visible');

            afficherMessage('');
            actualiserCommandes();

            try {

                const data = await requeteAPI(
                    '/api/account/confidentialite',
                    { cache: 'no-store' }
                );

                const c = data.confidentialite;

                if (
                    !c ||
                    !Number.isSafeInteger(Number(c.artisan_id)) ||
                    Number(c.artisan_id) <= 0 ||
                    ![0, 1, '0', '1'].includes(c.afficher_telephone) ||
                    ![0, 1, '0', '1'].includes(c.afficher_email) ||
                    (c.email_professionnel !== null &&
                     typeof c.email_professionnel !== 'string')
                ) {
                    throw new Error('Préférences indisponibles.');
                }

                preferences = {
                    artisan_id: Number(c.artisan_id),
                    afficher_telephone: Number(c.afficher_telephone),
                    afficher_email: Number(c.afficher_email),
                    email_professionnel: c.email_professionnel || ''
                };

                phone.checked =
                    preferences.afficher_telephone === 1;

                actualiserStatut();

            } catch (error) {

                status.textContent = 'Préférences indisponibles.';

                afficherMessage(
                    'Impossible de charger vos préférences. Fermez puis rouvrez cette fenêtre.',
                    'error'
                );

            } finally {

                busy = false;
                actualiserCommandes();

            }

        }

        // Enregistrement des preferences

        async function enregistrerPreferences() {

            if (busy || !preferences || save.disabled) return;

            busy = true;

            const nouvelleVisibilite = Number(phone.checked);

            actualiserCommandes();

            save.textContent = 'Enregistrement...';

            afficherMessage('');

            try {

                const data = await requeteAPI(
                    '/api/account/confidentialite',
                    {
                        method: 'PUT',

                        body: JSON.stringify({

                            artisan_id: preferences.artisan_id,

                            afficher_telephone: nouvelleVisibilite,

                            afficher_email: preferences.afficher_email,

                            email_professionnel:
                                preferences.email_professionnel

                        })
                    }
                );

                preferences.afficher_telephone = nouvelleVisibilite;

                actualiserStatut();

                afficherMessage(
                    data.message || 'Préférences enregistrées.',
                    'success'
                );

                if (typeof afficherToast === 'function') {

                    afficherToast(
                        'Préférences de confidentialité enregistrées.',
                        'success'
                    );

                }

            } catch (error) {

                preferences = null;

                status.textContent = 'État de la visibilité à vérifier.';
                status.classList.remove('is-visible');

                afficherMessage(
                    (error.message || 'Enregistrement impossible.') +
                    ' Fermez puis rouvrez cette fenêtre pour vérifier vos préférences.',
                    'error'
                );

            } finally {

                busy = false;

                save.textContent = 'Enregistrer mes préférences';

                actualiserCommandes();

            }

        }

        // Evenements de l'interface

        button.addEventListener('click', chargerPreferences);

        phone.addEventListener('change', () => {

            afficherMessage('');
            actualiserStatut();

        });

        save.addEventListener('click', enregistrerPreferences);

        actualiserCommandes();

    };

})();
