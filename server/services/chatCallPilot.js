'use strict';

function valid(value) {
    return /^[1-9]\d{0,9}$/.test(String(value || ''))
        && Number(value) <= 2147483647;
}

function compteId(role) {
    if (role === 'client') {
        return Number(
            process.env.TASKLY_CHAT_CALLS_PILOT_CLIENT_ID
        );
    }

    if (role === 'artisan') {
        return Number(
            process.env.TASKLY_CHAT_CALLS_PILOT_ARTISAN_ID
        );
    }

    return null;
}

function demandeId() {
    return Number(
        process.env.TASKLY_CHAT_CALLS_PILOT_DEMANDE_ID
    );
}

function autoriseCompte(role, id) {

    return process.env.TASKLY_CHAT_WORKSPACE_ENABLED === 'true'
        && process.env.TASKLY_CHAT_CALLS_ENABLED === 'true'
        && valid(compteId('client'))
        && valid(compteId('artisan'))
        && valid(demandeId())
        && ['client', 'artisan'].includes(role)
        && valid(id)
        && Number(id) === compteId(role);
}

function autoriseDemande(id) {
    return valid(id) && valid(demandeId())
        && Number(id) === demandeId();
}

module.exports = {
    compteId,
    demandeId,
    autoriseCompte,
    autoriseDemande
};