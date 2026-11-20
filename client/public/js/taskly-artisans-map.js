/* TASKLY_MAP_PREMIUM_V2 — carte et résultats issus de l'API, sans toucher au header. */
(function () {
 'use strict';
 const RADII=['5','10','25','50'], PAGE=3;
 const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
 function normalize(rows){
  if(!Array.isArray(rows))throw Error('Réponse carte invalide.');
  const seen=new Set(),out=[];
  for(const a of rows){
   if(!a||typeof a!=='object')continue;
   const id=number(a.id),lat=number(a.lat),lon=number(a.lon),n=number(a.moyenne_notes),total=number(a.total_avis),d=number(a.distanceKm);
   if(!Number.isSafeInteger(id)||id<1||seen.has(id)||lat===null||lon===null||Math.abs(lat)>90||Math.abs(lon)>180)continue;
   seen.add(id);out.push({disponibilite_statut:a.disponibilite_statut,intervention_rapide:a.intervention_rapide,disponibilite_secondes:a.disponibilite_secondes,intervention_en_cours:a.intervention_en_cours,id,lat,lon,nom:[a.prenom,a.nom].filter(v=>typeof v==='string').join(' ').trim()||'Artisan Taskly',service:typeof a.service_nom==='string'?a.service_nom:'Artisan',ville:typeof a.ville==='string'?a.ville:'Commune non précisée',photo:a.photo_profil,note:total>0&&n!==null&&n>=0&&n<=5?n:null,nb:Number.isSafeInteger(total)&&total>=0?total:null,distance:d!==null&&d>=0?d:null});
  }return out;
 }
 function rank(rows,sort,well){
  return rows.filter(a=>!well||(a.note!==null&&a.note>=4.5)).sort((a,b)=>{
   const dist=(a.distance??Infinity)-(b.distance??Infinity);
   if(sort==='note')return (b.note??-1)-(a.note??-1)||(b.nb??0)-(a.nb??0)||dist||a.id-b.id;
   return dist||a.id-b.id;
  });
 }
 function approximate(lat,lon){if(number(lat)===null||number(lon)===null||Math.abs(lat)>90||Math.abs(lon)>180)return null;return [Math.round(lat*20)/20,Math.round(lon*20)/20];}
 function group(rows){const g=new Map();for(const a of rows){const k=a.lat+':'+a.lon;if(!g.has(k))g.set(k,[]);g.get(k).push(a);}return [...g.values()];}
 if(typeof module==='object'&&module.exports)module.exports={normalize,rank,approximate,group};
 if(typeof document==='undefined')return;
 document.addEventListener('DOMContentLoaded',()=>{
  const $=id=>document.getElementById(id),panel=$('taskly-artisans-map-panel'),grid=$('artisans-grid'),form=$('artisans-filter-form');
  if(!panel||!grid||!form)return;
  const heading=$('taskly-map-heading'),radius=$('taskly-map-radius'),field=radius.closest('fieldset'),status=$('taskly-artisans-map-status'),out=$('tmp-results'),sort=$('tmp-sort'),well=$('tmp-well'),geo=$('tmp-geo'),clear=$('tmp-clear'),more=$('tmp-more'),retry=$('tmp-retry'),mapEl=$('taskly-artisans-map');
  let map=null,Lref=null,layers=null,leafletPromise=null,center=null,all=[],shown=[],page=0,seq=0,geoSeq=0,selected=null,markerById=new Map(),loading=false,failed=false,mapFailed=false,started=false,queryAppliquee="",actualisation=false,stale=false;
  const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
  const profile=a=>{const x=el('a','tmp-profile','Voir le profil ↗');x.href='/artisan-profile.html?id='+a.id;return x;};
  function image(a){const im=el('img','tmp-avatar');im.alt='';im.loading='lazy';im.decoding='async';let src='/images/defaults/avatar.png';try{const u=new URL(typeof imageProfil==='function'?imageProfil(a.photo):a.photo||src,location.origin);if(u.origin===location.origin&&/^\/(?:images|uploads|api\/media|media)\//.test(u.pathname))src=u.href;}catch{}im.src=src;im.addEventListener('error',()=>{if(!im.src.endsWith('/images/defaults/avatar.png'))im.src='/images/defaults/avatar.png';},{once:true});return im;}
  function updateRadius(v){if(!RADII.includes(v))v='10';radius.value=v;document.querySelectorAll('[data-map-radius]').forEach(b=>{const on=b.dataset.mapRadius===v;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});}
  function switchView(on){panel.hidden=!on;heading.hidden=!on;grid.hidden=on;field.hidden=!on;form.dataset.mapMode=on?'1':'0';form.parentElement.classList.toggle('tmp-map-mode',on);$('tmp-toolbar').hidden=!on;document.querySelectorAll('[data-artisan-view]').forEach(b=>{const active=b.dataset.artisanView===(on?'carte':'liste');b.classList.toggle('primary',active);b.classList.toggle('outline',!active);b.setAttribute('aria-pressed',String(active));});if(!on){seq++;geoSeq++;geo.disabled=false;if(started&&typeof mettreAJourCompteurArtisans==='function')mettreAJourCompteurArtisans();} }
  function getLeaflet(){if(window.L)return Promise.resolve(window.L);if(leafletPromise)return leafletPromise;leafletPromise=new Promise((resolve,reject)=>{const css=el('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.append(css);const js=el('script');js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';let timer=setTimeout(()=>{js.remove();reject(Error('Carte indisponible'));},12000);js.onload=()=>{clearTimeout(timer);window.L?resolve(window.L):reject(Error('Carte indisponible'));};js.onerror=()=>{clearTimeout(timer);js.remove();reject(Error('Carte indisponible'));};document.head.append(js);}).catch(e=>{leafletPromise=null;throw e;});return leafletPromise;}
  async function initMap(){if(map)return;const lib=await getLeaflet();if(panel.hidden)return;if(map)return;Lref=lib;mapEl.replaceChildren();map=lib.map(mapEl).setView([28.03,2.7],5);lib.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:18}).addTo(map);layers=lib.layerGroup().addTo(map);}
  function focusArtisan(id,open){selected=id;const index=shown.findIndex(a=>a.id===id);if(index<0)return;page=Math.floor(index/PAGE);renderCards();const m=markerById.get(id);if(m&&open){map.panTo(m.getLatLng());m.openPopup();}}
  function renderCards(){out.replaceChildren();$('tmp-count').textContent=loading?'…':failed?'—':String(shown.length);const pages=Math.max(1,Math.ceil(shown.length/PAGE));page=Math.max(0,Math.min(page,pages-1));$('tmp-page').textContent=loading||failed?'—':`${page+1} / ${pages}`;$('tmp-prev').disabled=loading||failed||page===0;$('tmp-next').disabled=loading||failed||page>=pages-1;
   const nums=$('tmp-page-buttons');nums.replaceChildren();for(let i=Math.max(0,Math.min(page-2,pages-5));!loading&&!failed&&shown.length&&i<Math.min(pages,Math.max(0,Math.min(page-2,pages-5))+5);i++){const b=el('button','tmp-page-btn',String(i+1));b.type='button';b.setAttribute('aria-label','Page '+(i+1));if(i===page)b.setAttribute('aria-current','page');b.addEventListener('click',()=>{page=i;renderCards();});nums.append(b);} $('tmp-page').classList.toggle('tmp-sr',!loading&&!failed&&shown.length>0);$('tmp-prev').parentElement.hidden=loading||failed||!shown.length;
   if(loading||failed||!shown.length){const box=el('div','tmp-empty');box.setAttribute('role','status');box.append(el('span','tmp-empty-icon',loading?'…':failed?'!':'⌖'),el('h4','',loading?'Recherche en cours':failed?'Recherche indisponible':'Aucun artisan trouvé'),el('p','',loading?'Nous recherchons les profils correspondant à vos critères.':failed?'La recherche a échoué. Vous pouvez réessayer.':well.getAttribute('aria-pressed')==='true'?'Essayez sans le filtre de notation.':center?'Élargissez le rayon ou consultez la liste de tous les artisans.':'Les artisans sans zone publique restent accessibles dans la liste.'));
    if(!loading){const c=el('div','tmp-empty-actions');const act=(label,fn)=>{const b=el('button','tmp-empty-button',label);b.type='button';b.addEventListener('click',fn);c.append(b);};if(failed)act('Réessayer',load);else if(well.getAttribute('aria-pressed')==='true')act('Retirer le filtre de note',()=>well.click());else if(center&&radius.value!=='50')act('Élargir le rayon',()=>more.click());else if(!center)act('Me localiser',()=>geo.click());act('Voir la liste des artisans',()=>document.querySelector('[data-artisan-view="liste"]').click());box.append(c);}out.append(box);return;}
   for(const a of shown.slice(page*PAGE,(page+1)*PAGE)){const card=el('article','tmp-card');card.dataset.id=String(a.id);card.classList.toggle('tmp-selected',a.id===selected);const top=el('div','tmp-person'),copy=el('div','tmp-person-copy'),name=el('strong','tmp-name',a.nom);copy.append(name,el('span','tmp-verified','✓ Profil approuvé'),el('p','tmp-meta',a.service+' · '+a.ville),el('p','tmp-rating',a.note===null?'Pas encore de note disponible':`★ ${a.note.toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1})}/5 (${a.nb} avis)`));const av=el('div','ta-badges');av.innerHTML=window.TasklyDisponibilite?.html(a)||'';copy.append(av);top.append(image(a),copy);const foot=el('div','tmp-foot'),dist=el('span','tmp-distance',center&&a.distance!==null?'≈ '+a.distance.toLocaleString('fr-FR')+' km':'Distance non calculée'),loc=el('button','tmp-locate','Sur la carte');loc.type='button';loc.disabled=!map||!markerById.has(a.id);loc.addEventListener('click',()=>focusArtisan(a.id,true));foot.append(loc,profile(a));copy.append(dist);card.append(top,foot);out.append(card);if(stale)window.TasklyDisponibilite?.actualiserBadge(av,null);}
  }
  function draw(fit){if(!map||!layers)return;map.invalidateSize();layers.clearLayers();markerById.clear();let bounds=[];if(center){const c=Lref.circle(center,{radius:Number(radius.value)*1000,color:'#00876c',weight:2,dashArray:'7 6',fillColor:'#1ebc91',fillOpacity:.12}).addTo(layers);bounds.push(c.getBounds().getSouthWest(),c.getBounds().getNorthEast());Lref.circleMarker(center,{radius:10,color:'#fff',weight:3,fillColor:'#2078ed',fillOpacity:1}).bindTooltip('Votre position approximative').addTo(layers);}
   for(const items of group(shown)){const pt=[items[0].lat,items[0].lon],icon=Lref.divIcon({className:'tmp-marker-wrap',html:'<span class="tmp-marker ta-'+(window.TasklyDisponibilite?.marker(items)||'non_renseignee')+'">'+(items.length>1?String(items.length):'⚒')+'</span>',iconSize:[42,48],iconAnchor:[21,46]}),m=Lref.marker(pt,{icon,keyboard:true,title:items.length>1?`${items.length} artisans dans cette zone`:items[0].nom}).addTo(layers),popup=el('div','tmp-popup');for(const a of items){const line=el('div','tmp-popup-row');line.dataset.id=String(a.id);const av=el('div','ta-badges');av.innerHTML=window.TasklyDisponibilite?.html(a)||'';line.append(el('strong','',a.nom),el('p','',a.service),av,profile(a));const b=el('button','tmp-locate','Afficher la fiche');b.type='button';b.addEventListener('click',()=>focusArtisan(a.id,false));line.append(b);popup.append(line);markerById.set(a.id,m);}m.bindPopup(popup,{maxHeight:230});m.on('click',()=>focusArtisan(items[0].id,false));bounds.push(pt);}
   if(fit){if(bounds.length)map.fitBounds(bounds,{padding:[22,22],maxZoom:12});else map.setView([28.03,2.7],5);} }
  function render(fit=false){sort.options[0].disabled=!center;if(!center&&sort.value==='distance')sort.value='note';shown=rank(all,sort.value,well.getAttribute('aria-pressed')==='true');if(!shown.some(a=>a.id===selected))selected=null;draw(fit);renderCards();if(stale)paintStatuses(all,true);const n=shown.length;const readable=n===1?'1 artisan trouvé':n+' artisans trouvés';$('tmp-head-count').textContent=loading?'Recherche…':failed?'Recherche indisponible':readable;$('tmp-head-scope').textContent=center?'Dans un rayon de '+radius.value+' km':'Zones publiques • sans distance';$('tmp-side-title').textContent=center?'Artisans à proximité':'Artisans sur la carte';
   const msg=stale?'Disponibilités non vérifiées — nouvelle tentative automatique.':loading?'Recherche des artisans…':failed?'Impossible de charger les artisans. Réessayez.':mapFailed?'Fond de carte indisponible ; les fiches restent consultables.':!n?(well.getAttribute('aria-pressed')==='true'&&all.length?'Aucun résultat avec cette note minimale.':center?'Aucun résultat dans ce rayon.':'Aucun artisan avec une zone publique pour ces critères.') : readable;
   status.textContent=msg;status.parentElement.hidden=!stale&&!loading&&!failed&&!mapFailed&&n>0;more.hidden=loading||failed||!center||all.length!==0||radius.value==='50';retry.hidden=loading||(!failed&&!mapFailed);clear.hidden=!center;$('tmp-filter-caption').textContent=center?'Distances approximatives à vol d’oiseau.':'Activez votre position pour calculer les distances.';$('tmp-limit').textContent=all.length>=200?'200 résultats maximum : affinez vos filtres.':'';$('tmp-limit').hidden=all.length<200;$('tmp-recenter').disabled=!map;}
  async function load(){if(panel.hidden)return;const v=++seq;stale=false;loading=true;failed=false;mapFailed=false;all=[];page=0;selected=null;render(false);const params=new URLSearchParams(construireQueryArtisans());params.set('rayonKm',radius.value);if(center){params.set('lat',String(center[0]));params.set('lon',String(center[1]));}queryAppliquee=params.toString();
   const mapPromise=initMap().catch(()=>{if(v===seq){mapFailed=true;mapEl.textContent='Fond de carte indisponible.';}});
   try{const data=await requeteAPI('/api/artisans/carte?'+params,{cache:'no-store'});if(v!==seq||panel.hidden)return;all=normalize(data.artisans);loading=false;render(true);}catch(e){if(v!==seq||panel.hidden)return;all=[];loading=false;failed=true;render(false);}await mapPromise;if(v===seq&&!panel.hidden)render(true);
  }
  function locate(){if(panel.hidden)return;const v=++geoSeq;$('tmp-geo-status').hidden=false;if(!navigator.geolocation){$('tmp-geo-status').textContent='Géolocalisation indisponible.';return;}geo.disabled=true;$('tmp-geo-status').textContent='Localisation en cours…';navigator.geolocation.getCurrentPosition(p=>{if(v!==geoSeq||panel.hidden)return;geo.disabled=false;const pos=approximate(p.coords.latitude,p.coords.longitude);if(!pos){$('tmp-geo-status').textContent='Position invalide.';return;}center=pos;sort.value='distance';$('tmp-geo-status').textContent='Zone approximative utilisée.';load();},()=>{if(v!==geoSeq||panel.hidden)return;geo.disabled=false;$('tmp-geo-status').textContent='Localisation refusée ou indisponible. La recherche sans position reste possible.';},{enableHighAccuracy:false,timeout:10000,maximumAge:60000});}
  document.querySelector('[data-artisan-view="carte"]').addEventListener('click',()=>{switchView(true);started=true;load();requestAnimationFrame(()=>form.scrollIntoView({block:'start',behavior:'instant'}));});document.querySelector('[data-artisan-view="liste"]').addEventListener('click',()=>switchView(false));
  document.querySelectorAll('[data-map-radius]').forEach(b=>b.addEventListener('click',()=>{updateRadius(b.dataset.mapRadius);if(!panel.hidden)load();}));radius.addEventListener('change',()=>{updateRadius(radius.value);if(!panel.hidden)load();});
  form.addEventListener('submit',()=>{if(!panel.hidden)load();});$('reset-filters').addEventListener('click',()=>setTimeout(()=>{updateRadius(radius.value);well.setAttribute('aria-pressed','false');sort.value=center?'distance':'note';if(!panel.hidden)load();},0));
  sort.addEventListener('change',()=>{page=0;render(false);});well.addEventListener('click',()=>{well.setAttribute('aria-pressed',String(well.getAttribute('aria-pressed')!=='true'));page=0;render(true);});$('tmp-prev').addEventListener('click',()=>{page--;renderCards();});$('tmp-next').addEventListener('click',()=>{page++;renderCards();});geo.addEventListener('click',locate);clear.addEventListener('click',()=>{geoSeq++;geo.disabled=false;center=null;sort.value='note';$('tmp-geo-status').hidden=false;$('tmp-geo-status').textContent='Position retirée de la recherche.';load();});more.addEventListener('click',()=>{updateRadius(RADII[Math.min(3,RADII.indexOf(radius.value)+1)]);load();});retry.addEventListener('click',load);$('tmp-recenter').addEventListener('click',()=>draw(true));
  // Les statuts changent même si la date d'expiration est encore éloignée.
  // Sur une réponse identique hors disponibilité, seuls badges et couleurs sont modifiés.
  function signature(rows){return JSON.stringify(rows.map(({disponibilite_statut,intervention_rapide,disponibilite_secondes,intervention_en_cours,...rest})=>rest));}
  function paintStatuses(rows,unknown=false){
   const index=new Map(rows.map(a=>[String(a.id),a]));const d=window.TasklyDisponibilite;
   for(const card of out.querySelectorAll('.tmp-card'))d.actualiserBadge(card.querySelector('.ta-badges'),unknown?null:index.get(card.dataset.id));
   for(const items of group(shown)){
    const m=markerById.get(items[0].id);if(!m)continue;
    const marker=m.getElement()?.querySelector('.tmp-marker');
    if(marker){for(const k of [...Object.keys(d.labels),'mixte'])marker.classList.remove('ta-'+k);marker.classList.add('ta-'+(unknown?'non_renseignee':d.marker(items)));}
    const popup=m.getPopup()?.getContent();
    for(const row of popup?.querySelectorAll('.tmp-popup-row')||[])d.actualiserBadge(row.querySelector('.ta-badges'),unknown?null:index.get(row.dataset.id));
   }
  }
  async function refresh(signal){
   if(panel.hidden||loading||actualisation||!queryAppliquee)return;
   const v=seq;actualisation=true;
   const contexteValide=()=>v===seq&&!panel.hidden&&!document.hidden;
   const valid=()=>contexteValide()&&!signal.aborted;
   try{
    const data=await requeteAPI('/api/artisans/carte?'+queryAppliquee,{cache:'no-store',signal});if(!valid())return;
    const next=normalize(data.artisans),same=!failed&&!stale&&shown.length>0&&signature(next)===signature(all);
    stale=false;failed=false;all=next;
    if(same){shown=rank(all,sort.value,well.getAttribute('aria-pressed')==='true');paintStatuses(all);status.textContent=shown.length+' artisan(s) trouvé(s)';status.parentElement.hidden=!mapFailed&&shown.length>0;}
    else {const open=[...markerById.entries()].find(([,m])=>m.isPopupOpen())?.[0];render(false);if(open&&markerById.has(open))markerById.get(open).openPopup();}
   }catch(e){if(contexteValide()){stale=true;paintStatuses(all,true);status.textContent='Disponibilités non vérifiées — nouvelle tentative automatique.';status.parentElement.hidden=false;throw e;}}
   finally{actualisation=false;}
  }
  window.TasklyDisponibilite?.surveiller(refresh);
  updateRadius(radius.value);switchView(false);
 });
})();
