'use strict';

document.addEventListener('DOMContentLoaded', () => {

    const API = '/api/password-reset';

    const CODE_DURATION = 180;
    const RESEND_DELAY = 60;

    const $ = id => document.getElementById(id);

    const emailForm = $('reset-email-form');
    const codeForm = $('reset-code-form');
    const passwordForm = $('reset-password-form');

    const emailInput = $('reset-email');
    const passwordInput = $('reset-password');
    const confirmInput = $('reset-confirm-password');

    const alertBox = $('reset-alert');
    const timerDisplay = $('reset-timer');
    const resendButton = $('reset-resend');

    const codeInputs = Array.from(
        document.querySelectorAll('.verification-code input')
    );

    const progressSteps = document.querySelectorAll('.progress-step');
    const strengthBars = document.querySelectorAll('.password-strength span');

    let email = '';
    let resetToken = null;
    let csrfToken = null;
    let timer = null;
    let expiresAt = 0;
    let resendAt = 0;
    let busy = false;

    let currentStep = 1;

    // =========================================
    // MESSAGES
    // =========================================

    function showMessage(message, type = '') {
        alertBox.textContent = message;
        alertBox.className = 'recovery-alert';

        if (type) {
            alertBox.classList.add(type);
        }

        alertBox.hidden = false;
    }

    function hideMessage() {
        alertBox.hidden = true;
        alertBox.textContent = '';
    }

    // =========================================
    // PROTECTION CSRF
    // =========================================

    async function getCsrfToken(force = false) {

        if (csrfToken && !force) {
            return csrfToken;
        }

        const response = await fetch('/api/auth/csrf', {
            credentials: 'same-origin',
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(
                'Impossible de sécuriser la connexion.'
            );
        }

        const data = await response.json();

        if (!data.csrfToken) {
            throw new Error('Jeton de sécurité indisponible.');
        }

        csrfToken = data.csrfToken;

        return csrfToken;
    }

    // =========================================
    // COMMUNICATION AVEC LE SERVEUR
    // =========================================

    async function apiRequest(path, body, retry = true) {

        const token = await getCsrfToken();

        const response = await fetch(API + path, {
            method: 'POST',
            credentials: 'same-origin',
            cache: 'no-store',

            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': token
            },

            body: JSON.stringify(body)
        });

        const data = await response.json().catch(() => ({}));

        if (
            response.status === 403 &&
            retry &&
            data.message?.includes('Jeton de securite')
        ) {
            await getCsrfToken(true);
            return apiRequest(path, body, false);
        }

        if (response.status === 404) {
            throw new Error(
                'La récupération du compte est actuellement indisponible.'
            );
        }

        if (!response.ok) {

            const error = new Error(
                data.message || 'Une erreur est survenue.'
            );

            error.status = response.status;

            throw error;
        }

        return data;
    }

    // =========================================
    // NAVIGATION ENTRE LES INTERFACES
    // =========================================

    function showStep(step) {

        currentStep = step;

        const sections = [
            'reset-step-email',
            'reset-step-code',
            'reset-step-password',
            'reset-step-success'
        ];

        sections.forEach((id, index) => {
            $(id).hidden = index !== step - 1;
        });

        progressSteps.forEach((element, index) => {

            element.classList.toggle(
                'active',
                index + 1 === step
            );

            element.classList.toggle(
                'completed',
                index + 1 < step
            );
        });

        $('reset-back').hidden = step === 4;

        hideMessage();

        syncButtons();

        if (step === 2) {
            codeInputs[0].focus();
        }

        if (step === 3) {
            passwordInput.focus();
        }
    }

    // =========================================
    // VALIDATION DU MOT DE PASSE
    // =========================================

    function passwordRules() {

        const value = passwordInput.value;

        return [
            value.length >= 8,
            /[A-Z]/.test(value) && /[a-z]/.test(value),
            /\d/.test(value),
            /[^A-Za-z0-9]/.test(value)
        ];
    }

    function passwordIsValid() {

        return (
            passwordRules().every(Boolean) &&
            new TextEncoder().encode(passwordInput.value).length <= 72 &&
            passwordInput.value === confirmInput.value
        );
    }

    function updatePasswordStrength() {

        const rules = passwordRules();

        const ids = [
            'rule-length',
            'rule-case',
            'rule-number',
            'rule-special'
        ];

        rules.forEach((valid, index) => {
            $(ids[index]).classList.toggle('valid', valid);
        });

        const score = rules.filter(Boolean).length;

        strengthBars.forEach((bar, index) => {

            bar.classList.remove(
                'active', 'weak', 'medium', 'strong'
            );

            if (index < score) {

                bar.classList.add(
                    score <= 1 ? 'weak' :
                    score <= 3 ? 'medium' : 'strong'
                );
            }
        });

        syncButtons();
    }

    // =========================================
    // ACTIVATION DES BOUTONS
    // =========================================

    function syncButtons() {

        emailForm.querySelector('[type="submit"]').disabled =
            busy || !emailInput.validity.valid;

        codeForm.querySelector('[type="submit"]').disabled =
            busy ||
            Date.now() >= expiresAt ||
            !/^\d{6}$/.test(getCode());

        passwordForm.querySelector('[type="submit"]').disabled =
            busy || !resetToken || !passwordIsValid();

        resendButton.disabled =
            busy || Date.now() < resendAt;
    }

    function getCode() {
        return codeInputs.map(input => input.value).join('');
    }

    function clearCode() {
        codeInputs.forEach(input => {
            input.value = '';
        });

        syncButtons();
    }

    // =========================================
    // COMPTEUR DE 3 MINUTES
    // =========================================

    function startTimer(startedAt = Date.now()) {

        clearInterval(timer);

        expiresAt = startedAt + CODE_DURATION * 1000;
        resendAt = startedAt + RESEND_DELAY * 1000;

        function updateTimer() {

            const remaining = Math.max(
                0,
                Math.ceil((expiresAt - Date.now()) / 1000)
            );

            const minutes = String(
                Math.floor(remaining / 60)
            ).padStart(2, '0');

            const seconds = String(
                remaining % 60
            ).padStart(2, '0');

            timerDisplay.textContent = `${minutes}:${seconds}`;

            timerDisplay.classList.toggle(
                'expired',
                remaining === 0
            );

            const resendRemaining = Math.max(
                0,
                Math.ceil((resendAt - Date.now()) / 1000)
            );

            resendButton.textContent = resendRemaining > 0
                ? `Renvoyer le code (${resendRemaining}s)`
                : 'Renvoyer le code';

            if (remaining === 0) {

                clearInterval(timer);

                if (currentStep === 2 && !busy) {
                    showMessage(
                        'Le délai de vérification est terminé. Demandez un nouveau code.',
                        'error'
                    );
                }
            }

            syncButtons();
        }

        updateTimer();

        timer = setInterval(updateTimer, 1000);
    }

    // =========================================
    // ETAPE 1 : ENVOYER LE CODE
    // =========================================

    emailInput.addEventListener('input', syncButtons);

    emailForm.addEventListener('submit', async event => {

        event.preventDefault();

        if (busy || !emailInput.validity.valid) return;

        email = emailInput.value.trim().toLowerCase();

        busy = true;

        hideMessage();
        syncButtons();

        const startedAt = Date.now();

        try {

            const data = await apiRequest('/request', { email });

            $('reset-email-display').textContent = email;

            clearCode();

            showStep(2);
            startTimer(startedAt);

            showMessage(
                data.message ||
                'Si cette adresse correspond à un compte Taskly, un code vous sera envoyé.'
            );

        } catch (error) {

            showMessage(error.message, 'error');

        } finally {

            busy = false;
            syncButtons();
        }
    });

    // =========================================
    // SAISIE AUTOMATIQUE DES 6 CHIFFRES
    // =========================================

    codeInputs.forEach((input, index) => {

        input.addEventListener('input', () => {

            input.value = input.value
                .replace(/\D/g, '')
                .slice(0, 1);

            if (input.value && index < codeInputs.length - 1) {
                codeInputs[index + 1].focus();
            }

            syncButtons();
        });

        input.addEventListener('keydown', event => {

            if (
                event.key === 'Backspace' &&
                !input.value &&
                index > 0
            ) {
                codeInputs[index - 1].focus();
            }

            if (event.key === 'ArrowLeft' && index > 0) {
                codeInputs[index - 1].focus();
            }

            if (
                event.key === 'ArrowRight' &&
                index < codeInputs.length - 1
            ) {
                codeInputs[index + 1].focus();
            }
        });

        input.addEventListener('paste', event => {

            event.preventDefault();

            const digits = event.clipboardData
                .getData('text')
                .replace(/\D/g, '')
                .slice(0, 6);

            if (!digits) return;

            const start = digits.length === 6 ? 0 : index;

            digits.split('').forEach((digit, offset) => {

                if (codeInputs[start + offset]) {
                    codeInputs[start + offset].value = digit;
                }
            });

            codeInputs[
                Math.min(start + digits.length, 5)
            ].focus();

            syncButtons();
        });
    });

    // =========================================
    // ETAPE 2 : VERIFIER LE CODE
    // =========================================

    codeForm.addEventListener('submit', async event => {

        event.preventDefault();

        const code = getCode();

        if (
            busy ||
            !/^\d{6}$/.test(code) ||
            Date.now() >= expiresAt
        ) return;

        busy = true;

        hideMessage();
        syncButtons();

        try {

            const result = await apiRequest('/verify', {
                email,
                code
            });

            if (!result.resetToken) {
                throw new Error('Code de vérification invalide.');
            }

            resetToken = result.resetToken;

            clearInterval(timer);
            clearCode();

            showStep(3);

        } catch (error) {

            showMessage(error.message, 'error');

            clearCode();

            codeInputs[0].focus();

        } finally {

            busy = false;
            syncButtons();
        }
    });

    // =========================================
    // RENVOYER LE CODE
    // =========================================

    resendButton.addEventListener('click', async () => {

        if (busy || Date.now() < resendAt) return;

        busy = true;
        hideMessage();
        syncButtons();

        const startedAt = Date.now();

        try {

            const result = await apiRequest('/request', { email });

            clearCode();

            startTimer(startedAt);

            showMessage(
                result.message ||
                'Si cette adresse correspond à un compte, un code vous sera envoyé.'
            );

            codeInputs[0].focus();

        } catch (error) {

            showMessage(error.message, 'error');

        } finally {

            busy = false;
            syncButtons();
        }
    });

    // =========================================
    // ICONES OEIL
    // =========================================

    document.querySelectorAll('.password-eye')
        .forEach(button => {

            const originalIcon = button.innerHTML;

            button.addEventListener('click', () => {

                const field = $(button.dataset.toggle);

                if (!field) return;

                const visible = field.type === 'password';

                field.type = visible ? 'text' : 'password';

                button.setAttribute(
                    'aria-pressed',
                    String(visible)
                );

                button.setAttribute(
                    'aria-label',
                    visible
                        ? 'Masquer le mot de passe'
                        : 'Afficher le mot de passe'
                );

                button.innerHTML = visible
                    ? `<svg viewBox="0 0 24 24"
                        fill="none" stroke="currentColor"
                        stroke-width="1.8" aria-hidden="true">
                        <path d="M3 3l18 18"/>
                        <path d="M10 10a3 3 0 0 0 4 4"/>
                        <path d="M9 5c1-.3 2-.5 3-.5
                        6 0 10 7.5 10 7.5
                        a20 20 0 0 1-3 4"/>
                        <path d="M6 6C3 8 2 12 2 12
                        s4 7 10 7c2 0 3-.5 5-1.5"/>
                       </svg>`
                    : originalIcon;
            });
        });

    passwordInput.addEventListener(
        'input',
        updatePasswordStrength
    );

    confirmInput.addEventListener('input', syncButtons);

    // =========================================
    // ETAPE 3 : NOUVEAU MOT DE PASSE
    // =========================================

    passwordForm.addEventListener('submit', async event => {

        event.preventDefault();

        if (busy || !resetToken || !passwordIsValid()) return;

        busy = true;

        hideMessage();
        syncButtons();

        try {

            await apiRequest('/reset', {

                email,
                resetToken,

                nouveauMotDePasse: passwordInput.value,

                confirmation: confirmInput.value
            });

            resetToken = null;
            csrfToken = null;
            email = '';

            emailInput.value = '';
            passwordInput.value = '';
            confirmInput.value = '';

            passwordInput.type = 'password';
            confirmInput.type = 'password';

            clearInterval(timer);

            showStep(4);

        } catch (error) {

            showMessage(error.message, 'error');

        } finally {

            busy = false;
            syncButtons();
        }
    });

    // =========================================
    // INITIALISATION
    // =========================================

    window.addEventListener('pagehide', () => {

        resetToken = null;
        csrfToken = null;

        passwordInput.value = '';
        confirmInput.value = '';

        clearInterval(timer);
    });

    showStep(1);
    updatePasswordStrength();

});
