'use strict';
// Presentation only: retain the real code input and the existing submit listeners.
(() => {
 const make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 function init(){
  if(document.body.dataset.workspacePage!=='profil'||!['client','artisan'].includes(document.body.dataset.requireRole))return;
  function decorate(){
   const verify=document.getElementById('account-email-verify'),request=document.getElementById('account-email-request'),code=document.getElementById('account-email-code'),email=document.getElementById('account-email'),dialog=verify?.closest('dialog.tp-email-dialog');
   if(!dialog||dialog.dataset.tpVerifyReady||!request||!code||!email||!verify.contains(code))return;
   const label=code.closest('label'),submit=verify.querySelector('button[type=submit]'),caption=label?.querySelector('.field-label');
   if(!label||!caption||!submit)return;
   dialog.dataset.tpVerifyReady='1';
   const ns='http://www.w3.org/2000/svg';
   function svg(){const s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 120 120');s.setAttribute('aria-hidden','true');s.innerHTML='<rect x="3" y="3" width="114" height="114" rx="25" fill="#e1f5ec"/><path d="M18 49 60 19l42 30v48H18z" fill="#0b7059"/><rect x="30" y="30" width="60" height="49" rx="7" fill="#fff" stroke="#90cbba"/><g fill="#075e4d" font-size="19" font-weight="bold" text-anchor="middle"><text x="60" y="54">••••••</text></g><path d="m18 49 42 30 42-30v48H18z" fill="#169c74"/><path d="m18 97 42-33 42 33" fill="#087c61"/><circle cx="94" cy="91" r="20" fill="#075c48" stroke="white" stroke-width="3"/><rect x="87" y="89" width="14" height="12" rx="2" fill="none" stroke="white" stroke-width="2"/><path d="M90 89v-4a4 4 0 0 1 8 0v4" fill="none" stroke="white" stroke-width="2"/></svg>'.replace('</svg>','');return s;}
   const layout=make('div','tp-verify-layout'),art=make('div','tp-verify-art'),copy=make('div','tp-verify-copy');art.append(svg());
   const intro=make('p','tp-verify-intro','Un code de vérification a été envoyé à votre nouvelle adresse :');const address=make('p','tp-verify-address');
   const note=make('p','tp-verify-note','Le serveur vérifie la durée de validité du code.');
   const timer=make('div','tp-verify-timer'),timerLabel=make('span','tp-verify-timer-label','Temps restant estimé'),clock=make('strong','tp-verify-clock','03:00'),track=make('div','tp-verify-track'),bar=make('span','tp-verify-bar');
   timer.hidden=true;track.setAttribute('aria-hidden','true');track.append(bar);timer.append(timerLabel,clock,track);
   let interval=0;
   function stopTimer(){if(interval){clearInterval(interval);interval=0;}}
   function refreshTimer(){
    const raw=verify.dataset.tpEmailDeadline,deadline=Number(raw);
    if(verify.hidden||raw===undefined||!Number.isFinite(deadline)){timer.hidden=true;stopTimer();return;}
    timer.hidden=false;
    const ms=Math.max(0,Math.min(180000,deadline-performance.now())),seconds=Math.ceil(ms/1000);
    clock.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    bar.style.width=(ms/180000*100)+'%';timer.classList.toggle('is-expired',ms===0);
    note.textContent=ms===0?'Délai estimé écoulé. Vous pouvez demander un nouveau code. Le serveur décide de sa validité.':'3 minutes maximum, 3 tentatives. Le serveur contrôle la validité.';
    if(ms===0)stopTimer();
   }
   function startTimer(){stopTimer();refreshTimer();if(!verify.hidden&&Number(verify.dataset.tpEmailDeadline)>performance.now())interval=setInterval(refreshTimer,250);}
   verify.addEventListener('taskly:email-code-issued',startTimer);
   const resend=make('button','tp-verify-resend','Demander un nouveau code');resend.type='button';
   const help=make('div','tp-verify-help');help.append(document.createTextNode('Vous ne recevez pas le code ? '),resend);
   label.classList.add('tp-verify-label');caption.textContent='Saisissez le code de vérification';
   code.type='text';code.inputMode='numeric';code.autocomplete='one-time-code';code.maxLength=6;code.pattern='[0-9]{6}';code.required=true;code.setAttribute('aria-label','Code de vérification à six chiffres');
   const otp=make('span','tp-verify-otp');const digits=Array.from({length:6},()=>make('span','tp-verify-digit','–'));digits.forEach(n=>n.setAttribute('aria-hidden','true'));code.before(otp);otp.append(...digits,code);
   function render(){const value=code.value;digits.forEach((n,i)=>{n.textContent=value[i]||'–';n.classList.toggle('is-filled',i<value.length);n.classList.toggle('is-active',i===Math.min(code.selectionStart??value.length,5));});}
   code.addEventListener('input',()=>{const clean=code.value.replace(/[^0-9]/g,'').slice(0,6);if(clean!==code.value)code.value=clean;render();});
   code.addEventListener('paste',e=>{const v=e.clipboardData?.getData('text')||'';const clean=v.replace(/[^0-9]/g,'');if(clean.length===6){e.preventDefault();code.value=clean;code.dispatchEvent(new Event('input',{bubbles:true}));}});
   for(const event of ['focus','click','keyup','select'])code.addEventListener(event,render);
   const actions=make('div','tp-verify-actions'),back=make('button','tp-verify-back','↶  Retour');back.type='button';submit.classList.add('tp-verify-submit');submit.textContent='✓  Vérifier le code';
   label.before(layout);copy.append(caption,intro,address,label,timer,note,help);layout.append(art,copy);submit.before(actions);actions.append(back,submit);
   // On back, require a deliberate fresh password/request. Never send or cancel a server request automatically.
   function returnToRequest(){if(submit.disabled)return;verify.hidden=true;code.value='';render();document.getElementById('account-email-password')?.focus();}
   back.addEventListener('click',returnToRequest);resend.addEventListener('click',returnToRequest);
   function state(){dialog.classList.toggle('tp-verify-active',!verify.hidden);if(!verify.hidden){address.textContent=email.value;code.value='';render();if(dialog.open)code.focus();}else{note.textContent='Le serveur vérifie la durée de validité du code.';}startTimer();}
   new MutationObserver(state).observe(verify,{attributes:true,attributeFilter:['hidden']});
   dialog.addEventListener('close',()=>{code.value='';render();});
   state();
  }
  new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});decorate();
 }
 document.addEventListener('DOMContentLoaded',init);
})();
