'use strict';
(function(root){
 const labels=Object.freeze({non_renseignee:'Non renseignée',disponible:'Disponible',occupe:'Occupé',indisponible:'Indisponible'});
 function normalize(a){const s=Object.hasOwn(labels,a?.disponibilite_statut)?a.disponibilite_statut:'non_renseignee';const seconds=Number(a?.disponibilite_secondes)||0;const mission=Number(a?.intervention_en_cours)===1;const statut=mission?(s==='indisponible'&&seconds>0?s:'occupe'):seconds>0?s:'non_renseignee';return {statut,rapide:!mission&&statut==='disponible'&&Number(a?.intervention_rapide)===1,secondes:Math.max(0,seconds),mission};}
 function html(a){const d=normalize(a);return `<span class="ta-state"${d.secondes>0&&d.statut!=='non_renseignee'?` ${d.mission?'data-ta-refresh':'data-ta-expires'}="${Math.floor(Date.now()+d.secondes*1000)}"`:''}><span class="ta-badge ta-${d.statut}">${labels[d.statut]}</span>`+(d.rapide?' <span class="ta-badge ta-fast">Intervention rapide</span>':'')+'</span>';}
 function marker(items){const states=new Set(items.map(a=>normalize(a).statut));return states.size===1?[...states][0]:'mixte';}
 // Une lecture périodique, jamais plusieurs requêtes de rafraîchissement en parallèle.
 function surveiller(refresh,doc=document,host=window){
  let timer=null,running=false,stopped=false,last=0,failures=0,controller=null;
  const clear=()=>{if(timer!==null)host.clearTimeout(timer);timer=null;};
  function schedule(delay){clear();if(!stopped&&!doc.hidden)timer=host.setTimeout(tick,delay);}
  async function tick(){
   clear();if(stopped||doc.hidden||running)return;
   running=true;last=Date.now();controller=new AbortController();
   const timeout=host.setTimeout(()=>controller?.abort(),12000);
   try{await refresh(controller.signal);failures=0;}catch{failures=Math.min(2,failures+1);}
   finally{host.clearTimeout(timeout);controller=null;running=false;schedule(30000*2**failures);}
  }
  function visible(){if(doc.hidden){clear();controller?.abort();}else if(!running)schedule(Math.max(0,5000-(Date.now()-last)));}
  doc.addEventListener('visibilitychange',visible);host.addEventListener('focus',visible);
  schedule(30000);
  return ()=>{stopped=true;clear();controller?.abort();doc.removeEventListener('visibilitychange',visible);host.removeEventListener('focus',visible);};
 }
 function actualiserBadge(el,a){if(!el)return;el.innerHTML=html(a);if(!a)el.querySelector('.ta-badge').textContent='Statut non vérifié';}
 const api={normalize,html,marker,labels,surveiller,actualiserBadge};if(typeof module==='object'&&module.exports)module.exports=api;else {root.TasklyDisponibilite=api;
 const expire=()=>{let changed=false;document.querySelectorAll('[data-ta-expires]').forEach(el=>{if(Number(el.dataset.taExpires)<=Date.now()){el.removeAttribute('data-ta-expires');el.innerHTML=html({});changed=true;}});document.querySelectorAll('[data-ta-refresh]').forEach(el=>{if(Number(el.dataset.taRefresh)<=Date.now()){el.removeAttribute('data-ta-refresh');changed=true;}});if(changed)document.dispatchEvent(new Event('taskly:availability-expired'));};
 setInterval(expire,15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)expire();});
 }
})(typeof window!=='undefined'?window:globalThis);
