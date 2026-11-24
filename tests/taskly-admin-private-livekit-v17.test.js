"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {randomUUID}=require("node:crypto");

const {issueToken}=require(
    "../server/services/tasklyAdminPrivateLiveKitV17"
);

const root=path.resolve(__dirname,"..");

const call={
    id:randomUUID(),
    threadId:"17",
    callerUserId:1,
    recipientUserId:2,
    kind:"audio",
    state:"accepted"
};

// Synthetic credentials. No LiveKit network connection.
const config={
    LIVEKIT_URL:"wss://example.invalid",
    LIVEKIT_API_KEY:"taskly-test-key",
    LIVEKIT_API_SECRET:"x".repeat(64)
};

function claims(token){
    return JSON.parse(
        Buffer.from(
            token.split(".")[1],
            "base64url"
        ).toString("utf8")
    );
}

test("V17 calls: ringing duration is 45 seconds",()=>{
    const source=fs.readFileSync(
        path.join(root,
            "server/services/tasklyAdminPrivateCallsV17.js"),
        "utf8"
    );

    assert.match(
        source,/INTERVAL 45 SECOND/
    );

    assert.doesNotMatch(
        source,/INTERVAL 3 MINUTE/
    );
});

test("V17 LiveKit: audio token has isolated room and permissions",async()=>{
    const result=await issueToken({
        call,userId:1,role:"admin"
    },config);

    const payload=claims(result.token);

    assert.equal(
        result.room,
        "taskly-apv17-17-"+call.id
    );

    assert.equal(payload.sub,"apv17-admin-1");
    assert.equal(payload.video.room,result.room);
    assert.equal(payload.video.roomJoin,true);
    assert.equal(payload.video.canPublishData,false);
    assert.equal(payload.video.canSubscribe,true);

    assert.equal(
        payload.video.canPublishSources.length,1
    );

    assert.equal(
        payload.video.roomAdmin===true,false
    );

    const remaining=
        payload.exp-Math.floor(Date.now()/1000);

    assert.ok(remaining>0 && remaining<=120);
});

test("V17 LiveKit: video token for member",async()=>{
    const result=await issueToken({
        call:{...call,kind:"video"},
        userId:2,
        role:"artisan"
    },config);

    const payload=claims(result.token);

    assert.equal(
        payload.sub,"apv17-artisan-2"
    );

    assert.equal(
        payload.video.canPublishSources.length,2
    );
});

test("V17 LiveKit: outsider and non accepted calls rejected",async()=>{
    await assert.rejects(
        issueToken({
            call,userId:3,role:"client"
        },config),
        {status:404}
    );

    for(const state of [
        "ringing","missed","ended",
        "rejected","cancelled"
    ]){
        await assert.rejects(
            issueToken({
                call:{...call,state},
                userId:1,
                role:"admin"
            },config),
            {status:409}
        );
    }
});

test("V17 LiveKit: invalid context and config rejected",async()=>{
    await assert.rejects(
        issueToken({
            call,userId:1,role:"unknown"
        },config),
        {status:400}
    );

    await assert.rejects(
        issueToken({
            call,userId:1,role:"admin"
        },{
            ...config,
            LIVEKIT_URL:"http://example.invalid"
        }),
        {status:503}
    );

    await assert.rejects(
        issueToken({
            call,userId:1,role:"admin"
        },{}),
        {status:503}
    );
});

function fixture(enabled=true){
    const recorded=[];

    const service={
        calls:{}
    };

    for(const name of [
        "start","get","current","transition"
    ]){
        service.calls[name]=async(...args)=>{
            recorded.push([name,...args]);
            return {ok:true};
        };
    }

    function Router(){
        const routes=new Map();

        return {
            routes,
            use(){},
            get(url,...handlers){
                routes.set("GET "+url,handlers);
            },
            post(url,...handlers){
                routes.set("POST "+url,handlers);
            }
        };
    }

    const nextMiddleware=(req,res,next)=>next();

    const module={exports:{}};

    const dependencies={
        express:{Router},

        "../middleware/authMiddleware":{
            verifierConnexion:nextMiddleware,
            verifierAdmin:nextMiddleware
        },

        "../middleware/securityMiddleware":{
            limiter:()=>nextMiddleware
        },

        "../services/tasklyAdminPrivateV17Service":{
            createService:()=>service
        },

        "../config/db":{
            promise:()=>({})
        }
    };

    const source=fs.readFileSync(
        path.join(root,
            "server/routes/tasklyAdminPrivateV17Routes.js"),
        "utf8"
    );

    vm.runInNewContext(source,{
        module,
        exports:module.exports,
        process:{
            env:{
                TASKLY_ADMIN_PRIVATE_V17_ENABLED:"true",
                TASKLY_ADMIN_PRIVATE_CALLS_V17_ENABLED:
                    enabled?"true":"false"
            }
        },
        require(name){
            if(!(name in dependencies)){
                throw new Error(
                    "Unexpected dependency: "+name
                );
            }

            return dependencies[name];
        }
    });

    async function invoke(
        role,route,body={}
    ){
        const router=module.exports[role];

        const handlers=router.routes.get(route);

        assert.ok(handlers);

        const req={
            session:{
                utilisateur:{id:2}
            },

            params:{
                id:"17",
                callId:call.id
            },

            body
        };

        const result={status:200};

        const res={
            status(value){
                result.status=value;
                return this;
            },

            json(value){
                result.body=value;
                return this;
            }
        };

        let index=0;

        function next(){
            const handler=handlers[index++];

            if(handler){
                return handler(req,res,next);
            }
        }

        await next();

        return result;
    }

    return {
        invoke,recorded,
        routers:module.exports
    };
}

test("V17 call routes: disabled feature returns 404",async()=>{
    const f=fixture(false);

    for(const role of ["admin","user"]){
        const result=await f.invoke(
            role,
            "POST /threads/:id/calls",
            {kind:"audio"}
        );

        assert.equal(result.status,404);
    }

    assert.equal(f.recorded.length,0);
});

test("V17 call routes: session identity used and extra fields rejected",async()=>{
    const f=fixture();

    const invalid=await f.invoke(
        "user",
        "POST /threads/:id/calls",
        {
            kind:"audio",
            userId:99
        }
    );

    assert.equal(invalid.status,400);
    assert.equal(f.recorded.length,0);

    const result=await f.invoke(
        "user",
        "POST /threads/:id/calls",
        {kind:"audio"}
    );

    assert.equal(result.status,201);

    assert.deepEqual(
        f.recorded[0],
        ["start",2,"user","17","audio"]
    );
});

test("V17 call routes: state transitions and media endpoint disabled",async()=>{
    const f=fixture();

    await f.invoke(
        "admin",
        "GET /threads/:id/calls/current"
    );

    await f.invoke(
        "user",
        "GET /threads/:id/calls/:callId"
    );

    await f.invoke(
        "user",
        "POST /threads/:id/calls/:callId/action",
        {action:"accept"}
    );

    assert.deepEqual(
        f.recorded,
        [
            ["current",2,"admin","17"],
            ["get",2,"user","17",call.id],
            [
                "transition",2,"user",
                "17",call.id,"accept"
            ]
        ]
    );

    for(const role of ["admin","user"]){
        for(const route of ["POST /threads/:id/calls/:callId/token","POST /threads/:id/calls/:callId/proof","GET /calls/incoming","GET /calls/config"]){
            const result=await f.invoke(role,route);
            assert.equal(result.status,404);
        }
    }
});