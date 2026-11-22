 'use strict';
/* Taskly V8 call view. Presentation only: the existing LiveKit controller owns
 * media, connection, authentication and hangup. Never simulates a connection.
 */
(() => {
  if (window.TasklyCallMaquetteV8) return;
  const isHost = new URLSearchParams(location.search).get('taskly_call_host') === '1';
  const version = '11';
  const css = '/css/taskly-call-maquette-v8.css?v=' + version;
  // The outer titlebar belongs to the persistent dashboard shell. Add only CSS.
  if (!isHost) {
    try {
      const top = window.top;
      if (top?.location.origin === location.origin && !top.document.querySelector('link[href*="taskly-call-maquette-v8.css"]')) {
        const link = top.document.createElement('link');
        link.rel = 'stylesheet'; link.href = css; link.dataset.tasklyCallV8Shell = '1';
        top.document.head.append(link);
      }
    } catch { /* An inaccessible frame never alters the call. */ }
    window.TasklyCallMaquetteV8 = Object.freeze({version, isHost});
    return;
  }
  document.documentElement.dataset.tasklyCallV8 = '1';
  const UI = window.TasklyCallUI?.prototype;
  if (!UI || UI.__tasklyCallV8) return;
  Object.defineProperty(UI, '__tasklyCallV8', {value:true});
  const instances = new WeakMap();
  const iconShapes = Object.freeze({
    mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8"/>',
    camera:'<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-4v12l-6-4"/>',
    sound:'<path d="M11 5 6 9H3v6h3l5 4V5ZM15.5 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12"/>',
    share:'<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8m-4-4v4m-3-9 3-3 3 3m-3-3v6"/>',
    chat:'<path d="M4 4h16v13H9l-5 4V4Z"/><path d="M8 9h8m-8 4h5"/>',
    more:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    device:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l-2 2a1.8 1.8 0 0 0-2-.4l-1.1.5V21h-4v-1.9l-1.1-.5a1.8 1.8 0 0 0-2 .4l-2-2a1.8 1.8 0 0 0 .4-2L5.5 14H4v-4h1.5L6 8.9a1.8 1.8 0 0 0-.4-2l2-2a1.8 1.8 0 0 0 2 .4l1.1-.5V3h4v1.8l1.1.5a1.8 1.8 0 0 0 2-.4l2 2a1.8 1.8 0 0 0-.4 2L19.9 10H21v4h-1.1Z"/>',
    expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    hang:'<path d="M3.6 15.9c1.4-1.5 4.8-2.7 8.4-2.7s7 1.2 8.4 2.7l-2.5 3.2a2 2 0 0 1-2.4.2l-1.3-1.4a8 8 0 0 0-4.4 0l-1.3 1.4a2 2 0 0 1-2.4-.2Z"/>',
    signal:'<path d="M3 15v-6m4 10V5m4 17V2m4 17V5m4 10V9"/>',
    cross:'<path d="m3 3 18 18"/>'
  });
  function icon(name) {
    const span=document.createElement('span');span.className='tc-v8-icon';span.setAttribute('aria-hidden','true');
    span.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+iconShapes[name]+'</svg>';
    return span;
  }
  function node(tag, cls, label) {
    const el=document.createElement(tag); if (cls) el.className=cls;
    if (label !== undefined) el.textContent=label;
    return el;
  }
  function button(label, glyph, cls='') {
    const b=node('button','tc-v8-button '+cls);b.type='button';b.setAttribute('aria-label',label);
    b.append(icon(glyph),node('span','tc-v8-button-text',label));return b;
  }
  function text(el,value) { if (el && el.textContent !== value) el.textContent = value; }
  function notify(action) {
    try { if (window.parent !== window) window.parent.postMessage({type:'taskly:call-host-action',action},location.origin); } catch {}
  }
  function status(info, message) { text(info.feedback,message);info.feedback.hidden=!message; }
  function nameSafe(dialog) {return dialog.querySelector('[data-tc=name]')?.textContent?.trim() || 'Correspondant';}
  function sync(info) {
    const {dialog,instance}=info;
    if (!dialog.open) { if (info.timer) clearInterval(info.timer);info.timer=null;return; }
    const connected = dialog.dataset.premiumStage === 'connected';
    const stage=dialog.dataset.premiumStage || 'connecting';
    const incoming=stage==='incoming';
    info.board.dataset.callStage=stage;
    if (info.lastNotifiedStage !== stage && window.parent !== window && location.origin) {
      info.lastNotifiedStage = stage;
      try { window.parent.postMessage({type:'taskly:call-host-stage', stage}, location.origin); }
      catch { /* parent navigation must never affect media */ }
    }
    info.incomingRow.hidden=!incoming;
    info.hang.hidden=incoming;
    const mode=dialog.dataset.mode === 'video' ? 'video' : 'audio';
    // V9: attached LiveKit media must be inside the visible video stage, even
    // if the original controller recreated its nodes on another call.
    const videoBox=info.board.querySelector('.tc-v8-video');
    const videos=dialog.querySelector('.tc-videos');
    if (videoBox && videos && videos.parentElement!==videoBox) videoBox.prepend(videos);
    if (info.actionArea && info.hang) {
      if(mode==='video' && connected && info.hang.parentElement!==info.actionArea)
        info.actionArea.append(info.hang);
      if((mode!=='video' || !connected) && info.hang.parentElement!==info.board)
        info.board.insertBefore(info.hang,info.feedback);
    }
    if(info.videoRemoteLabel) info.videoRemoteLabel.textContent=nameSafe(dialog);
    dialog.dataset.tasklyV8Connected=String(connected);
    info.board.dataset.callMode=mode;
    const name=dialog.querySelector('[data-tc=name]')?.textContent?.trim() || 'Votre correspondant';
    text(info.person,name);text(info.heroName,name);
    const letter=[...name.trim()][0]?.toLocaleUpperCase('fr') || '?';
    text(info.avatar,letter);text(info.heroAvatar,letter);
    const service=document.querySelector('#cw-person-service')?.textContent?.trim().replace(/\s*[•·]\s*En ligne.*$/i,'') || '';
    if (service && !/sélectionnez|demande/i.test(service)) text(info.service,service);
    else text(info.service,'Appel '+mode);
    text(info.kind,incoming ? `Appel ${mode} entrant` : connected ? `Appel ${mode} en cours` :
      stage==='reconnecting' ? 'Reconnexion à votre appel…' : 'En attente de votre interlocuteur…');
    text(info.duration,connected ? (dialog.querySelector('.tc-premium-duration')?.textContent?.trim() || '00:00') : '00:00');
    info.presence.hidden=!connected;
    info.badge.textContent=connected?'● En ligne':'Connexion…';
    info.board.classList.toggle('tc-v8-on',connected);
    const call=instance.active;
    info.buttons.mic.classList.toggle('is-off',call?.microphone===false);
    info.buttons.mic.setAttribute('aria-pressed',String(call?.microphone===false));
    info.buttons.camera.classList.toggle('is-off',mode==='audio' || call?.camera===false);
    info.buttons.camera.setAttribute('aria-pressed',String(mode==='video' && call?.camera===false));
    info.buttons.camera.disabled=mode!=='video';
    info.buttons.camera.title=mode!=='video'?'Caméra disponible pour les appels vidéo':'Activer ou couper la caméra';
    const remote=instance.get?.('remote');
    info.buttons.sound.classList.toggle('is-off',Boolean(remote?.muted));
    const shareEnabled=call?.media?.room?.localParticipant?.isScreenShareEnabled;
    if(typeof shareEnabled==='boolean') {
      info.buttons.share.setAttribute('aria-pressed',String(shareEnabled));
      info.buttons.share.classList.toggle('is-active',shareEnabled);
    }
    if (!info.timer && connected) {
      info.timer=setInterval(()=>{
        if (!dialog.open) {clearInterval(info.timer);info.timer=null;return;}
        text(info.duration,dialog.querySelector('.tc-premium-duration')?.textContent?.trim() || '00:00');
      },1000);
    }
    if (!connected && info.timer) {clearInterval(info.timer);info.timer=null;}
  }
  function attach(dialog,instance) {
    if (!dialog) return;
    if (instances.has(dialog)) {
      const prior=instances.get(dialog);sync(prior);prior.resumeUnread?.();return;
    }
    const panel=dialog.querySelector('.tc-panel');if(!panel)return;
    const board=node('section','tc-v8-board');board.setAttribute('aria-label','Appel Taskly');
    const top=node('div','tc-v8-top');
    const contact=node('div','tc-v8-contact');
    const avatar=node('span','tc-v8-contact-avatar','?');
    const summary=node('div','tc-v8-summary');
    const person=node('strong','tc-v8-person','Votre correspondant');
    const service=node('span','tc-v8-service','Appel Taskly');
    summary.append(person,service);
    const badge=node('span','tc-v8-online','● En ligne');badge.hidden=true;
    contact.append(avatar,summary,badge);
    const topActions=node('div','tc-v8-top-actions');
    const devices=button('Appareils','device','tc-v8-devices');
    const expand=button('Plein écran','expand','tc-v8-expand');
    const more=button('Plus','more','tc-v8-more');
    topActions.append(devices,expand,more);top.append(contact,topActions);
    const hero=node('div','tc-v8-hero');
    const heroAvatar=node('span','tc-v8-avatar','?');
    const heroName=node('h2','tc-v8-name','Votre correspondant');
    const state=node('p','tc-v8-call-state');
    const liveDot=node('span','tc-v8-live-dot');liveDot.setAttribute('aria-hidden','true');
    const kind=node('span','tc-v8-kind','Connexion…');state.append(liveDot,kind);
    const clock=node('div','tc-v8-clock');clock.append(icon('signal'));
    const duration=node('time','tc-v8-duration','00:00');clock.append(duration);
    const wave=node('div','tc-v8-wave');wave.setAttribute('aria-hidden','true');
    [3,5,8,12,17,23,32,43,59,72,59,43,32,23,17,12,8,5,3].forEach(h=>{
      const bar=node('i','');bar.style.height=h+'%';wave.append(bar);
    });
    const videoStage=node('div','tc-v8-video');
    const existingVideos=panel.querySelector('.tc-videos');if(existingVideos)videoStage.append(existingVideos);
    const remoteLabel=node('span','tc-v9-remote-label','Correspondant');
    const localLabel=node('span','tc-v9-local-label','Vous');
    videoStage.append(remoteLabel,localLabel);
    hero.append(heroAvatar,heroName,state,clock,wave,videoStage);
    const actionArea=node('div','tc-v8-actions');const buttons={};
    for (const [key,label,glyph] of [
      ['mic','Micro','mic'],['camera','Caméra','camera'],['sound','Haut-parleur','sound'],
      ['share','Partager l’écran','share'],['chat','Messagerie','chat'],['more','Plus','more']
    ]) {
      const b=button(label,glyph,'tc-v8-action');b.dataset.tcV8Action=key;
      buttons[key]=b;
      if(key==='chat') {const unread=node('span','tc-v8-unread');unread.hidden=true;
        unread.setAttribute('aria-live','polite');b.append(unread);infoSetUnread(unread);}
      actionArea.append(b);
    }
    const incomingRow=node('div','tc-v8-incoming');incomingRow.hidden=true;
    const reject=button('Refuser','hang','tc-v8-reject');
    const accept=button('Décrocher','mic','tc-v8-accept');
    incomingRow.append(reject,accept);
    reject.addEventListener('click',()=>dialog.querySelector('[data-tc=reject]')?.click());
    accept.addEventListener('click',()=>dialog.querySelector('[data-tc=accept]')?.click());
    const hang=button('Raccrocher','hang','tc-v8-hang');
    const feedback=node('p','tc-v8-feedback');feedback.setAttribute('role','status');feedback.hidden=true;
    const bottom=node('div','tc-v8-bottom-art');bottom.setAttribute('aria-hidden','true');
    bottom.innerHTML='<svg viewBox="0 0 1200 100" preserveAspectRatio="none"><path fill="#a8efd0" d="M0 30Q180 20 360 65T730 70T1200 10V100H0Z"/><path fill="#008557" d="M0 71Q130 28 240 56T550 98T970 71T1200 56V100H0Z"/></svg>';
    const drawer=node('div','tc-v8-drawer');
    const premiumDevicePanel=panel.querySelector('.tc-premium-device-panel');
    if(premiumDevicePanel)drawer.append(premiumDevicePanel);
    const menu=node('div','tc-v8-menu');menu.hidden=true;
    for (const [label,fn] of [
      ['Choisir les appareils',()=>devices.click()],
      ['Plein écran / Restaurer',()=>notify('max')],
      ['Retour à la messagerie',()=>notify('chat')]
    ]) {const b=node('button','',label);b.type='button';b.addEventListener('click',()=>{menu.hidden=true;fn();});menu.append(b);}
    board.append(top,hero,actionArea,incomingRow,hang,feedback,drawer,menu,bottom);
    panel.append(board);
    // Only suppress the legacy presentation once the replacement is mounted.
    // Without this marker, a JS error leaves the original call UI usable.
    dialog.dataset.tasklyV8Ready='1';
    const info={dialog,instance,board,avatar,person,service,badge,presence:badge,heroAvatar,
      heroName,kind,duration,feedback,buttons,menu,drawer,incomingRow,hang,actionArea,videoRemoteLabel:remoteLabel,timer:null,unreadTimer:null};
    instances.set(dialog,info);
    devices.addEventListener('click',()=>{
      const native=dialog.querySelector('.tc-premium-extra');
      if (native) native.click();else status(info,'Choix des appareils indisponible.');
      menu.hidden=true;
    });
    expand.addEventListener('click',()=>notify('max'));
    more.addEventListener('click',()=>{menu.hidden=!menu.hidden;});
    buttons.more.addEventListener('click',()=>{menu.hidden=!menu.hidden;});
    buttons.mic.addEventListener('click',()=>{
      if(!instance.active)return;instance.toggleMicrophone();sync(info);
    });
    buttons.camera.addEventListener('click',()=>{
      if(!instance.active || instance.active.mode!=='video')return;
      instance.toggleCamera();sync(info);
    });
    buttons.sound.addEventListener('click',async()=>{
      if(!instance.active)return;
      const remote=instance.get?.('remote');if(!remote)return;
      if(remote.paused){try{remote.muted=false;await remote.play();}catch{
        status(info,'Lecture audio bloquée : autorisez le son dans votre navigateur.');return;}}
      else remote.muted=!remote.muted;
      sync(info);
    });
    buttons.share.addEventListener('click',async()=>{
      const room=instance.active?.media?.room;
      if(dialog.dataset.premiumStage!=='connected') {
        status(info,'Attendez la connexion avant de partager votre écran.');return;
      }
      if(typeof room?.localParticipant?.setScreenShareEnabled!=='function'){
        status(info,'Le partage d’écran n’est pas disponible sur cette connexion.');return;
      }
      buttons.share.disabled=true;
      try {
        const next=buttons.share.getAttribute('aria-pressed')!=='true';
        await room.localParticipant.setScreenShareEnabled(next);
        buttons.share.setAttribute('aria-pressed',String(next));
        buttons.share.classList.toggle('is-active',next);
        status(info,next?'Partage d’écran activé.':'Partage d’écran arrêté.');
      } catch { status(info,'Partage d’écran refusé ou indisponible.'); }
      finally {buttons.share.disabled=false;}
    });
    buttons.chat.addEventListener('click',()=>notify('chat'));
    hang.addEventListener('click',()=>{
      if(instance.active) void instance.finish(instance.active.incoming && !instance.active.accepted?'reject':'end');
    });
    const observer=new MutationObserver(mutations=>{
      if(!mutations.some(m=>m.type==='attributes' && (m.attributeName==='data-premium-stage'||m.attributeName==='data-mode')))return;
      sync(info);
    });
    observer.observe(dialog,{attributes:true,attributeFilter:['data-premium-stage','data-mode']});
    dialog.addEventListener('close',()=>{
      clearInterval(info.timer);info.timer=null;
      clearInterval(info.unreadTimer);info.unreadTimer=null;
    });
    const checkUnread=async()=>{
      if(!dialog.open || typeof window.requeteAPI!=='function')return;
      try {
        const payload=await window.requeteAPI('/api/demandes/chat/unread');
        const total=payload?.total;
        if(!Number.isSafeInteger(total) || total<0)throw Error('invalid counter');
        const badge=board.querySelector('.tc-v8-unread');
        badge.hidden=total===0;badge.textContent=total>99?'99+':String(total);
        buttons.chat.setAttribute('aria-label',total ? `Messagerie : ${total} messages non lus` : 'Messagerie');
      } catch {const badge=board.querySelector('.tc-v8-unread');if(badge)badge.hidden=true;}
    };
    info.resumeUnread=()=>{
      if(!info.unreadTimer) info.unreadTimer=setInterval(checkUnread,20000);
      void checkUnread();
    };
    info.resumeUnread();
    sync(info);
  }
  // A separate helper keeps the unread badge a DOM child, never untrusted HTML.
  function infoSetUnread(unread){unread.textContent='';}
  const previousShow=UI.show;
  if(typeof previousShow==='function') {
    UI.show=function(...args) {
      const result=previousShow.apply(this,args);
      attach(this.dialog,this);
      return result;
    };
  }
  window.TasklyCallMaquetteV8=Object.freeze({version,isHost});
})();
