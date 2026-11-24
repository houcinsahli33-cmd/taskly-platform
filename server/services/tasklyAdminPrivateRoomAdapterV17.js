"use strict";

const {RoomServiceClient}=require(
    "livekit-server-sdk"
);

const ROOM_PATTERN =
    /^taskly-apv17-[1-9][0-9]{0,18}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function notFound(error){
    return error?.code==="not_found" ||
        error?.status===404 ||
        error?.statusCode===404;
}

function createClient(
    config=process.env,
    Client=RoomServiceClient
){
    const {
        LIVEKIT_URL:url,
        LIVEKIT_API_KEY:key,
        LIVEKIT_API_SECRET:secret
    }=config;

    if(!url || !key || !secret){
        throw new Error(
            "APV17_LIVEKIT_CONFIG_MISSING"
        );
    }

    let address;

    try{
        address=new URL(url);
    }catch{
        throw new Error(
            "APV17_LIVEKIT_URL_INVALID"
        );
    }

    if(address.protocol!=="wss:" ||
       !address.hostname ||
       address.username ||
       address.password ||
       address.search ||
       address.hash ||
       address.pathname!=="/"){
        throw new Error(
            "APV17_LIVEKIT_URL_INVALID"
        );
    }

    return new Client(
        "https://"+address.host,
        key,
        secret
    );
}

function createRoomAdapter({client}){

    if(!client ||
       typeof client.listParticipants!=="function" ||
       typeof client.removeParticipant!=="function" ||
       typeof client.deleteRoom!=="function"){
        throw new TypeError(
            "APV17_LIVEKIT_CLIENT_INVALID"
        );
    }

    async function closeRoom(room){

        // Never accept legacy room names.
        if(typeof room!=="string" ||
           !ROOM_PATTERN.test(room)){
            throw new Error(
                "APV17_ROOM_INVALID"
            );
        }

        let incomplete=false;
        let participants=[];

        try{
            participants=await client.listParticipants(
                room
            );

            if(!Array.isArray(participants)){
                throw new Error(
                    "Invalid participants"
                );
            }

        }catch(error){

            if(!notFound(error)){
                incomplete=true;
            }

            participants=[];
        }

        const revokeTokenTs=BigInt(
            Math.floor(Date.now()/1000)
        );

        const identities=new Set();

        for(const participant of participants){

            if(typeof participant?.identity!=="string" ||
               !participant.identity){
                incomplete=true;
                continue;
            }

            identities.add(
                participant.identity
            );
        }

        const removals=await Promise.allSettled(
            [...identities].map(async identity=>{

                try{
                    await client.removeParticipant(
                        room,
                        identity,
                        {revokeTokenTs}
                    );

                }catch(error){

                    if(!notFound(error)){
                        throw error;
                    }
                }
            })
        );

        if(removals.some(
            result=>result.status==="rejected"
        )){
            incomplete=true;
        }

        // Always attempt deletion, even if a
        // participant could not be removed.

        try{
            await client.deleteRoom(room);

        }catch(error){

            if(!notFound(error)){
                incomplete=true;
            }
        }

        if(incomplete){
            throw new Error(
                "APV17_LIVEKIT_CLEANUP_INCOMPLETE"
            );
        }

        return {
            room,
            closed:true
        };
    }

    return {closeRoom};
}

module.exports={
    createClient,
    createRoomAdapter
};