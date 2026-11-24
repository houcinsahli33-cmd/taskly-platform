"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
    path.join(
        __dirname,
        "../client/public/js/taskly-admin-private-notifications-v17.js"
    ),
    "utf8"
);

async function fixture(role="client",total=3) {
    const documentEvents = {};
    const windowEvents = {};
    const requests = [];
    const attributes = {};

    let tick;
    let delayed;
    let clock = 100000;
    let failure = null;

    const badge = {
        hidden: true,
        textContent: "",
        setAttribute(key,value) {
            attributes[key] = value;
        },
        removeAttribute(key) {
            delete attributes[key];
        }
    };

    const document = {
        visibilityState:"visible",
        body:{
            dataset:{requireRole:role}
        },
        querySelectorAll(){
            return [badge];
        },
        addEventListener(name,fn){
            documentEvents[name]=fn;
        }
    };

    const window = {
        utilisateurCourant:{id:2,role},
        addEventListener(name,fn){
            windowEvents[name]=fn;
        }
    };

    vm.runInNewContext(source,{
        document,
        window,
        Date:{now:()=>clock},
        attendreSession:async()=>{},
        contexteAdminTaskly:()=>role==="admin",

        async requeteAPI(url){
            requests.push(url);

            if(failure) throw failure;

            return {total};
        },

        setInterval(fn){
            tick=fn;
            return 1;
        },

        clearInterval(){
            tick=null;
        },

        setTimeout(fn){
            delayed=fn;
            return 2;
        },

        clearTimeout(){
            delayed=null;
        }
    });

    await documentEvents.DOMContentLoaded();

    return {
        badge,attributes,requests,
        document,window,windowEvents,

        count(value){
            total=value;
        },

        fail(status){
            failure=Object.assign(
                new Error("Request failed"),
                {status}
            );
        },

        async refresh(){
            clock+=60000;
            await tick?.();
        },

        async flushRead(){
            clock+=5000;
            const fn=delayed;
            delayed=null;
            await fn?.();
            await new Promise(resolve=>
                setImmediate(resolve)
            );
        }
    };
}

test("V17 badge: real unread count",async()=>{
    const f=await fixture("client",3);

    assert.equal(f.badge.hidden,false);
    assert.equal(f.badge.textContent,"3");

    assert.equal(
        f.requests[0],
        "/api/taskly-private-v17/unread"
    );
});

test("V17 badge: admin route isolated",async()=>{
    const f=await fixture("admin",102);

    assert.equal(
        f.requests[0],
        "/api/admin/taskly-private-v17/unread"
    );

    assert.equal(f.badge.textContent,"99+");
});

test("V17 badge: zero count hidden",async()=>{
    const f=await fixture("artisan",4);

    f.count(0);

    await f.refresh();

    assert.equal(f.badge.hidden,true);
    assert.equal(
        f.attributes["aria-label"],undefined
    );
});

test("V17 badge: reading schedules refresh",async()=>{
    const f=await fixture("client",3);

    f.count(0);

    f.windowEvents["taskly:apv17-read"]();

    await f.flushRead();

    assert.equal(f.badge.hidden,true);
    assert.equal(f.requests.length,2);
});

test("V17 badge: hidden tab and expired session",async()=>{
    const f=await fixture("client",5);

    f.document.visibilityState="hidden";

    await f.refresh();

    assert.equal(f.requests.length,1);

    f.document.visibilityState="visible";
    f.fail(401);

    await f.refresh();

    assert.equal(f.badge.hidden,true);
    assert.equal(f.requests.length,2);

    await f.refresh();

    assert.equal(f.requests.length,2);
});