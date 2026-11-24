"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");

const {
    createCallService,
    nextState,
    validateCallId
}=require(
    "../server/services/tasklyAdminPrivateCallsV17"
);

const ringing={
    caller_user_id:1,
    recipient_user_id:2,
    state:"ringing"
};

test("V17 calls: recipient accepts",()=>{
    assert.equal(
        nextState(ringing,2,"accept"),
        "accepted"
    );
});

test("V17 calls: caller cannot accept own call",()=>{
    assert.throws(
        ()=>nextState(ringing,1,"accept"),
        {status:403}
    );
});

test("V17 calls: recipient rejects",()=>{
    assert.equal(
        nextState(ringing,2,"reject"),
        "rejected"
    );
});

test("V17 calls: caller cancels",()=>{
    assert.equal(
        nextState(ringing,1,"cancel"),
        "cancelled"
    );
});

test("V17 calls: recipient cannot cancel",()=>{
    assert.throws(
        ()=>nextState(ringing,2,"cancel"),
        {status:403}
    );
});

test("V17 calls: both participants can end accepted call",()=>{
    const call={
        ...ringing,state:"accepted"
    };

    assert.equal(
        nextState(call,1,"end"),
        "ended"
    );

    assert.equal(
        nextState(call,2,"end"),
        "ended"
    );
});

test("V17 calls: outsiders cannot control calls",()=>{
    for(const action of [
        "accept","reject","cancel","end"
    ]){
        assert.throws(
            ()=>nextState(ringing,3,action),
            {status:404}
        );
    }
});

test("V17 calls: expired or terminal calls cannot reopen",()=>{
    for(const state of [
        "missed","ended","cancelled","rejected"
    ]){
        assert.throws(
            ()=>nextState(
                {...ringing,state},
                2,"accept"
            ),
            {status:409}
        );
    }
});

test("V17 calls: invalid action rejected",()=>{
    assert.throws(
        ()=>nextState(ringing,2,"connect"),
        {status:400}
    );
});

test("V17 calls: invalid identifiers rejected",()=>{
    for(const value of [
        null,1,"abc","../call"
    ]){
        assert.throws(
            ()=>validateCallId(value),
            {status:400}
        );
    }

    const {randomUUID}=
        require("node:crypto");

    const id=randomUUID();

    assert.equal(
        validateCallId(id),id
    );
});

test("V17 calls: unsupported media type rejected before SQL",async()=>{
    let transactions=0;

    const service=createCallService({
        tx:async()=>{
            transactions++;
        },
        check:async()=>{},
        id:Number,
        threadId:String
    });

    await assert.rejects(
        service.start(
            1,"admin","17","screen"
        ),
        {status:400}
    );

    assert.equal(transactions,0);
});

test("V17 calls: access check precedes database mutations",async()=>{
    let queries=0;

    const service=createCallService({
        tx:async fn=>fn({
            async query(){
                queries++;
                throw new Error("Unexpected SQL");
            }
        }),
        check:async()=>{
            throw Object.assign(
                new Error("Forbidden"),
                {status:404}
            );
        },
        id:Number,
        threadId:String
    });

    await assert.rejects(
        service.start(
            3,"user","17","audio"
        ),
        {status:404}
    );

    assert.equal(queries,0);
});