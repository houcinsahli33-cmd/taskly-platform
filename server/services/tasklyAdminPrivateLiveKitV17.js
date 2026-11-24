"use strict";

const {
    AccessToken,
    TrackSource
}=require("livekit-server-sdk");

const {
    validateCallId
}=require("./tasklyAdminPrivateCallsV17");

const fail=(message,status=400)=>
    Object.assign(new Error(message),{status});

function validUserId(value){
    return /^[1-9][0-9]{0,9}$/.test(String(value)) &&
        Number(value)<=2147483647;
}

// Internal service only.
// No HTTP token endpoint at this stage.
// Call only after session and thread ACL verification,
// accepted state verification and media security checks.

async function issueToken({
    call,
    userId,
    role
},config=process.env){

    if(!call ||
       !validUserId(userId) ||
       !["admin","client","artisan"].includes(role) ||
       !["audio","video"].includes(call.kind) ||
       !/^[1-9][0-9]{0,18}$/.test(String(call.threadId))){
        throw fail("Contexte LiveKit invalide.");
    }

    const callId=validateCallId(call.id);
    const uid=Number(userId);

    if(![
        Number(call.callerUserId),
        Number(call.recipientUserId)
    ].includes(uid)){
        throw fail("Appel introuvable.",404);
    }

    if(call.state!=="accepted"){
        throw fail("Appel non accepte.",409);
    }

    const url=config.LIVEKIT_URL;
    const apiKey=config.LIVEKIT_API_KEY;
    const apiSecret=config.LIVEKIT_API_SECRET;

    if(!url || !apiKey || !apiSecret){
        throw fail("LiveKit indisponible.",503);
    }

    let address;

    try{
        address=new URL(url);
    }catch{
        throw fail("Configuration LiveKit invalide.",503);
    }

    if(address.protocol!=="wss:" ||
       !address.hostname ||
       address.username ||
       address.password){
        throw fail("Configuration LiveKit invalide.",503);
    }

    // Separate room namespace.
    const room=
        "taskly-apv17-"+call.threadId+"-"+callId;

    const identity=
        "apv17-"+role+"-"+uid;

    const token=new AccessToken(
        apiKey,
        apiSecret,
        {
            identity,
            ttl:"2m"
        }
    );

    token.addGrant({
        room,
        roomJoin:true,
        canPublish:true,
        canSubscribe:true,
        canPublishData:false,
        canPublishSources:call.kind==="audio"
            ? [TrackSource.MICROPHONE]
            : [
                TrackSource.MICROPHONE,
                TrackSource.CAMERA
            ]
    });

    return {
        url,
        room,
        token:await token.toJwt()
    };
}

module.exports={issueToken};