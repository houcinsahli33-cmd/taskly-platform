/* TASKLY_ZONE_COMPACT : la position n'est demandee qu'apres consentement. */
document.addEventListener('DOMContentLoaded',async()=>{
 await attendreSession();
 if(window.utilisateurCourant?.role!=='artisan')return;
 const cible=document.getElementById('profil');if(!cible||document.getElementById('taskly-zone-card'))return;
 const card=document.createElement('section');card.id='taskly-zone-card';card.className='panel mt-22';
 card.innerHTML=`<div class="panel-header"><h2><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>Ma zone publique sur la carte</h2><span class="zone-state" data-zone-state role="status">Chargement…</span></div><div class="panel-body"><div class="zone-art" aria-hidden="true"><svg viewBox="0 0 84 76"><path d="m5 17 24-9 26 9 24-9v49l-24 10-26-10-24 10z" fill="#daf4e7" stroke="#94cfb9" stroke-width="1.5"/><path d="M29 8v49M55 17v50M7 40l22-12 26 16 22-15" fill="none" stroke="#fff" stroke-width="5"/><circle cx="42" cy="34" r="22" fill="#85d2b3" opacity=".45"/><path d="M56 29c0 10-14 22-14 22S28 39 28 29a14 14 0 0 1 28 0Z" fill="#087f63"/><circle cx="42" cy="29" r="5" fill="#fff"/></svg></div><div class="zone-main"><p class="muted">Facultatif. Une position approximative (arrondie à plusieurs kilomètres) permet aux clients proches de découvrir votre profil sans révéler votre adresse personnelle.</p><div class="request-actions"><button class="btn primary" type="button" data-zone-add disabled>Partager ma zone approximative</button><button class="btn outline" type="button" data-zone-remove disabled>Ne plus apparaître sur la carte</button></div><p id="taskly-zone-feedback" aria-live="polite"></p></div></div>`;
 cible.insertAdjacentElement('afterend',card);
 const status=card.querySelector('#taskly-zone-feedback'),state=card.querySelector('[data-zone-state]'),add=card.querySelector('[data-zone-add]'),remove=card.querySelector('[data-zone-remove]');
 let busy=false;
 function afficher(visible){state.dataset.state=visible===true?'on':visible===false?'off':'unknown';state.textContent=visible===true?'Zone partagée':visible===false?'Zone masquée':'État indisponible';}
 function verrouiller(v){busy=v;add.disabled=v;remove.disabled=v;}
 async function actualiser(){try{const r=await requeteAPI('/api/artisans/ma-zone',{cache:'no-store'});if(typeof r.visible!=='boolean')throw Error('État invalide');afficher(r.visible);}catch{afficher(null);}}
 add.addEventListener('click',()=>{
  if(busy)return;
  if(!navigator.geolocation){status.textContent='Géolocalisation indisponible.';return;}
  if(!confirm('Partager uniquement votre zone approximative sur la carte Taskly ? Vous pouvez la retirer à tout moment.'))return;
  verrouiller(true);status.textContent='Localisation en cours…';
  function erreurLocalisation(){status.textContent='Accès à la localisation refusé ou indisponible.';verrouiller(false);}
  try{navigator.geolocation.getCurrentPosition(async pos=>{
   try{const r=await requeteAPI('/api/artisans/ma-zone',{method:'PUT',body:JSON.stringify({lat:pos.coords.latitude,lon:pos.coords.longitude})});status.textContent=r.message||'Zone enregistrée.';}
   catch(e){status.textContent=e.message||'Enregistrement impossible.';}
   finally{await actualiser();verrouiller(false);}
  },erreurLocalisation,{enableHighAccuracy:false,timeout:15000,maximumAge:60000});}catch{erreurLocalisation();}
 });
 remove.addEventListener('click',async()=>{if(busy)return;verrouiller(true);try{const r=await requeteAPI('/api/artisans/ma-zone',{method:'DELETE'});status.textContent=r.message||'Zone retirée.';}catch(e){status.textContent=e.message||'Opération indisponible.';}finally{await actualiser();verrouiller(false);}});
 verrouiller(true);await actualiser();verrouiller(false);
});
