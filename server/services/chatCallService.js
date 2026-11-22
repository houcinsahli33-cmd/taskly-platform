'use strict';

const { randomUUID } = require('node:crypto');
const { obtenirClientRedis } = require('../config/sessionStore');
const CLEANUP_KEY = 'taskly:livekit:cleanup:v1';

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


local function queueCleanup(runAt)
    if call and call.livekitIssued == true and
       (call.state == 'accepted' or call.state == 'ended') then

        local job = string.format(
            '{"demandeId":%d,"appelId":"%s","clientId":%d,"artisanId":%d}',
            tonumber(ARGV[7]),
            call.id,
            tonumber(ARGV[8]),
            tonumber(ARGV[9])
        )

        redis.call('ZADD', KEYS[2], runAt, job)
    end
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
        transport = ARGV[10],
        e2eeOfferKey = ARGV[11] ~= '' and ARGV[11] or nil,
        e2eeIdentityRequired = ARGV[18] == '1',
        startedAt = now
    }

    save(call, 90)
    return result(201, 'Appel lance.', call)
end

if not call or call.id ~= id then
    return result(404, 'Appel introuvable.')
end

if action == 'e2ee-identity-offer' then
    if call.state ~= 'ringing' or call.callerRole ~= role or
       not call.e2eeIdentityRequired or call.e2eeOfferKey == nil or
       ARGV[15] == '' or call.e2eeOfferIdentity ~= nil then
        return result(409,'Authentification de depart impossible.')
    end
    local packet=cjson.decode(ARGV[15])
    if packet.ephemeralPublicKey ~= call.e2eeOfferKey then
        return result(409,'Cle de depart non conforme.')
    end
    call.e2eeOfferIdentity=packet
    save(call,90)
    return result(200,'Identite de depart recue.',call)
end

if action == 'accept' then
    if (call.transport or 'webrtc') ~= ARGV[10] then
        return result(409, 'Protocoles incompatibles.')
    end

    if call.state ~= 'ringing' or call.callerRole == role then
        return result(409, 'Acceptation impossible.')
    end

    if call.e2eeOfferKey ~= nil then
        if ARGV[12] == '' or ARGV[13] == '' then
            return result(409,'Confirmation chiffrement absente.')
        end
        call.e2eeAnswerKey = ARGV[12]
        call.e2eeAcceptProof = ARGV[13]
    elseif ARGV[12] ~= '' or ARGV[13] ~= '' then
        return result(409,'Mode chiffrement incompatible.')
    end

    if call.e2eeIdentityRequired then
        if call.e2eeOfferIdentity == nil or ARGV[16] == '' then
            return result(409,'Identite chiffree manquante.')
        end
        local signed=cjson.decode(ARGV[16])
        if signed.ephemeralPublicKey ~= call.e2eeAnswerKey then
            return result(409,'Cle reponse modifiee.')
        end
        call.e2eeAnswerIdentity=signed
    elseif ARGV[16] ~= '' then
        return result(409,'Identite V25 inactive.')
    end

    call.answer = sdp
    call.state = 'accepted'
    call.acceptedAt = now

    call.seenClient = now
    call.seenArtisan = now

    save(call, 60)
    return result(200, 'Appel accepte.', call)
end

if action == 'e2ee-confirm' then
    if call.state ~= 'accepted' or call.callerRole ~= role or
       call.e2eeOfferKey == nil or call.e2eeAnswerKey == nil or
       call.e2eeAcceptProof == nil or ARGV[14] == '' then
        return result(409,'Confirmation E2EE impossible.')
    end
    if call.e2eeIdentityRequired then
        if ARGV[17] == '' or call.e2eeOfferIdentity == nil or
           call.e2eeAnswerIdentity == nil then
            return result(409,'Identite V25 non confirmee.')
        end
        local signed=cjson.decode(ARGV[17])
        if signed.ephemeralPublicKey ~= call.e2eeOfferKey then
            return result(409,'Cle confirmeur modifiee.')
        end
        call.e2eeConfirmIdentity=signed
    elseif ARGV[17] ~= '' then
        return result(409,'Identite V25 inactive.')
    end
    call.e2eeCallerProof = ARGV[14]
    save(call,60)
    return result(200,'Confirmation recue.',call)
end

if action == 'livekit' then
    if call.state ~= 'accepted' then
        return result(409, 'Appel non actif.')
    end
    if call.e2eeIdentityRequired and (call.e2eeOfferIdentity == nil or
        call.e2eeAnswerIdentity == nil or call.e2eeConfirmIdentity == nil) then
        return result(409,'Authentification V25 incomplete.')
    end

    call.livekitIssued = true
    queueCleanup(now + 60000)
    save(call, 60)

    return result(200, 'LiveKit prepare.', call)
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

        queueCleanup(now)
        save(call, 30)

        return result(200, 'Appel expire.', call)
    end

    if role == 'client' then
        call.seenClient = now
    else
        call.seenArtisan = now
    end

    queueCleanup(now + 60000)
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

