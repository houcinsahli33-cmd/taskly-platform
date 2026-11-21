'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const text = f => fs.readFileSync(path.join(root, f), 'utf8');
const owner = text('client/public/js/taskly-call-floating.js');
const shell = text('client/public/js/taskly-call-host-shell.js');
const style = text('client/public/css/taskly-call-floating.css');

test('Client and Artisan: CSS and JS loaded only in private messaging pages', () => {
  for (const role of ['client','artisan']) {
    const html = text(`client/private/${role}/messagerie.html`);
    assert.match(html,/taskly-call-floating\.css/);
    assert.match(html,/taskly-call-floating\.js/);
    assert.match(html,/taskly-call-ui\.js/);
    assert.match(html,/taskly-call-premium\.js/);
  }
});
test('Floating window uses actual minimize/maximize/close controls and drag', () => {
  for (const key of ['min','max','close']) assert.ok(shell.includes(`data-call-host=\\"${key}\\"`) || shell.includes(`data-call-host="${key}"`));
  assert.match(shell, /setState\(state === 'max' \? 'normal' : 'max'\)/);
  assert.match(shell, /setState\(state === 'min' \? 'restore' : 'min'\)/);
  assert.match(shell, /title\.addEventListener\('pointermove'/);
  assert.match(shell, /send\('close'\)/);
  assert.match(owner, /ui\.finish\(ui\.active\.incoming/);
  assert.match(owner, /await originalFinish\.apply/);
});
test('Audio and video: same real LiveKit controller, no dummy stream or token', () => {
  assert.match(owner,/originalShow\.call/);
  assert.match(owner,/originalSelect\.apply/);
  assert.match(owner,/this\.start\(requestedMode\)/);
  assert.doesNotMatch(owner, /LivekitClient\.Room\s*\(/);
  assert.doesNotMatch(shell, /getUserMedia\s*\(/);
  assert.match(style,/\[data-tc=remote\]/);
  assert.match(style,/\[data-tc=local\]/);
});
test('Independent call owner remains alive during same-shell navigation', () => {
  assert.match(shell, /document\.body\.append\(el\)/);
  assert.match(shell,/taskly_call_host/);
  assert.match(shell,/taskly_client_embed/);
  assert.match(shell,/taskly_artisan_embed/);
  assert.match(owner,/parentHost\(\)\?\.isActive\(\)/);
  assert.match(owner,/event\.stopImmediatePropagation\(\)/);
});
test('Same-origin messages and server-enforced conversation validation', () => {
  assert.match(shell,/event\.origin !== location\.origin/);
  assert.match(shell,/event\.source !== frame\.contentWindow/);
  assert.match(owner,/event\.origin !== location\.origin/);
  assert.match(owner,/this\.start\(requestedMode\)/);
  assert.match(shell,/Number\.isSafeInteger/);
});
test('Incoming banner respects a call already hosted in shell', () => {
  const notification = text('client/public/js/taskly-call-notifications.js');
  assert.match(notification,/TasklyCallHost\?\.isActive/);
  assert.match(notification,/taskly-call-host-shell\.js/);
});
test('Compact green call over the dashboard, no sidebar/header modifications', () => {
  assert.match(style,/taskly-floating-titlebar/);
  assert.match(style,/taskly-floating-call-frame/);
  assert.match(style,/taskly-call-host='1'/);
  assert.match(style,/\[data-mode=video\]/);
  assert.doesNotMatch(style, /\.sidebar\s*\{|#site-header\s*\{/);
});

const vm = require('node:vm');
function runOwner({hostMode, mode='audio', id=42}) {
  const handlers = {};
  const sent = [];
  const opened = [];
  const parent = {postMessage: (...args) => sent.push(args)};
  const top = hostMode ? parent : {
    location:{origin:'https://taskly.test'},
    TasklyCallHost:{open:(...args)=>{opened.push(args);return true;},isActive:()=>false}
  };
  const doc = {
    body:{dataset:{tasklyCallConversation:String(id),requireRole:'client'},setAttribute(){}},
    documentElement:{dataset:{}},
    addEventListener:(type, fn)=>{handlers[type] = fn;},
    querySelector:()=>({}),
    createElement:()=>({dataset:{}}),
    head:{append(){}},
    getElementById:()=>null
  };
  const calls=[];
  const fakeUI = function(){};
  fakeUI.prototype.select = function (conv, who, enabled) {this.context={id:conv,enabled};};
  fakeUI.prototype.show = function (context, callMode) {this.active={context,mode:callMode};return this.active;};
  fakeUI.prototype.start = async function(callMode) {calls.push(callMode);return this.show(this.context,callMode);};
  fakeUI.prototype.poll = async function() {return 'legacy-poll';};
  fakeUI.prototype.cleanup = function(){this.active = null;};
  fakeUI.prototype.finish = async function(){this.cleanup();return 'done';};
  const context = {
    window:{TasklyCallUI:fakeUI,TasklyCallHost:null,top,parent,addEventListener:(type,fn)=>{handlers['window:'+type]=fn;}},
    document:doc,location:{origin:'https://taskly.test',search:hostMode?`?taskly_call_host=1&taskly_call_mode=${mode}&conversation=${id}`:''},
    URLSearchParams,Promise,Number,Object,console
  };
  context.window.window = context.window;
  if (!hostMode) context.window.top.TasklyCallHost = top.TasklyCallHost;
  vm.runInNewContext(owner, context, {filename:'taskly-call-floating.js'});
  return {context,handlers,sent,opened,calls,create:()=>new fakeUI()};
}

test('Runtime: outgoing audio/video uses persistent host, no duplicate legacy call', () => {
  const scenario = runOwner({hostMode:false});
  let prevented=false,stopped=false;
  scenario.handlers.click({
    defaultPrevented:false,isTrusted:true,
    target:{closest:()=>({id:'cw-call-video',disabled:false})},
    preventDefault:()=>{prevented=true;},stopImmediatePropagation:()=>{stopped=true;}
  });
  assert.deepEqual(scenario.opened,[['client',42,'video']]);
  assert.equal(prevented,true);assert.equal(stopped,true);
});

test('Runtime: real host auto-starts only once after permissioned selection', async () => {
  const scenario = runOwner({hostMode:true});
  const ui = scenario.create();
  ui.select(42,'Artisan',true);
  ui.select(42,'Artisan',true);
  await Promise.resolve();
  assert.equal(scenario.calls.length,1);
  assert.equal(scenario.calls[0],'audio');
  assert.equal(scenario.sent.some(([msg])=>msg.type==='taskly:call-host-mode'),true);
});

test('Runtime: close command calls original server-signaling finish', async () => {
  const scenario = runOwner({hostMode:true});
  const ui = scenario.create();
  ui.select(42,'Artisan',true);
  await Promise.resolve();
  scenario.handlers['window:message']({origin:'https://taskly.test',source:scenario.context.window.parent,data:{type:'taskly:call-host-command',action:'close'}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ui.active,null);
  assert.equal(scenario.sent.some(([msg])=>msg.type==='taskly:call-host-ended'),true);
});

test('Runtime: forged cross-origin close event cannot end a call', async () => {
  const scenario=runOwner({hostMode:true});
  const ui=scenario.create();ui.select(42,'Artisan',true);await Promise.resolve();
  scenario.handlers['window:message']({origin:'https://untrusted.invalid',source:scenario.context.window.parent,data:{type:'taskly:call-host-command',action:'close'}});
  assert.notEqual(ui.active,null);
});

test('Connected calls expose functional mic, speaker, chat, resize, camera and hangup', () => {
  for (const name of ['mic','sound','chat','camera','max','end']) assert.match(owner,new RegExp(`buttons\\.${name}\\.addEventListener`));
  assert.match(owner,/instance\.toggleMicrophone\(\)/);
  assert.match(owner,/remote\.muted = !remote\.muted/);
  assert.match(owner,/instance\.toggleCamera\(\)/);
  assert.match(owner,/instance\.finish\(instance\.active/);
  assert.match(shell,/event\.data\.action === 'chat'/);
  assert.match(style,/tc-floating-control\[data-tc-floating=end\]/);
});
