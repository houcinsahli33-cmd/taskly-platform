/* Ajout non destructif : l'annuaire Liste fonctionne sans cartes ni geolocalisation. */
document.addEventListener('DOMContentLoaded',()=>{
 const mapPanel=document.getElementById('taskly-artisans-map-panel'),grille=document.getElementById('artisans-grid');
 if(!mapPanel||!grille)return;
 const status=document.getElementById('taskly-artisans-map-status');
 const heading=document.getElementById('taskly-map-heading');
 const selectRayon=document.getElementById('taskly-map-radius');
 function choisirRayon(value){
  if(!['5','10','25'].includes(value))return;
  selectRayon.value=value;
  document.querySelectorAll('[data-map-radius]').forEach(b=>{const on=b.dataset.mapRadius===value;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
  if(!mapPanel.hidden)montrerCarte();
 }
 document.querySelectorAll('[data-map-radius]').forEach(b=>b.addEventListener('click',()=>choisirRayon(b.dataset.mapRadius)));
 let carte=null,markers=null,userPos=null,geoAttempted=false,leafletPromise=null,requeteCourante=0;
 function leaflet(){
  if(leafletPromise)return leafletPromise;
  leafletPromise=new Promise((resolve,reject)=>{
   if(window.L)return resolve(window.L);
   const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.append(css);
   const js=document.createElement('script');js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';js.onload=()=>resolve(window.L);js.onerror=()=>{leafletPromise=null;reject(Error('Carte indisponible.'));};document.head.append(js);
  });return leafletPromise;
 }
 const valid=id=>/^[1-9]\d*$/.test(String(id));
 async function montrerCarte(){
  const numeroRequete=++requeteCourante;
  const boutons=document.querySelectorAll('[data-artisan-view]');boutons.forEach(b=>{const sel=b.dataset.artisanView==='carte';b.classList.toggle('primary',sel);b.classList.toggle('outline',!sel);b.setAttribute('aria-pressed',String(sel));});heading.hidden=false;
  grille.hidden=true;mapPanel.hidden=false;document.querySelector('.load-more-artisans-wrap')?.setAttribute('hidden','');status.textContent='Recherche des artisans proches…';
  try{
   const L=await leaflet();
   if(numeroRequete!==requeteCourante||mapPanel.hidden)return;
   if(!carte){carte=L.map('taskly-artisans-map').setView([28.03,2.7],5);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:18}).addTo(carte);markers=L.layerGroup().addTo(carte);}
   requestAnimationFrame(()=>{if(!mapPanel.hidden)carte.invalidateSize();});
   if(!geoAttempted&&navigator.geolocation){
    geoAttempted=true;
    userPos=await new Promise(resolve=>navigator.geolocation.getCurrentPosition(p=>resolve([p.coords.latitude,p.coords.longitude]),()=>resolve(null),{enableHighAccuracy:false,timeout:5500}));
   }
   if(numeroRequete!==requeteCourante||mapPanel.hidden)return;
   const params=new URLSearchParams(construireQueryArtisans());
   params.set('rayonKm',document.getElementById('taskly-map-radius').value);
   if(userPos){params.set('lat',userPos[0]);params.set('lon',userPos[1]);}
   const {artisans}=await requeteAPI('/api/artisans/carte?'+params);
   if(numeroRequete!==requeteCourante||mapPanel.hidden)return;
   markers.clearLayers();const limites=[];
   if(userPos){L.circleMarker(userPos,{radius:7,color:'#2563eb',fillColor:'#3b82f6',fillOpacity:.8}).addTo(markers);limites.push(userPos);}
   (artisans||[]).forEach(a=>{
    const pt=[Number(a.lat),Number(a.lon)];if(!Number.isFinite(pt[0])||!Number.isFinite(pt[1]))return;
    const nom=[a.prenom,a.nom].filter(Boolean).join(' ');
    const card=document.createElement('div');card.textContent=nom+' — '+(a.service_nom||'Artisan');
    const link=document.createElement('a');link.href='/artisan-profile.html?id='+Number(a.id);link.textContent='Voir le profil';link.style.display='block';card.append(link);
    L.circleMarker(pt,{radius:9,color:'#007e64',fillColor:'#009f7f',fillOpacity:.85}).bindPopup(card).addTo(markers);limites.push(pt);
   });
   if(limites.length)carte.fitBounds(limites,{padding:[35,35],maxZoom:12});
   const count=(artisans||[]).length;
   status.textContent=count+' artisan(s) avec une zone publique renseignée'+(userPos?' à proximité.':'.')+
     (count===0?' Aucun artisan trouvé dans ce rayon. Essayez un rayon plus large.':(!userPos?' Autorisez la localisation pour filtrer par distance.':''));
  }catch(e){if(numeroRequete!==requeteCourante)return; status.textContent='Carte indisponible. Vous pouvez revenir à la liste des artisans.';}
 }
 document.querySelector('[data-artisan-view="carte"]')?.addEventListener('click',montrerCarte);
 document.querySelector('[data-artisan-view="liste"]')?.addEventListener('click',()=>{requeteCourante++;heading.hidden=true;mapPanel.hidden=true;grille.hidden=false;document.querySelector('.load-more-artisans-wrap')?.removeAttribute('hidden');document.querySelectorAll('[data-artisan-view]').forEach(b=>{const on=b.dataset.artisanView==='liste';b.classList.toggle('primary',on);b.classList.toggle('outline',!on);b.setAttribute('aria-pressed',String(on));});});
 document.getElementById('taskly-map-radius')?.addEventListener('change',()=>{if(!mapPanel.hidden)montrerCarte();});
 document.getElementById('artisans-filter-form')?.addEventListener('submit',()=>{if(!mapPanel.hidden)montrerCarte();});
});