queueCleanup(now)
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

    if (!['read', 'start', 'accept', 'reject', 'end', 'heartbeat', 'livekit',
           'e2ee-confirm','e2ee-identity-offer'].includes(action)) {
        return failure(400, 'Action invalide.');
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return failure(400, 'Donnees invalides.');
    }


    const transport = ['start', 'accept'].includes(action)
        ? (payload.transport ?? 'webrtc')
        : 'webrtc';

    if (!['webrtc', 'livekit'].includes(transport)) {
        return failure(400, 'Protocole invalide.');
    }

    if (transport === 'livekit' &&
        (process.env.TASKLY_LIVEKIT_ENABLED !== 'true' ||
         process.env.TASKLY_LIVEKIT_BROWSER_ENABLED !== 'true')) {
        return failure(404, 'LiveKit indisponible.');
    }

    if (action === 'start' &&
        (!['audio', 'video'].includes(payload.mode) ||
         !(transport === 'livekit' ? payload.sdp == null : validSdp(payload.sdp)))) {
        return failure(400, 'Offre WebRTC invalide.');
    }

    if (action === 'accept' &&
        !(transport === 'livekit' ? payload.sdp == null : validSdp(payload.sdp))) {
        return failure(400, 'Reponse WebRTC invalide.');
    }

    if (action !== 'start' && action !== 'read' &&
        (typeof payload.id !== 'string' ||
         !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.id))) {
        return failure(400, 'Identifiant invalide.');
    }

    function validPublicKey(value) {
        if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{87}$/.test(value)) return false;
        try {
            const bytes = Buffer.from(value.replace(/-/g,'+').replace(/_/g,'/'),'base64');
            return bytes.length === 65 && bytes[0] === 4;
        } catch { return false; }
    }
    function validProof(value) {
        return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
    }
    if (action === 'start' && payload.e2eeRequired === true &&
        (transport !== 'livekit' || !validPublicKey(payload.e2eePublicKey))) {
        return failure(400,'Cle publique E2EE invalide.');
    }
    if (action === 'accept' && payload.e2eeRequired === true &&
        (!validPublicKey(payload.e2eePublicKey) || !validProof(payload.e2eeProof))) {
        return failure(400,'Reponse E2EE invalide.');
    }
    if (action === 'e2ee-confirm' && !validProof(payload.e2eeProof)) {
        return failure(400,'Confirmation E2EE invalide.');
    }
    if (payload.e2eeRequired !== true && (payload.e2eePublicKey || payload.e2eeProof)) {
        return failure(409,'Mode E2EE incompatible.');
    }
    function validIdentityPacket(packet,expectedKey) {
        if (!packet || typeof packet !== 'object' || Array.isArray(packet)) return false;
        return packet.role === acces.role &&
            packet.accountId === Number(acces.role === 'client'
                ? acces.clientId : acces.artisanId) &&
            packet.demandeId === Number(acces.demandeId) &&
            packet.callId === payload.id &&
            validPublicKey(packet.ephemeralPublicKey) &&
            (!expectedKey || packet.ephemeralPublicKey === expectedKey) &&
            validPublicKey(packet.identityPublicKey) &&
            typeof packet.signature === 'string' &&
            /^[A-Za-z0-9_-]{86}$/.test(packet.signature) &&
            Buffer.byteLength(JSON.stringify(packet),'utf8') <= 1024;
    }
    const needsIdentity = ['e2ee-identity-offer','accept','e2ee-confirm'].includes(action)
        && payload.e2eeIdentityRequired === true;
    if (needsIdentity && !validIdentityPacket(payload.e2eeIdentityPacket,
            action === 'accept' ? payload.e2eePublicKey : null)) {
        return failure(400,'Signature identite V25 invalide.');
    }
    if (!needsIdentity && payload.e2eeIdentityPacket != null) {
        return failure(409,'Signature V25 non attendue.');
    }
    if (action === 'start' && payload.e2eeIdentityRequired === true &&
        (payload.e2eeRequired !== true || transport !== 'livekit')) {
        return failure(409,'E2EE requis pour identite V25.');
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
        keys: [key, CLEANUP_KEY],
        arguments: [
            action,
            acces.role,
            action === 'start' ? randomUUID() : payload.id,
            action === 'start' ? payload.mode : '',
            ['start', 'accept'].includes(action) ? (payload.sdp || '') : '',
            String(Date.now()),
            String(acces.demandeId),
            String(acces.clientId),
            String(acces.artisanId),
            transport,
            action === 'start' ? (payload.e2eePublicKey || '') : '',
            action === 'accept' ? (payload.e2eePublicKey || '') : '',
            action === 'accept' ? (payload.e2eeProof || '') : '',
            action === 'e2ee-confirm' ? (payload.e2eeProof || '') : '',
            action === 'e2ee-identity-offer' ? JSON.stringify(payload.e2eeIdentityPacket) : '',
            action === 'accept' && payload.e2eeIdentityRequired === true
                ? JSON.stringify(payload.e2eeIdentityPacket) : '',
            action === 'e2ee-confirm' && payload.e2eeIdentityRequired === true
                ? JSON.stringify(payload.e2eeIdentityPacket) : '',
            action === 'start' && payload.e2eeIdentityRequired === true ? '1' : '0'
        ]
    });

    return JSON.parse(result);
}

module.exports = { signaler };