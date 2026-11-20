'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 const $=id=>document.getElementById(id),form=$('ta-form');if(!form)return;
 await attendreSession();if(window.utilisateurCourant?.role!=='artisan')return;
 const fields=$('ta-fields'),duration=$('ta-duration'),fast=$('ta-fast'),current=$('ta-current'),msg=$('ta-message'),retry=$('ta-retry');
 const radios=Array.from(form.querySelectorAll('input[name="ta-status"]'));
 const labels={non_renseignee:'Non renseignée',disponible:'Disponible',occupe:'Occupé temporairement',indisponible:'Indisponible'};
 const status=()=>radios.find(r=>r.checked)?.value||'non_renseignee';
 let expiration=0,busy=false,dirty=false,planningBusy=false;
 const formatter=new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Algiers',hourCycle:'h23'});
 const durationButtons=Array.from(form.querySelectorAll('[data-ta-duration]'));
 const exact=$('ta-exact'), exactWrap=$('ta-exact-wrap');
 let durationMode=duration.value==='2'?'2':'other';
 // Les dates saisies sont en heure algérienne (UTC+01:00), indépendamment du navigateur.
 function algerieInput(ms){return new Date(ms+3600000).toISOString().slice(0,16);}
 function utcFromInput(value){return Date.parse(value+':00+01:00');}
 function durationControls(){
   const inactive=fields.disabled||status()==='non_renseignee';
   for(const b of durationButtons){b.disabled=inactive;b.setAttribute('aria-pressed',String(b.dataset.taDuration===durationMode));}
   $('ta-custom-duration').hidden=durationMode!=='other';
   duration.disabled=inactive||durationMode!=='other';
   exactWrap.hidden=durationMode!=='precise';exact.disabled=inactive||durationMode!=='precise';exact.required=!exact.disabled;
   if(!exact.disabled){const now=Date.now();exact.min=algerieInput(Math.floor(now/60000)*60000+60000);exact.max=algerieInput(now+7*86400000);}
 }
 function controls(){fast.disabled=status()!=='disponible';if(fast.disabled)fast.checked=false;durationControls();}
 for(const button of durationButtons){button.addEventListener('click',()=>{
   if(button.disabled||fields.disabled)return;
   durationMode=button.dataset.taDuration;
   if(durationMode==='2')duration.value='2';
   dirty=true;controls();if(durationMode==='other')duration.focus();
   if(durationMode==='precise'){if(!exact.value||utcFromInput(exact.value)<=Date.now())exact.value=algerieInput(Math.ceil((Date.now()+3600000)/60000)*60000);exact.focus();}
 });}
 function availabilityPayload(selected){
   const payload={statut:selected,rapide:selected==='disponible'&&fast.checked};
   if(selected==='non_renseignee')return {...payload,duree:0};
   if(durationMode==='other'||durationMode==='2')return {...payload,duree:Number(duration.value)};
   const now=Date.now(), value=durationMode==='tonight'?algerieInput(now).slice(0,10)+'T23:59':exact.value;
   const end=utcFromInput(value);
   if(!Number.isFinite(end)||end<=now||end>now+7*86400000)throw Error('Choisissez une heure future, dans les 7 prochains jours.');
   return {...payload,expiration:new Date(end).toISOString()};
 }
 function paint(d){
   if(!d||!Object.hasOwn(labels,d.disponibilite_statut))throw Error('Réponse invalide');
   const mission=Number(d.intervention_en_cours)===1;
   const seconds=Number(d.disponibilite_secondes)||0;
   const actual=mission||seconds>0?d.disponibilite_statut:'non_renseignee';
   const manuel=Object.hasOwn(labels,d.statut_manuel)?d.statut_manuel:actual;
   const remaining=Number(d.secondes_manuelles??d.disponibilite_secondes)||0;
   $('ta-current-box').dataset.status=actual;current.textContent='Statut actuel : '+labels[actual]+(mission?' · Intervention en cours':actual==='disponible'&&Number(d.intervention_rapide)===1?' · Intervention rapide':'');
   expiration=remaining>0?Date.now()+remaining*1000:0;
   const texteExpiration=expiration?'Expire le '+formatter.format(expiration)+' (heure d’Algérie)':'Aucun statut temporaire actif.';
   $('ta-expiration').textContent=mission?'Choix manuel : '+labels[manuel]+' · '+texteExpiration:texteExpiration;
   return manuel;
 }
 function show(d){const manuel=paint(d);radios.forEach(r=>{r.checked=r.value===manuel;});fast.checked=manuel==='disponible'&&Number(d.rapide_manuel??d.intervention_rapide)===1;dirty=false;controls();}
 async function load(){if(busy)return;busy=true;fields.disabled=true;retry.hidden=true;msg.textContent='';try{const data=await requeteAPI('/api/artisans/ma-disponibilite',{cache:'no-store'});show(data.disponibilite);fields.disabled=false;controls();}catch(e){$('ta-current-box').dataset.status='non_renseignee';current.textContent='Impossible de lire votre disponibilité.';$('ta-expiration').textContent='';msg.textContent='Réessayez.';retry.hidden=false;}finally{busy=false;}}
 form.addEventListener('change',()=>{dirty=true;controls();});retry.addEventListener('click',load);
 form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const selected=status();let payload;try{payload=availabilityPayload(selected);}catch(e){msg.textContent=e.message;return;}busy=true;fields.disabled=true;retry.hidden=true;msg.textContent='Enregistrement…';try{const data=await requeteAPI('/api/artisans/ma-disponibilite',{method:'PUT',body:JSON.stringify(payload)});show(data.disponibilite);msg.textContent='Disponibilité enregistrée.';fields.disabled=false;controls();}catch(e){msg.textContent='Enregistrement incertain ou refusé. Rechargez le statut.';retry.hidden=false;}finally{busy=false;controls();}});
 // Lecture sans écraser les réglages non enregistrés, ni l’état manuel.
 async function refresh(){
   if(busy||document.hidden)return;busy=true;
   try{const data=await requeteAPI('/api/artisans/ma-disponibilite',{cache:'no-store'});if(dirty)paint(data.disponibilite);else show(data.disponibilite);}
   catch(e){$('ta-current-box').dataset.status='non_renseignee';current.textContent='Statut actuel non vérifié.';$('ta-expiration').textContent='Actualisez pour vérifier la disponibilité.';expiration=0;}
   finally{busy=false;}
 }
 setInterval(()=>{if(expiration&&Date.now()>=expiration&&!busy)refresh();},1000);
 setInterval(()=>{refresh();if(!document.hidden)planning();},30000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){refresh();planning();}});
 async function planning(){
   if(planningBusy||document.hidden)return;planningBusy=true;
   try{
     const data=await requeteAPI('/api/demandes/artisan',{cache:'no-store'});if(!Array.isArray(data.demandes))throw Error('Réponse invalide');
     const accepted=data.demandes.filter(d=>d.statut==='acceptee'), confirmations=data.demandes.filter(d=>d.statut==='attente_confirmation');
     const active=accepted.filter(d=>d.intervention_debut_utc);
     $('ta-planning-status').textContent=`${accepted.length} demande(s) acceptée(s) · ${active.length} intervention(s) en cours · ${confirmations.length} en attente de confirmation.`;
     const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Africa/Algiers',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
     const date=d=>String(d.date_souhaitee||'').slice(0,10);
     const next=accepted.filter(d=>!d.intervention_debut_utc&&/^\d{4}-\d{2}-\d{2}$/.test(date(d))&&date(d)>=today).sort((a,b)=>date(a).localeCompare(date(b))||(a.creneau_debut_minute??1440)-(b.creneau_debut_minute??1440))[0];
     const heure=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
     const horaire=next&&Number.isInteger(next.creneau_debut_minute)&&Number.isInteger(next.creneau_fin_minute)?' · '+heure(next.creneau_debut_minute)+' – '+heure(next.creneau_fin_minute):' (horaire non défini)';
     $('ta-planning-next').textContent=next?'Prochaine date souhaitée : '+date(next).split('-').reverse().join('/')+horaire:'Aucune prochaine date souhaitée renseignée.';
   }catch(e){$('ta-planning-status').textContent='Planning temporairement indisponible.';$('ta-planning-next').textContent='';}finally{planningBusy=false;}
 }
 load();planning();
});
