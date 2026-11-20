'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 const $=id=>document.getElementById(id),form=$('ta-form');if(!form)return;
 await attendreSession();if(window.utilisateurCourant?.role!=='artisan')return;
 const fields=$('ta-fields'),status=$('ta-status'),duration=$('ta-duration'),fast=$('ta-fast'),current=$('ta-current'),msg=$('ta-message'),retry=$('ta-retry');
 const labels={non_renseignee:'Non renseignée',disponible:'Disponible',occupe:'Occupé',indisponible:'Indisponible'};
 let expiration=0, busy=false;
 function controls(){duration.disabled=status.value==='non_renseignee';fast.disabled=status.value!=='disponible';if(fast.disabled)fast.checked=false;}
 function show(d){if(!d||!Object.hasOwn(labels,d.disponibilite_statut))throw Error('Réponse invalide');status.value=d.disponibilite_statut;fast.checked=Number(d.intervention_rapide)===1;expiration=d.disponibilite_statut==='non_renseignee'?0:Date.now()+Math.max(0,Number(d.disponibilite_secondes)||0)*1000;current.textContent='Statut enregistré : '+labels[status.value]+(fast.checked?' · Intervention rapide':'');if(status.value!=='non_renseignee')current.textContent+=' · Expire le '+new Date(expiration).toLocaleString('fr-DZ');controls();}
 async function load(){if(busy)return;busy=true;fields.disabled=true;retry.hidden=true;msg.textContent='';try{const data=await requeteAPI('/api/artisans/ma-disponibilite',{cache:'no-store'});show(data.disponibilite);fields.disabled=false;}catch(e){current.textContent='Impossible de lire votre disponibilité.';msg.textContent='Réessayez.';retry.hidden=false;}finally{busy=false;}}
 status.addEventListener('change',controls);retry.addEventListener('click',load);
 form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;busy=true;fields.disabled=true;msg.textContent='Enregistrement…';try{const data=await requeteAPI('/api/artisans/ma-disponibilite',{method:'PUT',body:JSON.stringify({statut:status.value,duree:status.value==='non_renseignee'?0:Number(duration.value),rapide:status.value==='disponible'&&fast.checked})});show(data.disponibilite);msg.textContent='Disponibilité enregistrée.';}catch(e){msg.textContent='Enregistrement incertain ou refusé. Vérifiez le statut enregistré.';retry.hidden=false;}finally{busy=false;fields.disabled=false;controls();}});
 setInterval(()=>{if(expiration&&Date.now()>=expiration&&!busy){expiration=0;load();}},30000);load();
});
