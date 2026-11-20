'use strict';
(function(root){
 const labels=Object.freeze({non_renseignee:'Non renseignée',disponible:'Disponible',occupe:'Occupé',indisponible:'Indisponible'});
 function normalize(a){const s=Object.hasOwn(labels,a?.disponibilite_statut)?a.disponibilite_statut:'non_renseignee';const seconds=Number(a?.disponibilite_secondes)||0;const statut=seconds>0?s:'non_renseignee';return {statut,rapide:statut==='disponible'&&Number(a?.intervention_rapide)===1,secondes:Math.max(0,seconds)};}
 function html(a){const d=normalize(a);return `<span class="ta-state"${d.secondes>0&&d.statut!=='non_renseignee'?` data-ta-expires="${Math.floor(Date.now()+d.secondes*1000)}"`:''}><span class="ta-badge ta-${d.statut}">${labels[d.statut]}</span>`+(d.rapide?' <span class="ta-badge ta-fast">Intervention rapide</span>':'')+'</span>';}
 function marker(items){const states=new Set(items.map(a=>normalize(a).statut));return states.size===1?[...states][0]:'mixte';}
 const api={normalize,html,marker,labels};if(typeof module==='object'&&module.exports)module.exports=api;else {root.TasklyDisponibilite=api;
 const expire=()=>{let changed=false;document.querySelectorAll('[data-ta-expires]').forEach(el=>{if(Number(el.dataset.taExpires)<=Date.now()){el.removeAttribute('data-ta-expires');el.innerHTML=html({});changed=true;}});if(changed)document.dispatchEvent(new Event('taskly:availability-expired'));};
 setInterval(expire,15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)expire();});
 }
})(typeof window!=='undefined'?window:globalThis);
