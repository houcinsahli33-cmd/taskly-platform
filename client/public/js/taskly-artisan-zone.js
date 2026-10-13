document.addEventListener('DOMContentLoaded',async()=>{
 await attendreSession();
 if(window.utilisateurCourant?.role!=='artisan')return;
 const card=document.createElement('section');card.className='panel mt-22';card.innerHTML=`<div class="panel-header"><h2>Ma zone publique sur la carte</h2></div><div class="panel-body"><p class="muted">Facultatif. Une position approximative (arrondie à plusieurs kilomètres) permet aux clients proches de découvrir votre profil sans révéler votre adresse personnelle.</p><div class="request-actions"><button class="btn primary" type="button" data-zone-add>Partager ma zone approximative</button><button class="btn outline" type="button" data-zone-remove>Ne plus apparaître sur la carte</button></div><p id="taskly-zone-feedback" aria-live="polite"></p></div>`;
 const cible=document.getElementById('profil');if(cible)cible.insertAdjacentElement('afterend',card);
 const status=card.querySelector('#taskly-zone-feedback');
 card.querySelector('[data-zone-add]').addEventListener('click',()=>{
  if(!navigator.geolocation){status.textContent='Géolocalisation indisponible.';return;}
  if(!confirm('Partager uniquement votre zone approximative sur la carte Taskly ? Vous pouvez la retirer à tout moment.'))return;
  status.textContent='Localisation en cours…';
  navigator.geolocation.getCurrentPosition(async pos=>{
   try{const r=await requeteAPI('/api/artisans/ma-zone',{method:'PUT',body:JSON.stringify({lat:pos.coords.latitude,lon:pos.coords.longitude})});status.textContent=r.message}
   catch(e){status.textContent=e.message||'Enregistrement impossible.';}
  },()=>{status.textContent='Accès à la localisation refusé ou indisponible.'},{enableHighAccuracy:false,timeout:15000,maximumAge:60000});
 });
 card.querySelector('[data-zone-remove]').addEventListener('click',async()=>{try{const r=await requeteAPI('/api/artisans/ma-zone',{method:'DELETE'});status.textContent=r.message}catch(e){status.textContent=e.message||'Opération indisponible.'}});
});