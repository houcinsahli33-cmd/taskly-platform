/* Calendrier Taskly : reste dans le formulaire d'origine, sans saisie manuelle. */
document.addEventListener('DOMContentLoaded', () => {
 const input=document.getElementById('request-date');
 if(!input)return;
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Africa/Algiers',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const toISO=(y,m,d)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 let y=0,m=0,booked=new Set(),loadedArtisan=null,loadedOK=false;
 const wrapper=document.createElement('div');wrapper.className='taskly-calendar-field';input.parentNode.insertBefore(wrapper,input);wrapper.append(input);
 const openBtn=document.createElement('button');openBtn.type='button';openBtn.className='taskly-calendar-launch';openBtn.setAttribute('aria-label','Ouvrir le calendrier');openBtn.textContent='▦';wrapper.append(openBtn);
 const popup=document.createElement('div');popup.className='taskly-calendar-popover';popup.hidden=true;popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Choisir une date de prestation');wrapper.append(popup);
 const months=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
 const min=()=>today();
 const isValid=(value)=>!value||(/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>=min()&&loadedOK&&!booked.has(value));
 window.tasklyRequestDateValide=()=>isValid(input.value);
 function draw(error=''){
  if(error){popup.innerHTML='<p class="taskly-calendar-error" role="alert">Disponibilités indisponibles. Réessayez dans un instant.</p><button type="button" data-calendar-close>Fermer</button>';return;}
  const starts=(new Date(y,m,1).getDay()+6)%7;
  const days=new Date(y,m+1,0).getDate();
  const currentMonth=min().slice(0,7);
  let html='<div class="taskly-calendar-header"><button type="button" data-calendar-prev aria-label="Mois précédent"'+(toISO(y,m,1).slice(0,7)<=currentMonth?' disabled':'')+'>‹</button><strong>'+months[m]+' '+y+'</strong><button type="button" data-calendar-next aria-label="Mois suivant">›</button></div>';
  html+='<div class="taskly-calendar-grid" role="grid" aria-label="Jours disponibles">';
  ['L','M','M','J','V','S','D'].forEach(w=>html+='<span class="taskly-calendar-weekday">'+w+'</span>');
  for(let i=0;i<starts;i++)html+='<span aria-hidden="true"></span>';
  for(let d=1;d<=days;d++){
   const iso=toISO(y,m,d),closed=iso<min()||booked.has(iso);
   html+='<button type="button" data-calendar-day="'+iso+'" '+(closed?'disabled aria-disabled="true"':'')+' aria-label="'+d+' '+months[m]+' '+y+(booked.has(iso)?' — Occupé':'')+'" class="'+(closed?'blocked ':'')+(iso===input.value?'chosen':'')+'">'+d+'</button>';
  }
  html+='</div><p class="taskly-calendar-hint">Les dates passées ou déjà réservées sont grisées.</p>';
  popup.innerHTML=html;
 }
 async function open(){
  const artisanId=document.getElementById('request-artisan-id')?.value;
  if(!/^[1-9]\d*$/.test(String(artisanId||'')))return;
  const selected=input.value||min(); y=Number(selected.slice(0,4));m=Number(selected.slice(5,7))-1;
  if(!Number.isInteger(m)||m<0||m>11){y=Number(min().slice(0,4));m=Number(min().slice(5,7))-1;}
  popup.hidden=false;openBtn.setAttribute('aria-expanded','true');
  popup.innerHTML='<p class="taskly-calendar-loading" role="status">Chargement des disponibilités…</p>';
  loadedOK=false;booked.clear();loadedArtisan=null;
  try{
   const response=await requeteAPI('/api/artisans/'+encodeURIComponent(artisanId)+'/dates-indisponibles');
   if(popup.hidden||document.getElementById('request-artisan-id')?.value!==artisanId)return;
   booked=new Set((Array.isArray(response.dates)?response.dates:[]).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)));
   loadedOK=true;loadedArtisan=artisanId;
   if(input.value && !isValid(input.value))input.value='';
   draw();
  }catch(e){if(!popup.hidden)draw('error');}
 }
 function close(){popup.hidden=true;openBtn.setAttribute('aria-expanded','false');}
 openBtn.addEventListener('click',()=>popup.hidden?open():close());
 input.addEventListener('click',open);
 input.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
 input.addEventListener('paste',e=>e.preventDefault());
 popup.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target)return;
  if(target.hasAttribute('data-calendar-close')){close();return;}
  if(target.hasAttribute('data-calendar-prev')){if(toISO(y,m,1).slice(0,7)>min().slice(0,7)){m--;if(m<0){m=11;y--;}draw();}return;}
  if(target.hasAttribute('data-calendar-next')){m++;if(m>11){m=0;y++;}draw();return;}
  if(target.dataset.calendarDay&&!target.disabled&&isValid(target.dataset.calendarDay)){
   input.value=target.dataset.calendarDay;input.dispatchEvent(new Event('change',{bubbles:true}));close();
  }
 });
 document.addEventListener('pointerdown',event=>{if(!wrapper.contains(event.target))close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
 document.getElementById('request-form')?.addEventListener('reset',()=>{close();loadedOK=false;loadedArtisan=null;booked.clear();});
});
