'use strict';

const { randomUUID } = require('node:crypto');
const { obtenirClientRedis } = require('../config/sessionStore');

const SCRIPT = `
local raw = redis.call('GET', KEYS[1])
local call = nil

if raw then
    call = cjson.decode(raw)
end

local action = ARGV[1]
local role = ARGV[2]
local id = ARGV[3]
local mode = ARGV[4]
local sdp = ARGV[5]
local now = tonumber(ARGV[6])

local function result(code, message, value)
    return cjson.encode({
        code = code,
        message = message,
        call = value or cjson.null
    })
end

local function save(value, ttl)
    redis.call('SET', KEYS[1], cjson.encode(value), 'EX', ttl)
end

if action == 'start' then

    if call and (call.state == 'ringing' or call.state == 'accepted') then
        return result(409, 'Un appel existe deja.')
    end

    call = {
        id = id,
        callerRole = role,
        mode = mode,
        state = 'ringing',
        offer = sdp,
        startedAt = now
    }

    save(call, 90)
    return result(201, 'Appel lance.', call)
end

if not call or call.id ~= id then
    return result(404, 'Appel introuvable.')
end

if action == 'accept' then

    if call.state ~= 'ringing' or call.callerRole == role then
        return result(409, 'Acceptation impossible.')
    end

    call.answer = sdp
    call.state = 'accepted'
    call.acceptedAt = now

    call.seenClient = now
    call.seenArtisan = now

    save(call, 60)
    return result(200, 'Appel accepte.', call)
end

if action == 'heartbeat' then

    if call.state ~= 'accepted' then
        return result(409, 'Appel non actif.')
    end

    local otherSeen = role == 'client'
        and call.seenArtisan or call.seenClient

    if not otherSeen
        or now - otherSeen > 45000
        or now - call.acceptedAt >= 7200000 then

        call.state = 'ended'
        call.endedAt = now
        call.offer = nil
        call.answer = nil

        save(call, 30)

        return result(200, 'Appel expire.', call)
    end

    if role == 'client' then
        call.seenClient = now
    else
        call.seenArtisan = now
    end

    save(call, 60)

    return result(200, 'Presence confirmee.', call)
end

if action == 'reject' then

    if call.state ~= 'ringing' or call.callerRole == role then
        return result(409, 'Refus impossible.')
    end

    call.state = 'rejected'

elseif action == 'end' then

    if call.state ~= 'ringing' and call.state ~= 'accepted' then
        return result(409, 'Appel deja termine.')
    end

    call.state = 'ended'

else
    return result(400, 'Action invalide.')
end

call.endedAt = now
call.offer = nil
call.answer = nil

save(call, 30)

return result(200, 'Appel termine.', call)
`;

function validId(value) {
    return Number.isSafeInteger(Number(value))
        && Number(value) > 0
        && Number(value) <= 2147483647;
}

function validSdp(value) {
    return typeof value === 'string'
        && value.startsWith('v=0')
        && Buffer.byteLength(value, 'utf8') <= 24576;
}

function failure(code, message) {
    return { code, message, call: null };
}

async function signaler(acces, action, payload = {}) {

    if (!acces ||
        !['client', 'artisan'].includes(acces.role) ||
        !validId(acces.demandeId) ||
        !validId(acces.clientId) ||
        !validId(acces.artisanId)) {
        return failure(403, 'Acces refuse.');
    }

    if (!['read', 'start', 'accept', 'reject', 'end', 'heartbeat'].includes(action)) {
        return failure(400, 'Action invalide.');
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return failure(400, 'Donnees invalides.');
    }

    if (action === 'start' &&
        (!['audio', 'video'].includes(payload.mode) ||
         !validSdp(payload.sdp))) {
        return failure(400, 'Offre WebRTC invalide.');
    }

    if (action === 'accept' && !validSdp(payload.sdp)) {
        return failure(400, 'Reponse WebRTC invalide.');
    }

    if (action !== 'start' && action !== 'read' &&
        (typeof payload.id !== 'string' ||
         !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.id))) {
        return failure(400, 'Identifiant invalide.');
    }

    const redis = obtenirClientRedis();

    if (!redis) {
        return failure(503, 'Service appels indisponible.');
    }

    const key = 'taskly:call:v1:'
        + Number(acces.demandeId) + ':'
        + Number(acces.clientId) + ':'
        + Number(acces.artisanId);

    if (action === 'read') {
        const raw = await redis.get(key);

        return {
            code: 200,
            call: raw ? JSON.parse(raw) : null
        };
    }

    const result = await redis.eval(SCRIPT, {
        keys: [key],
        arguments: [
            action,
            acces.role,
            action === 'start' ? randomUUID() : payload.id,
            action === 'start' ? payload.mode : '',
            ['start', 'accept'].includes(action) ? payload.sdp : '',
            String(Date.now())
        ]
    });

    return JSON.parse(result);
}

module.exports = { signaler };