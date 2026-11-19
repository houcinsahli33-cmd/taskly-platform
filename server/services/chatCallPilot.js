'use strict';

function valid(value) {
    return /^[1-9]\d{0,9}$/.test(String(value || ''))
        && Number(value) <= 2147483647;
}

function active() {
    return process.env.TASKLY_CHAT_WORKSPACE_ENABLED === 'true'
        && process.env.TASKLY_CHAT_CALLS_ENABLED === 'true';
}

function modeGeneral() {
    return active() &&
        process.env.TASKLY_CHAT_CALLS_GENERAL_ENABLED === 'true';
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

    if (!active() ||
        !['client', 'artisan'].includes(role) ||
        !valid(id)) return false;

    if (modeGeneral()) return true;

    return valid(compteId('client'))
        && valid(compteId('artisan'))
        && valid(demandeId())
        && Number(id) === compteId(role);
}

function autoriseDemande(id) {

    if (!valid(id)) return false;

    if (modeGeneral()) return true;

    return valid(demandeId())
        && Number(id) === demandeId();
}

function interfaceDemande() {
    return modeGeneral() ? 'all' : demandeId();
}

module.exports = {
    compteId,
    demandeId,
    modeGeneral,
    interfaceDemande,
    autoriseCompte,
    autoriseDemande
};