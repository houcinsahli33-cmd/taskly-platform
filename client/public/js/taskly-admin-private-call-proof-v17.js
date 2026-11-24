"use strict";
(function(global){
    if(!global.crypto?.subtle)return;
    const subtle=global.crypto.subtle;
    const encoder=new TextEncoder();
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const validId=n=>Number.isSafeInteger(n)&&n>0&&n<=2147483647;
    function payload(call,actor){
        if(!call||!uuid.test(call.id)||typeof call.id!=="string"||
           typeof call.threadId!=="string"||!/^[1-9][0-9]{0,18}$/.test(call.threadId)||
           !["audio","video"].includes(call.kind)||!validId(call.callerUserId)||
           !validId(call.recipientUserId)||call.callerUserId===call.recipientUserId||
           ![call.callerUserId,call.recipientUserId].includes(actor))throw Error("Contexte appel invalide.");
        return encoder.encode(JSON.stringify(["Taskly-APV17-Call-Proof-v1",call.threadId,
            call.id,call.kind,call.callerUserId,call.recipientUserId,actor]));
    }
    function materialBytes(material){
        if(Object.prototype.toString.call(material)!=="[object ArrayBuffer]"||material.byteLength!==64)throw Error("Materiel invalide.");
        return new Uint8Array(material);
    }
    async function key(material){
        const secret=materialBytes(material).slice(32);
        try{return await subtle.importKey("raw",secret,{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);}
        finally{secret.fill(0);}
    }
    async function sign(material,call,actor){
        const bytes=new Uint8Array(await subtle.sign("HMAC",await key(material),payload(call,actor)));
        return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
    }
    async function verify(material,call,actor,signature){
        if(typeof signature!=="string"||!/^[a-f0-9]{64}$/.test(signature))return false;
        return subtle.verify("HMAC",await key(material),Uint8Array.from(signature.match(/../g),v=>parseInt(v,16)),payload(call,actor));
    }
    function mediaKey(material){return materialBytes(material).slice(0,32).buffer;}
    global.TasklyAdminPrivateCallProofV17=Object.freeze({sign,verify,mediaKey});
})(window);
