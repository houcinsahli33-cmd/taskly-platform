'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 const $=id=>document.getElementById(id),form=$('ta-form');if(!form)return;
 await attendreSession();if(window.utilisateurCourant?.role!=='artisan')return;
 const fields=$('ta-fields'),duration=$('ta-duration'),fast=$('ta-fast'),current=$('ta-current'),msg=$('ta-message'),retry=$('ta-retry');
 const radios=Array.from(form.querySelectorAll('input[name="ta-status"]'));
 const labels={non_renseignee:'Non renseignée',disponible:'Disponible',occupe:'Occupé temporairement',indisponible:'Indisponible'};
 const status=()=>radios.find(r=>r.checked)?.value||'non_renseignee';
 let expiration=0,busy=false,dirty=false;
 const formatter=new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Algiers',hourCycle:'h23'});
 function controls(){duration.disabled=status()==='non_renseignee';fast.disabled=status()!=='disponible';if(fast.disabled)fast.checked=false;}
 function paint(d){
   if(!d||!Object.hasOwn(labels,d.disponibilite_statut))throw Error('Réponse invalide');
   const seconds=Number(d.disponibilite_secondes)||0;
   const actual=seconds>0?d.disponibilite_statut:'non_renseignee';
   $('ta-current-box').dataset.status=actual;current.textContent='Statut actuel : '+labels[actual]+(actual==='disponible'&&Number(d.intervention_rapide)===1?' · Intervention rapide':'');
   expiration=actual==='non_renseignee'?0:Date.now()+seconds*1000;
   $('ta-expiration').textContent=expiration?'Expire le '+formatter.format(expiration)+' (heure d’Algérie)':'Aucun statut temporaire actif.';
   return actual;
 }
 function show(d){const actual=paint(d);radios.forEach(r=>{r.checked=r.value===actual;});fast.checked=actual==='disponible'&&Number(d.intervention_rapide)===1;dirty=false;controls();}
 async function load(){if(busy)return;busy=true;fields.disabled=true;retry.hidden=true;msg.textContent='';try{const data=await requeteAPI('/api/artisans/ma-disponibilite',{cache:'no-store'});show(data.disponibilite);fields.disabled=false;}catch(e){$('ta-current-box').dataset.status='non_renseignee';current.textContent='Impossible de lire votre disponibilité.';$('ta-expiration').textContent='';msg.textContent='Réessayez.';retry.hidden=false;}finally{busy=false;}}
 form.addEventListener('change',()=>{dirty=true;controls();});retry.addEventListener('click',load);
 form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const selected=status();busy=true;fields.disabled=true;retry.hidden=true;msg.textContent='Enregistrement…';try{const data=await requeteAPI('/api/artisans/ma-disponibilite',{method:'PUT',body:JSON.stringify({statut:selected,duree:selected==='non_renseignee'?0:Number(duration.value),rapide:selected==='disponible'&&fast.checked})});show(data.disponibilite);msg.textContent='Disponibilité enregistrée.';fields.disabled=false;}catch(e){msg.textContent='Enregistrement incertain ou refusé. Rechargez le statut.';retry.hidden=false;}finally{busy=false;controls();}});
 setInterval(()=>{if(expiration&&Date.now()>=expiration&&!busy){expiration=0;if(dirty){$('ta-current-box').dataset.status='non_renseignee';current.textContent='Statut actuel : Non renseignée';$('ta-expiration').textContent='Le statut enregistré a expiré. Vos choix non enregistrés sont conservés.';}else load();}},1000);
 async function planning(){try{const data=await requeteAPI('/api/demandes/artisan',{cache:'no-store'});if(!Array.isArray(data.demandes))throw Error('Réponse invalide');const accepted=data.demandes.filter(d=>d.statut==='acceptee');const confirmations=data.demandes.filter(d=>d.statut==='attente_confirmation');$('ta-planning-status').textContent=`${accepted.length} demande(s) acceptée(s) · ${confirmations.length} en attente de confirmation.`;const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Africa/Algiers',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const next=accepted.map(d=>String(d.date_souhaitee||'').slice(0,10)).filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&s>=today).sort()[0];$('ta-planning-next').textContent=next?'Prochaine date souhaitée : '+next.split('-').reverse().join('/')+' (horaire non défini).':'Aucune prochaine date souhaitée renseignée.';}catch(e){$('ta-planning-status').textContent='Planning temporairement indisponible.';$('ta-planning-next').textContent='';}}
 load();planning();
});
