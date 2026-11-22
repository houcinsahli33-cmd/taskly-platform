'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 const $=id=>document.getElementById(id),root=$('chat-workspace');if(!root)return;await attendreSession();const role=window.utilisateurCourant?.role;if(!['client','artisan'].includes(role))return;
 const base='/api/demandes',other=role==='client'?'artisan':'client';let selected=null,list=[],offset=null,filter='all',listVersion=0,version=0,sendBusy=false,loadingVersion=null,detailSignature='',lastRead=null,searchTimer,closed=false,markBusy=false;const drafts=new Map();let callEvents=[],lastMessages=[],historyDisabled=false,historyLoading=false;
 function clearFile(){const f=$('cw-file');if(f)f.value='';$('cw-file-preview').hidden=true;$('cw-file-preview').replaceChildren();}
 function sizeLabel(n){return n>=1048576?(n/1048576).toFixed(1)+' Mo':Math.max(1,Math.ceil(n/1024))+' Ko';}


 const calls=document.body?.dataset?.tasklyChatCalls==='1'&&typeof window.TasklyCallUI==='function'?new window.TasklyCallUI(requeteAPI,role):null;
 const statuts={en_attente:'En attente',attente:'En attente',refusee:'Refusée',acceptee:'Acceptée',attente_confirmation:'À confirmer',terminee:'Terminée',conteste:'Contestée',annulee:'Annulée'};
 function el(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;}
 const initials=s=>String(s||'?').trim()[0]?.toUpperCase()||'?';
 function date(s,full=false){if(!s)return '';const d=new Date(s);return Number.isNaN(d.getTime())?'':d.toLocaleString('fr-FR',full?{dateStyle:'short',timeStyle:'short'}:{hour:'2-digit',minute:'2-digit'});}
 function listDate(s){if(!s)return '';const d=new Date(s),now=new Date(),y=new Date();y.setDate(now.getDate()-1);if(isNaN(d))return '';if(d.toDateString()===now.toDateString())return date(s);if(d.toDateString()===y.toDateString())return 'Hier';return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});}
 function dayLabel(s){const d=new Date(s+'T12:00:00'),now=new Date(),y=new Date();y.setDate(now.getDate()-1);return d.toDateString()===now.toDateString()?'Aujourd’hui':d.toDateString()===y.toDateString()?'Hier':s.split('-').reverse().join('/');}
 function presenceBadge(online){
  if(online!==true && Number(online)!==1)return null;
  const dot=el('span',null,'cw-presence-dot');dot.setAttribute('aria-label','En ligne');
  dot.title='En ligne';return dot;
 }
 function setPresence(target,online){
  target.querySelector('.cw-presence-dot')?.remove();
  const dot=presenceBadge(online);if(dot)target.append(dot);
 }
 function avatar(row){const a=el('span',initials(row.nom),'cw-avatar');const src=row.photo_profil;if(typeof src==='string'&&/^\/(?!\/)/.test(src)){const img=el('img');img.src=src;img.alt='';img.addEventListener('error',()=>img.remove());a.append(img);}setPresence(a,row.en_ligne);return a;}
 function renderList(){const content=$('cw-conversations');content.replaceChildren();for(const row of list){const b=el('button',null,'cw-conversation');b.type='button';b.classList.toggle('active',Number(row.id)===selected);b.setAttribute('aria-current',Number(row.id)===selected?'true':'false');const main=el('span',null,'cw-conversation-main'),head=el('span',null,'cw-conversation-head');head.append(el('strong',row.nom||'Interlocuteur'),el('time',listDate(row.dernier_at)));const line=el('span',null,'cw-conversation-sub');line.append(el('span',row.dernier_message||'Commencer la conversation'));if(Number(row.non_lus)>0)line.append(el('b',String(row.non_lus>99?'99+':row.non_lus),'cw-unread'));main.append(head,el('small',row.service_nom||'Service'),line);b.append(avatar(row),main);b.addEventListener('click',()=>open(Number(row.id)));content.append(b);}if(filter==='all'&&!$('cw-search').value.trim()){const all=root.querySelector('[data-cw-filter=all]');all.textContent=offset===null?'Tous ('+list.length+')':'Tous';$('cw-unread-label').textContent=offset===null?'Non lus ('+list.filter(r=>Number(r.non_lus)>0).length+')':'Non lus';}if(!list.length)content.append(el('p','Aucune conversation trouvée.','cw-empty'));$('cw-more').hidden=offset===null;}
 async function refreshList(more=false){const my=++listVersion;try{const q=new URLSearchParams({q:$('cw-search').value.trim(),unread:filter==='unread'?'1':'0',offset:String(more?offset||0:0)});const data=await requeteAPI(base+'/chat/conversations?'+q);if(my!==listVersion||closed)return;const incoming=Array.isArray(data.conversations)?data.conversations:[];list=more?[...list,...incoming.filter(r=>!list.some(old=>Number(old.id)===Number(r.id)))]:incoming;offset=data.next??null;renderList();$('cw-list-status').textContent='';}catch(e){if(my===listVersion)$('cw-list-status').textContent=e.message||'Conversations indisponibles.';}}
 async function count(){try{const d=await requeteAPI(base+'/chat/unread');if(!Number.isSafeInteger(d.total)||d.total<0)throw Error('Invalid');$('cw-count').textContent=d.total?d.total+' nouveau'+(d.total>1?'x':'')+' message'+(d.total>1?'s':''):'Aucun nouveau message';}catch{$('cw-count').textContent='Notifications indisponibles';}}
 function renderInfo(data){const i=data.informations||{},name=(role==='client'?i.artisanNom:i.clientNom)||'Interlocuteur',found=list.find(x=>Number(x.id)===selected);$('cw-person-name').textContent=name;$('cw-person-service').textContent=(role==='client'?'Artisan':'Client')+' · '+(i.serviceNom||'Service');$('cw-person-avatar').replaceChildren(document.createTextNode(initials(name)));if(found){const a=avatar(found);const img=a.querySelector('img');if(img)$('cw-person-avatar').append(img);}setPresence($('cw-person-avatar'),found?.en_ligne);
 $('cw-request-id').textContent='Demande n° '+selected;const a=$('cw-request-link');a.href='/espace/'+role+'/demandes?demande='+selected;a.title='Voir la demande';a.hidden=false;$('cw-service-tag').textContent=i.serviceNom||'Service';$('cw-service-tag').hidden=false;$('cw-date').textContent=i.dateSouhaitee?String(i.dateSouhaitee).slice(0,10).split('-').reverse().join('/'):'À convenir';$('cw-address').textContent=i.adresse||'Non renseignée';$('cw-request-status').textContent=statuts[i.statut]||(data.lectureSeule?'Clôturée':'Non renseigné');$('cw-request-status').dataset.status=i.statut||'';$('cw-info-name').textContent=name;$('cw-info-role').textContent=(role==='client'?'Artisan':'Client')+' · '+(i.serviceNom||'Service');setPresence($('cw-info-avatar'),found?.en_ligne);$('cw-info-avatar').replaceChildren(...Array.from($('cw-person-avatar').childNodes).map(n=>n.cloneNode(true)));const profile=$('cw-profile-link'),artisanId=Number(i.artisanId);profile.hidden=role!=='client'||!Number.isSafeInteger(artisanId)||artisanId<1;if(!profile.hidden)profile.href='/artisan-profile.html?id='+artisanId;$('cw-note-text').textContent='Cette conversation est privée et est liée à votre demande n° '+selected+'.';$('cw-phone').textContent=(role==='client'?i.artisanTelephone:i.clientTelephone)||'Non renseigné';}
 function renderMessages(messages){
  const timeline=window.TasklyCallHistory?.merge(messages,callEvents) || messages.map(m=>({kind:'message',item:m,at:Date.parse(m.created_at)||0}));
  const sig=JSON.stringify([messages,callEvents]);if(sig===detailSignature)return;
  const c=$('cw-messages'),pinned=!detailSignature||c.scrollHeight-c.scrollTop-c.clientHeight<90;
  detailSignature=sig;const fragment=document.createDocumentFragment();let previousDay='';
  for(const entry of timeline){
   const m=entry.item,own=entry.kind==='message'&&m.auteur_type===role;
   const d=String(entry.kind==='call'?m.startedAt:(m.created_at||'')).slice(0,10);
   if(d&&d!==previousDay){fragment.append(el('time',dayLabel(d),'cw-date-separator'));previousDay=d;}
   if(entry.kind==='call'){
    const view=window.TasklyCallHistory.presentation(m,role);
    const ownCall=m.callerRole===role;
    const line=el('div',null,'cw-message-line cw-call-line'+(ownCall?' mine':''));
    if(!ownCall){
     const avatar=$('cw-person-avatar').cloneNode(true);
     avatar.removeAttribute('id');avatar.className='cw-avatar cw-message-avatar';
     line.append(avatar);
    }
    const card=el('div',null,'cw-call-event');card.dataset.status=m.status;
    // V9: consistent SVG from the approved call-history mockup.
    // Only two static trusted glyphs are rendered, never HTML from API data.
    card.dataset.callMode=m.mode==='video'?'video':'audio';
    const iconBox=el('span',null,'cw-call-event-icon');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    const svgNode=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);svg.append(n);};
    if(m.mode==='video'){
      svgNode('rect',{x:'2.5',y:'5.5',width:'14',height:'13',rx:'2'});
      svgNode('path',{d:'m16.5 10 5-3v10l-5-3'});
    } else {
      svgNode('path',{d:'M22 16.9v3a2 2 0 0 1-2.2 2 18 18 0 0 1-8-2.8 18 18 0 0 1-5.6-5.6 18 18 0 0 1-2.8-8A2 2 0 0 1 5.4 3h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 2.1L9 11a14 14 0 0 0 4 4l1.2-1.3a2 2 0 0 1 2.1-.5l3 .5a2 2 0 0 1 2.7 3.2Z'});
    }
    iconBox.append(svg);card.append(iconBox);
    const content=el('span',null,'cw-call-event-content');
    content.append(el('strong',view.title),el('small',view.state+' · '+date(m.startedAt,true)));
    card.append(content);line.append(card);fragment.append(line);continue;
   }
   const line=el('div',null,'cw-message-line'+(own?' mine':'')),bubble=el('div',null,'cw-bubble');
   if(!own){const av=$('cw-person-avatar').cloneNode(true);av.removeAttribute('id');av.className='cw-avatar cw-message-avatar';line.append(av);}
   bubble.append(el('p',m.contenu||''));
   if(m.fichier_nom&&/^[1-9]\d*$/.test(String(m.id))){const att=el('a','📎 '+m.fichier_nom+(Number.isFinite(Number(m.fichier_taille))?' · '+sizeLabel(Number(m.fichier_taille)):''),'cw-attachment-link');att.href=base+'/'+selected+'/chat/attachment/'+encodeURIComponent(m.id);att.setAttribute('download',m.fichier_nom);att.title='Télécharger la pièce jointe';bubble.append(att);}
   const meta=el('small',date(m.created_at));if(own){const t=el('span',m.lu_at?' ✓✓':' ✓','cw-receipt');t.title=m.lu_at?'Lu':'Envoyé';meta.append(t);}bubble.append(meta);line.append(bubble);fragment.append(line);
  }
  if(!timeline.length)fragment.append(el('p','Aucun message. Commencez la conversation.','cw-empty'));
  c.replaceChildren(fragment);if(pinned)c.scrollTop=c.scrollHeight;
 }
 async function refreshCallHistory(id,my){
  if(!window.TasklyCallHistory||historyDisabled||historyLoading||closed||my!==version)return;
  historyLoading=true;
  try{
   const data=await requeteAPI(base+'/'+id+'/chat/calls/history');
   if(my!==version||closed)return;
   callEvents=Array.isArray(data.appels)?data.appels:[];
   renderMessages(lastMessages);
  }catch(e){
   // Sans route active, la messagerie texte reste disponible.
   if(my===version&&[403,404].includes(Number(e?.status)))historyDisabled=true;
  }finally{if(my===version)historyLoading=false;}
 }
 async function markRead(messages,id,my){if(markBusy||!root.classList.contains('cw-has-selection')||document.visibilityState!=='visible'||document.hidden||version!==my)return;const incoming=messages.filter(m=>m.auteur_type===other&&!m.lu_at&&/^\d+$/.test(String(m.id)));if(!incoming.length)return;const through=incoming.map(m=>String(m.id)).sort((a,b)=>a.length-b.length||a.localeCompare(b)).at(-1);if(lastRead===through)return;markBusy=true;try{await requeteAPI(base+'/'+id+'/chat/read',{method:'POST',body:JSON.stringify({throughId:through})});if(version!==my)return;lastRead=through;refreshList();count();if(window.parent!==window)window.parent.postMessage({type:'taskly-chat-read'},location.origin);}catch(e){if(version===my)$('cw-status').textContent='Lecture non confirmée. Actualisation en cours.';}finally{markBusy=false;}}
 async function refreshThread(){if(!selected||!root.classList.contains('cw-has-selection')||loadingVersion===version||closed)return;const id=selected,my=version;loadingVersion=my;try{const data=await requeteAPI(base+'/'+id+'/chat');if(my!==version||closed)return;renderInfo(data);calls?.select(id,$("cw-person-name").textContent,!data.lectureSeule&&data.informations?.statut==="acceptee"&&(document.body.dataset.tasklyChatCallDemande==="all"||String(id)===document.body.dataset.tasklyChatCallDemande));const messages=Array.isArray(data.messages)?data.messages:[];lastMessages=messages;renderMessages(messages);refreshCallHistory(id,my);$('cw-status').textContent=data.lectureSeule?'Conversation clôturée — historique en lecture seule.':'';$('cw-form').hidden=Boolean(data.lectureSeule);$('cw-attach').disabled=Boolean(data.lectureSeule)||data.piecesJointesActives!==true;$('cw-send').disabled=sendBusy;await markRead(messages,id,my);}catch(e){if(my===version){calls?.select(null,"",false);$('cw-status').textContent=e.message||'Conversation indisponible.';$('cw-form').hidden=true;if([401,403,404].includes(e.status)){$('cw-messages').replaceChildren();}}}finally{if(loadingVersion===my)loadingVersion=null;}}
 function open(id){if(!Number.isSafeInteger(id)||id<=0||id>2147483647)return;clearFile();if(selected!==null)drafts.set(selected,$('cw-input').value);calls?.select(null,"",false);selected=id;version++;callEvents=[];lastMessages=[];historyDisabled=false;historyLoading=false;lastRead=null;detailSignature='';$('cw-input').value=drafts.get(id)||'';$('cw-messages').replaceChildren();$('cw-status').textContent='Chargement…';$('cw-form').hidden=true;root.classList.add('cw-has-selection');$('cw-person-name').textContent='Conversation';$('cw-person-service').textContent='';for(const x of ['cw-request-id','cw-date','cw-address','cw-request-status','cw-info-name','cw-phone'])$(x).textContent='—';$('cw-request-link').hidden=true;$('cw-service-tag').hidden=true;$('cw-info-role').textContent='';$('cw-info-avatar').textContent='—';$('cw-profile-link').hidden=true;$('cw-person-avatar').textContent='—';$('cw-request-status').dataset.status='';renderList();refreshThread();}
 $('cw-attach').addEventListener('click',()=>{if(!$('cw-attach').disabled)$('cw-file').click();});
 $('cw-file').addEventListener('change',()=>{const f=$('cw-file').files?.[0],p=$('cw-file-preview');p.replaceChildren();if(!f){p.hidden=true;return;}if(f.size>3*1024*1024||!['application/pdf','image/jpeg','image/png'].includes(f.type)){$('cw-status').textContent='Fichier refusé : PDF, JPEG ou PNG, 3 Mo maximum.';clearFile();return;}p.append(el('span','📎 '+f.name+' · '+sizeLabel(f.size)));const b=el('button','×','cw-file-remove');b.type='button';b.title='Retirer le fichier';b.addEventListener('click',clearFile);p.append(b);p.hidden=false;$('cw-status').textContent='';});
 $('cw-form').addEventListener('submit',async e=>{e.preventDefault();if(!selected||sendBusy)return;const input=$('cw-input'),contenu=input.value.trim(),file=$('cw-file').files?.[0],id=selected,my=version;if((!contenu&&!file)||contenu.length>4000)return;if(file&&$('cw-attach').disabled)return;sendBusy=true;$('cw-send').disabled=true;try{let url=base+'/'+id+'/chat',body=JSON.stringify({contenu});if(file){const data=new FormData();data.append('fichier',file);data.append('contenu',contenu);url+='/attachment';body=data;}await requeteAPI(url,{method:'POST',body});drafts.delete(id);if(my===version){input.value='';clearFile();await refreshThread();}refreshList();}catch(e){if(my===version)$('cw-status').textContent=e.message||'Envoi impossible.';}finally{sendBusy=false;$('cw-send').disabled=false;}});
 root.querySelectorAll('[data-cw-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.cwFilter;root.querySelectorAll('[data-cw-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));refreshList();}));$('cw-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>refreshList(),300);});$('cw-more').addEventListener('click',()=>refreshList(true));$('cw-mobile-back').addEventListener('click',()=>{clearFile();if(selected!==null)drafts.set(selected,$('cw-input').value);calls?.select(null,"",false);selected=null;version++;callEvents=[];lastMessages=[];historyDisabled=false;historyLoading=false;root.classList.remove('cw-has-selection');$('cw-form').hidden=true;$('cw-messages').replaceChildren(el('p','Choisissez une conversation pour commencer.','cw-empty'));$('cw-status').textContent='';$('cw-person-name').textContent='Vos conversations';$('cw-person-service').textContent='Sélectionnez une demande';$('cw-person-avatar').textContent='—';$('cw-profile-link').hidden=true;$('cw-request-link').hidden=true;$('cw-service-tag').hidden=true;$('cw-info-avatar').textContent='—';$('cw-info-role').textContent='';for(const x of ['cw-request-id','cw-date','cw-address','cw-request-status','cw-info-name','cw-phone'])$(x).textContent='—';$('cw-request-status').dataset.status='';$('cw-note-text').textContent='Cette conversation est privée et liée à une demande de service.';renderList();});
 $('cw-details-toggle').addEventListener('click',()=>{const shown=root.classList.toggle('cw-details-hidden');$('cw-details-toggle').setAttribute('aria-expanded',String(!shown));});
 const picker=$('cw-emoji-picker');for(const emoji of ['🙂','😊','👍','👋','✅','🙏','🔧','📅']){const b=el('button',emoji);b.type='button';b.addEventListener('click',()=>{const input=$('cw-input');if(input.value.length+emoji.length<=4000){input.setRangeText(emoji,input.selectionStart,input.selectionEnd,'end');input.focus();}picker.hidden=true;$('cw-emoji-toggle').setAttribute('aria-expanded','false');});picker.append(b);}$('cw-emoji-toggle').addEventListener('click',()=>{picker.hidden=!picker.hidden;$('cw-emoji-toggle').setAttribute('aria-expanded',String(!picker.hidden));});
 const first=Number(new URLSearchParams(location.search).get('conversation'));await refreshList();if(first)open(first);else if(list.length&&innerWidth>700)open(Number(list[0].id));count();const th=setInterval(()=>{if(document.visibilityState==='visible'&&root.classList.contains('cw-has-selection'))refreshThread();},10000);const lt=setInterval(()=>{if(document.visibilityState==='visible'){refreshList();count();}},30000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){refreshList();count();refreshThread();}});addEventListener('pagehide',()=>{closed=true;clearInterval(th);clearInterval(lt);clearTimeout(searchTimer);},{once:true});
});
