"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {randomUUID}=require("node:crypto");

const {
    createClient,
    createRoomAdapter
}=require(
    "../server/services/tasklyAdminPrivateRoomAdapterV17"
);

const {runCleanup}=require(
    "../server/services/tasklyAdminPrivateCleanupWorkerV17"
);

const room="taskly-apv17-17-"+randomUUID();

function fixture(failures={}){
    const recorded=[];

    const client={

        async listParticipants(name){

            recorded.push(["list",name]);

            if(failures.list){
                throw failures.list;
            }

            return [
                {identity:"apv17-admin-1"},
                {identity:"apv17-client-2"}
            ];
        },

        async removeParticipant(
            name,identity,options
        ){
            recorded.push([
                "remove",
                name,
                identity,
                options
            ]);

            if(failures.remove){
                throw failures.remove;
            }
        },

        async deleteRoom(name){

            recorded.push(["delete",name]);

            if(failures.delete){
                throw failures.delete;
            }
        }
    };

    return {
        recorded,
        client,
        adapter:createRoomAdapter({client})
    };
}

test("V17 room adapter: legacy rooms rejected",async()=>{

    const f=fixture();

    await assert.rejects(
        f.adapter.closeRoom(
            "taskly-17-"+randomUUID()
        ),
        /APV17_ROOM_INVALID/
    );

    assert.equal(f.recorded.length,0);
});

test("V17 room adapter: removes both participants and closes",async()=>{

    const f=fixture();

    const result=await f.adapter.closeRoom(room);

    assert.equal(result.closed,true);

    const removals=f.recorded.filter(
        r=>r[0]==="remove"
    );

    assert.equal(removals.length,2);

    for(const removal of removals){

        assert.equal(removal[1],room);

        assert.equal(
            typeof removal[3].revokeTokenTs,
            "bigint"
        );
    }

    assert.deepEqual(
        f.recorded.at(-1),
        ["delete",room]
    );
});

test("V17 room adapter: missing room is idempotent",async()=>{

    const missing=Object.assign(
        new Error("Room missing"),
        {code:"not_found"}
    );

    const f=fixture({
        list:missing,
        delete:missing
    });

    assert.equal(
        (await f.adapter.closeRoom(room)).closed,
        true
    );
});

test("V17 room adapter: removal failure still attempts deletion",async()=>{

    const f=fixture({
        remove:new Error("Temporary error")
    });

    await assert.rejects(
        f.adapter.closeRoom(room),
        /APV17_LIVEKIT_CLEANUP_INCOMPLETE/
    );

    assert.deepEqual(
        f.recorded.at(-1),
        ["delete",room]
    );
});

test("V17 room adapter: list failure still attempts deletion",async()=>{

    const f=fixture({
        list:new Error("Temporary error")
    });

    await assert.rejects(
        f.adapter.closeRoom(room),
        /APV17_LIVEKIT_CLEANUP_INCOMPLETE/
    );

    assert.deepEqual(
        f.recorded.at(-1),
        ["delete",room]
    );
});

test("V17 room adapter: deletion failure is retriable",async()=>{

    const f=fixture({
        delete:new Error("Temporary error")
    });

    await assert.rejects(
        f.adapter.closeRoom(room),
        /APV17_LIVEKIT_CLEANUP_INCOMPLETE/
    );
});

test("V17 room adapter: validates LiveKit configuration",()=>{

    class FakeClient{
        constructor(host,key,secret){
            this.host=host;
        }
    }

    const config={
        LIVEKIT_URL:"wss://example.invalid",
        LIVEKIT_API_KEY:"synthetic",
        LIVEKIT_API_SECRET:"synthetic"
    };

    assert.equal(
        createClient(config,FakeClient).host,
        "https://example.invalid"
    );

    assert.throws(
        ()=>createClient({
            ...config,
            LIVEKIT_URL:"http://example.invalid"
        },FakeClient),
        /APV17_LIVEKIT_URL_INVALID/
    );

    assert.throws(
        ()=>createClient({},FakeClient),
        /APV17_LIVEKIT_CONFIG_MISSING/
    );
});

test("V17 cleanup worker: disabled or isolated execution",async()=>{

    let queries=0;

    const db={
        async query(sql){
            queries++;

            if(sql.includes("SELECT id,")){
                return [[]];
            }

            return [{affectedRows:0}];
        }
    };

    const disabled=await runCleanup({
        db,
        config:{}
    });

    assert.equal(disabled.disabled,true);
    assert.equal(queries,0);

    const f=fixture();

    const result=await runCleanup({
        db,
        client:f.client,
        config:{
            TASKLY_ADMIN_PRIVATE_V17_ENABLED:"true",
            TASKLY_ADMIN_PRIVATE_CALLS_V17_ENABLED:"true"
        }
    });

    assert.equal(result.processed,0);
    assert.equal(queries,2);
    assert.equal(f.recorded.length,0);
});