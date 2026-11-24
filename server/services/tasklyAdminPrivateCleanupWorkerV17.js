"use strict";

const {
    createClient,
    createRoomAdapter
}=require(
    "./tasklyAdminPrivateRoomAdapterV17"
);

const {
    createCleanupService
}=require(
    "./tasklyAdminPrivateRoomCleanupV17"
);

async function runCleanup({
    db,
    client,
    limit=10,
    config=process.env
}={}){

    if(config.TASKLY_ADMIN_PRIVATE_CLEANUP_V17_ENABLED!=="true" &&
       (config.TASKLY_ADMIN_PRIVATE_V17_ENABLED!=="true" ||
        config.TASKLY_ADMIN_PRIVATE_CALLS_V17_ENABLED!=="true")){
        return {disabled:true};
    }

    if(!db || typeof db.query!=="function"){
        throw new TypeError(
            "APV17_DATABASE_REQUIRED"
        );
    }

    const adapter=createRoomAdapter({
        client:client || createClient(config)
    });

    const cleanup=createCleanupService({
        db,
        deleteRoom:adapter.closeRoom
    });

    return cleanup.sweep(limit);
}

module.exports={runCleanup};