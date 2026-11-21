/* Calendrier Taskly : reste dans le formulaire d'origine, sans saisie manuelle. */
document.addEventListener('DOMContentLoaded', () => {
 const input=document.getElementById('request-date');
 if(!input)return;
 const modal=document.getElementById('request-modal');
 let activePicker=null;
 function hidePicker(el){if(typeof el.hidePopover==='function'&&el.hasAttribute('popover')&&el.matches(':popover-open'))el.hidePopover();el.removeAttribute('popover');el.classList.remove('rw-picker-side');el.hidden=true;if(activePicker===el)activePicker=null;}
 function showPicker(el,anchor){
  if(activePicker&&activePicker!==el)activePicker.dispatchEvent(new Event('rw-picker-close'));
  activePicker=el;el.hidden=false;
  const rect=modal.getBoundingClientRect(), a=anchor.getBoundingClientRect(), width=300;
  if(typeof el.showPopover==='function'&&innerWidth-rect.right>=width+18&&innerHeight>=480){
   el.setAttribute('popover','manual');el.classList.add('rw-picker-side');
   el.style.setProperty('--rw-picker-left',Math.round(rect.right+12)+'px');
   el.style.setProperty('--rw-picker-top',Math.round(Math.max(12,Math.min(a.top,innerHeight-440)))+'px');
   try{el.showPopover();return;}catch(e){el.removeAttribute('popover');el.classList.remove('rw-picker-side');}
  }
 }
 window.tasklyRequestPickerUI={show:showPicker,hide:hidePicker};
 for(const target of [window,modal])target.addEventListener('scroll',()=>{if(activePicker?.classList.contains('rw-picker-side'))activePicker.dispatchEvent(new Event('rw-picker-close'));},{passive:true});
 window.addEventListener('resize',()=>{if(activePicker)activePicker.dispatchEvent(new Event('rw-picker-close'));});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activePicker){e.preventDefault();e.stopImmediatePropagation();activePicker.dispatchEvent(new Event('rw-picker-close'));}},true);
 modal.addEventListener('close',()=>{if(activePicker)activePicker.dispatchEvent(new Event('rw-picker-close'));});
 let pending='';
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Africa/Algiers',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const toISO=(y,m,d)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 let y=0,m=0,booked=new Set(),loadedArtisan=null,loadedOK=false, generation=0;
 const wrapper=document.createElement('div');wrapper.className='taskly-calendar-field';input.parentNode.insertBefore(wrapper,input);wrapper.append(input);
 const openBtn=document.createElement('button');openBtn.type='button';openBtn.className='taskly-calendar-launch';openBtn.setAttribute('aria-label','Ouvrir le calendrier');openBtn.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>';wrapper.append(openBtn);
 const popup=document.createElement('div');popup.className='taskly-calendar-popover';popup.hidden=true;popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Choisir une date de prestation');wrapper.append(popup);
 const months=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
 const min=()=>today();
 const isValid=(value)=>!value||(/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>=min()&&loadedOK&&loadedArtisan===document.getElementById('request-artisan-id')?.value&&!booked.has(value));
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
   html+='<button type="button" data-calendar-day="'+iso+'" '+(closed?'disabled aria-disabled="true"':'')+' aria-label="'+d+' '+months[m]+' '+y+(booked.has(iso)?' — Occupé':'')+'" class="'+(closed?'blocked ':'')+(iso===pending?'chosen':'')+'">'+d+'</button>';
  }
  html+='</div><p class="taskly-calendar-hint">Les dates passées ou déjà réservées sont grisées.</p><div class="rw-picker-actions"><button type="button" data-calendar-today '+(!isValid(min())?'disabled':'')+'>Aujourd’hui</button><button type="button" class="rw-picker-confirm" data-calendar-confirm '+(!pending||!isValid(pending)?'disabled':'')+'>✓ Valider</button></div>';
  popup.innerHTML=html;
 }
 async function open(){
  const artisanId=document.getElementById('request-artisan-id')?.value;
  if(!/^[1-9]\d*$/.test(String(artisanId||'')))return;
  pending=input.value;
  const selected=input.value||min(); y=Number(selected.slice(0,4));m=Number(selected.slice(5,7))-1;
  if(!Number.isInteger(m)||m<0||m>11){y=Number(min().slice(0,4));m=Number(min().slice(5,7))-1;}
  const requestGeneration=++generation;
  showPicker(popup,wrapper);openBtn.setAttribute('aria-expanded','true');
  popup.innerHTML='<p class="taskly-calendar-loading" role="status">Chargement des disponibilités…</p>';
  loadedOK=false;booked.clear();loadedArtisan=null;
  try{
   const response=await requeteAPI('/api/artisans/'+encodeURIComponent(artisanId)+'/dates-indisponibles');
   if(requestGeneration!==generation||popup.hidden||document.getElementById('request-artisan-id')?.value!==artisanId)return;
   booked=new Set((Array.isArray(response.dates)?response.dates:[]).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)));
   loadedOK=true;loadedArtisan=artisanId;
   if(input.value && !isValid(input.value)){input.value='';pending='';input.dispatchEvent(new Event('change',{bubbles:true}));}
   draw();
  }catch(e){if(requestGeneration===generation&&!popup.hidden)draw('error');}
 }
 function close(){generation++;hidePicker(popup);openBtn.setAttribute('aria-expanded','false');}
 popup.addEventListener('rw-picker-close',close);
 openBtn.addEventListener('click',()=>popup.hidden?open():close());
 input.addEventListener('click',()=>popup.hidden?open():close());
 input.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
 input.addEventListener('paste',e=>e.preventDefault());
 popup.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target)return;
  if(target.hasAttribute('data-calendar-close')){close();return;}
  if(target.hasAttribute('data-calendar-prev')){if(toISO(y,m,1).slice(0,7)>min().slice(0,7)){m--;if(m<0){m=11;y--;}draw();}return;}
  if(target.hasAttribute('data-calendar-next')){m++;if(m>11){m=0;y++;}draw();return;}
  if(target.hasAttribute('data-calendar-today')&&isValid(min())){pending=min();y=Number(pending.slice(0,4));m=Number(pending.slice(5,7))-1;draw();return;}
  if(target.hasAttribute('data-calendar-confirm')&&pending&&isValid(pending)){input.value=pending;input.dispatchEvent(new Event('change',{bubbles:true}));close();return;}
  if(target.dataset.calendarDay&&!target.disabled&&isValid(target.dataset.calendarDay)){pending=target.dataset.calendarDay;draw();}
 });
 document.addEventListener('pointerdown',event=>{if(!wrapper.contains(event.target))close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
 document.getElementById('request-form')?.addEventListener('reset',()=>{close();loadedOK=false;loadedArtisan=null;booked.clear();});
});
