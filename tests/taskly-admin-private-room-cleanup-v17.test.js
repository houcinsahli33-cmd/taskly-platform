"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {randomUUID}=require("node:crypto");

const {createCleanupService}=require(
    "../server/services/tasklyAdminPrivateRoomCleanupV17"
);

const {roomName}=require(
    "../server/services/tasklyAdminPrivateLiveKitV17"
);

function fixture(stage=0,shouldFail=false){

    const id=randomUUID();
    const calls=[];
    const deleted=[];

    const db={
        async query(sql,params=[]){

            calls.push({sql,params});

            if(sql.includes("SELECT id,")){
                return [[{
                    id,
                    thread_id:"17",
                    cleanup_stage:stage
                }]];
            }

            return [{affectedRows:1}];
        }
    };

    const service=createCleanupService({
        db,
        async deleteRoom(room){
            deleted.push(room);

            if(shouldFail){
                throw new Error("Synthetic failure");
            }
        }
    });

    return {service,calls,deleted,id};
}

test("V17 cleanup: room namespace is isolated",()=>{

    const id=randomUUID();

    assert.equal(
        roomName("17",id),
        "taskly-apv17-17-"+id
    );

    assert.throws(
        ()=>roomName("../legacy",id)
    );
});

test("V17 cleanup: expired calls and terminal states only",async()=>{

    const f=fixture();

    await f.service.sweep();

    assert.match(
        f.calls[0].sql,
        /expires_at<=UTC_TIMESTAMP/
    );

    assert.match(
        f.calls[1].sql,
        /'missed','ended','cancelled','rejected'/
    );

    assert.match(
        f.calls[1].sql,
        /cleanup_stage IN \(0,1\)/
    );

    assert.deepEqual(
        f.deleted,
        ["taskly-apv17-17-"+f.id]
    );
});

test("V17 cleanup: first deletion schedules second pass",async()=>{

    const f=fixture();

    const result=await f.service.sweep();

    assert.deepEqual(result,{
        processed:1,
        succeeded:1,
        failed:0
    });

    assert.deepEqual(
        f.calls[2].params,
        [1,1,f.id,0]
    );

    assert.match(
        f.calls[2].sql,
        /INTERVAL 3 MINUTE/
    );
});

test("V17 cleanup: second deletion completes cleanup",async()=>{

    const f=fixture(1);

    await f.service.sweep();

    assert.deepEqual(
        f.calls[2].params,
        [2,2,f.id,1]
    );
});

test("V17 cleanup: deletion failure persists retry",async()=>{

    const f=fixture(0,true);

    const result=await f.service.sweep();

    assert.equal(result.failed,1);
    assert.equal(result.succeeded,0);

    assert.match(
        f.calls[2].sql,
        /INTERVAL 30 SECOND/
    );

    assert.deepEqual(
        f.calls[2].params,
        [f.id,0]
    );
});

test("V17 cleanup: invalid batch size rejected",async()=>{

    const f=fixture();

    await assert.rejects(
        f.service.sweep(101),
        RangeError
    );

    assert.equal(f.calls.length,0);
    assert.equal(f.deleted.length,0);
});