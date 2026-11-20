'use strict';

function modeGeneral(env = process.env) {
    return env.TASKLY_MAIL_PILOT_ENABLED === 'true'
        && env.TASKLY_MAIL_INTERNAL_ENABLED === 'true'
        && env.TASKLY_MAIL_GENERAL_ENABLED === 'true'
        && env.TASKLY_MAIL_AUTO_ACTIVATION === 'true'
        && env.TASKLY_MAIL_GATEWAY_ENABLED === 'false';
}

function modeClient(env = process.env) {
    return modeGeneral(env)
        && env.TASKLY_MAIL_CLIENT_ENABLED === 'true';
}

module.exports = { modeGeneral, modeClient };