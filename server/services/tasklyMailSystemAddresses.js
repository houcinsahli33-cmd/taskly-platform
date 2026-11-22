'use strict';

// Registre des identites internes reservees. Aucune boite utilisateur n'est
// creee ici et aucune autorisation administrateur ne peut etre deduite
// de la seule adresse. Ce module est volontairement sans effet de bord.
const SERVICE_ADDRESSES = Object.freeze({
    administration: 'administration@taskly.dz',
    support: 'support@taskly.dz'
});

function normalizeAddress(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function serviceForAddress(value) {
    const address = normalizeAddress(value);
    if (address === SERVICE_ADDRESSES.administration) return 'administration';
    if (address === SERVICE_ADDRESSES.support) return 'support';
    return null;
}

function reservedServiceAddress(value) {
    return serviceForAddress(value) !== null;
}

module.exports = {SERVICE_ADDRESSES, normalizeAddress, serviceForAddress, reservedServiceAddress};
