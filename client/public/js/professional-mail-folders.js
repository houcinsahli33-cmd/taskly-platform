'use strict';
// Taskly Mail Premium V2 : seules les interfaces internes changent.
// Les messages proviennent toujours du serveur ; aucun compte ni courrier fictif.
window.afficherTasklyMailFolders=async function(section,status,account){
 const base='/api/taskly-mail/mailbox';
 const defaults={notify_email:true,signature_enabled:false,signature:'',confirm_delete:true,preview_enabled:true,auto_save:true};
 let prefs={...defaults},prefsReady=false,current='inbox',cursor=null,search='',busy=false,version=0,dirty=false;
 let sendKey=null,sendSignature=null,autoTimer=null,reader=null,listPanel=null,selectedIds=new Set(),messages=[];
 let activeSettingsCategory='general';
 const uuid=()=>{if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;const h=Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');};
 const el=(tag,t,cls)=>{const n=document.createElement(tag);if(t!=null)n.textContent=String(t);if(cls)n.className=cls;return n;};
 const btn=(label,fn,cls='tm-button')=>{const n=el('button',label,cls);n.type='button';n.addEventListener('click',fn);return n;};
 const svgPaths={mail:'M4 5h16v14H4z|m4 6 8 7 8-7',inbox:'M3 5h18v14H3z|m3 6 9 7 9-7',sent:'M22 2 11 13|m22 2-7 20-4-9-9-4z',draft:'M5 3h10l4 4v14H5z|M9 12h6M9 16h6',favorites:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',archive:'M3 4h18v5H3z|M5 9v12h14V9|M9 13h6',trash:'M3 6h18|M9 6V3h6v3|M5 6l1 15h12l1-15|M10 10v7M14 10v7',settings:'M9 3h6l1 3 3 1 2 4-2 3v4l-4 2-3-2-3 2-4-2v-4l-2-3 2-4 3-1z|M15 12a3 3 0 1 0-6 0a3 3 0 1 0 6 0',plus:'M12 4v16M4 12h16',search:'M15 15l6 6|M17 10a7 7 0 1 0-14 0a7 7 0 1 0 14 0',edit:'m4 16 12-12 4 4-12 12H4z|m13 7 4 4',save:'M4 3h14l3 3v15H3V3z|M7 3v6h10V3|M7 21v-8h10v8',close:'M6 6l12 12M18 6 6 18',reply:'m9 10-5 5 5 5|M4 15h9a6 6 0 0 1 6 6',forward:'m14 4 7 7-7 7|M21 11H9a6 6 0 0 0-6 6',restore:'M3 11a9 9 0 1 1 3 7|M3 4v7h7',shield:'M12 2 3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6z|m8 12 3 3 5-6',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9|M10 21h4',check:'m5 12 4 4 10-10',back:'m14 4-8 8 8 8|M6 12h14',filter:'M3 4h18l-7 8v7l-4 2v-9z',refresh:'M21 10a9 9 0 0 0-15-5l-3 3|M3 3v5h5|M3 14a9 9 0 0 0 15 5l3-3|M21 21v-5h-5',lock:'M6 10V7a6 6 0 0 1 12 0v3|M5 10h14v12H5z',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z|M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',user:'M12 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8|M4 21a8 8 0 0 1 16 0',info:'M12 17v-5|M12 8h.01|M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20',attach:'M21 11.5 12 20.5a6 6 0 0 1-8.5-8.5l9.5-9.5a4 4 0 0 1 5.7 5.7l-9.5 9.5a2 2 0 0 1-2.8-2.8L15 7.5',image:'M3 3h18v18H3z|M3 16l5-5 4 4 3-3 6 6|M8.5 8.5h.01',list:'M9 6h12M9 12h12M9 18h12|M3 6h.01M3 12h.01M3 18h.01',numbered:'M10 6h11M10 12h11M10 18h11|M3 5h3v4|M3 12h3l-3 4h3',link:'M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2|M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2',tag:'M20 13 13 20 3 10V3h7z|M7.5 7.5h.01',clock:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20|M12 6v6l4 2',sort:'M7 3v18m-4-4 4 4 4-4|M17 21V3m-4 4 4-4 4 4'};
 function icon(name){const n=document.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('viewBox','0 0 24 24');n.setAttribute('class','tm-icon');n.setAttribute('aria-hidden','true');for(const d of (svgPaths[name]||svgPaths.mail).split('|')){const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);n.append(p);}return n;}
 function withIcon(label,name,fn,cls='tm-button'){const b=btn('',fn,cls);b.append(icon(name),el('span',label));return b;}
 const request=(route,method='GET',data)=>requeteAPI(base+route,{method,...(data===undefined?{}:{body:JSON.stringify(data)})});
 function notice(t){status.textContent=t||'';status.hidden=!t;}
 async function run(fn){if(busy)return;busy=true;section.setAttribute('aria-busy','true');try{await fn();}catch(e){notice(e.message||'Erreur de messagerie.');}finally{busy=false;section.removeAttribute('aria-busy');}}
 async function getPrefs(){try{const r=await request('/preferences');prefs={...defaults,...r.preferences};prefsReady=true;}catch{prefsReady=false;}}
 const labels={inbox:'Boîte de réception',sent:'Messages envoyés',draft:'Brouillons',favorites:'Favoris',archive:'Archives',trash:'Corbeille',settings:'Paramètres'};
 const headings={inbox:['Boîte de réception','Vos messages professionnels reçus dans Taskly.'],sent:['Messages envoyés','Retrouvez tous vos messages envoyés.'],draft:['Brouillons','Reprenez votre message là où vous l’avez laissé.'],favorites:['Favoris','Vos messages importants, réunis au même endroit.'],archive:['Archives','Messages conservés et consultables à tout moment.'],trash:['Corbeille','Restaurez vos messages ou supprimez-les définitivement.']};
 const sectionRoot=el('div',null,'tm-mail-shell tm-premium-v2'),nav=el('nav',null,'tm-mail-nav'),tools=el('div',null,'tm-mail-tools'),content=el('main',null,'tm-mail-content');
 sectionRoot.setAttribute('aria-label','Taskly Mail');nav.setAttribute('aria-label','Dossiers de Taskly Mail');
 section.classList.add('tm-app');section.replaceChildren(sectionRoot);sectionRoot.append(nav,tools,content);
 const brand=el('div',null,'tm-brand');brand.append(icon('mail'),el('span','Taskly Mail'));
 const newButton=withIcon('Nouveau message','plus',()=>run(()=>compose()),'tm-new');newButton.setAttribute('aria-label','+ Nouveau message');nav.append(brand,newButton);
 const folders={};for(const [key,label] of Object.entries(labels)){const b=withIcon(label,key,()=>run(()=>key==='draft'?showDraft():key==='settings'?settings():switchFolder(key)),'tm-folder');b.dataset.folder=key;folders[key]=b;nav.append(b);}
 const inboxBadge=el('b',null,'tm-unread-count');inboxBadge.hidden=true;folders.inbox.append(inboxBadge);
 const navFoot=el('div',null,'tm-nav-foot');const footTitle=el('strong','Votre messagerie protégée');const footText=el('span','Échanges internes Taskly · E-mail personnel confidentiel');const footCopy=el('div',null,'tm-nav-foot-copy');footCopy.append(footTitle,footText);navFoot.append(icon('shield'),footCopy);nav.append(navFoot);
 const searchForm=el('form',null,'tm-mail-search');const searchInput=el('input');searchInput.type='search';searchInput.maxLength=100;searchInput.placeholder='Rechercher un message...';searchInput.setAttribute('aria-label','Rechercher un message');const searchButton=btn('Rechercher',()=>{},'tm-search-button');searchButton.type='submit';searchForm.append(icon('search'),searchInput,searchButton);
 const u=window.utilisateurCourant||{},display=[u.prenom,u.nom].filter(Boolean).join(' ')||'Mon compte';const initials=display.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
 const toolbarHelp=withIcon('Aide','info',()=>run(()=>settings()),'tm-toolbar-icon');toolbarHelp.title='Paramètres et aide sur Taskly Mail';toolbarHelp.setAttribute('aria-label','Aide et paramètres de la messagerie');const profile=el('div',null,'tm-app-heading');const details=el('div',null,'tm-account-details');details.append(el('strong',display),el('small',account.address));profile.append(el('span',initials,'tm-profile-avatar'),details);tools.append(searchForm,toolbarHelp,profile);
 searchForm.addEventListener('submit',e=>{e.preventDefault();search=searchInput.value.trim();run(()=>current==='draft'?showDraft():current==='settings'?settings():list(current));});
 function activate(key){current=key;for(const [k,b]of Object.entries(folders)){b.classList.toggle('active',k===key);if(k===key)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}searchForm.hidden=key==='settings';}
 function date(value){const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'});}
 const stamp=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'});};
 function avatar(value){const a=el('span',(value||'?').split('@')[0].replace(/[._-]/g,' ').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase().slice(0,2)||'?', 'tm-mail-avatar');return a;}
 // Affiche la mise en forme textuelle sans interpréter de HTML fourni par un correspondant.
 function safeBody(value){
  const pre=el('pre',null,'taskly-mail-body');
  const text=String(value||'');
  const pattern=/(\*\*[^\n*]+\*\*|__[^\n_]+__|\*[^\n*]+\*|https?:\/\/[^\s<>"']+)/g;
  let index=0,match;
  while((match=pattern.exec(text))!==null){
   if(match.index>index)pre.append(document.createTextNode(text.slice(index,match.index)));
   const token=match[0];let child;
   if(token.startsWith('**'))child=el('strong',token.slice(2,-2));
   else if(token.startsWith('__'))child=el('u',token.slice(2,-2));
   else if(token.startsWith('*'))child=el('em',token.slice(1,-1));
   else{child=el('a',token);child.href=token;child.rel='noopener noreferrer';child.target='_blank';}
   pre.append(child);index=pattern.lastIndex;
  }
  if(index<text.length)pre.append(document.createTextNode(text.slice(index)));
  return pre;
 }
 function leave(){if(!dirty)return true;return confirm('Quitter sans enregistrer les modifications du brouillon ?');}
 function stopAuto(){if(autoTimer){clearTimeout(autoTimer);autoTimer=null;}}
 async function switchFolder(key){if(!leave())return;stopAuto();dirty=false;search='';searchInput.value='';await list(key);}
 async function counts(){try{const d=await request('/counts');inboxBadge.textContent=d.unread>99?'99+':String(d.unread);inboxBadge.hidden=!Number.isSafeInteger(d.unread)||d.unread<=0;}catch{inboxBadge.hidden=true;}}
 function heading(key,extra){const node=el('div',null,'tm-view-title'),title=el('div',null,'tm-view-name'),h=el('h3',headings[key][0]);h.prepend(icon(key));title.append(h,el('p',headings[key][1]));node.append(title);if(extra)node.append(extra);return node;}
 function empty(label,description,key){const e=el('div',null,'tm-empty-state'),symbol=el('div',null,'tm-empty-art');symbol.append(icon(key||'mail'));e.append(symbol,el('h4',label),el('p',description));return e;}
 let selectionToolbar;
 function refreshSelected(){if(!selectionToolbar)return;const n=selectedIds.size;selectionToolbar.hidden=n===0;selectionToolbar.querySelector('.tm-selection-label').textContent=n+' message'+(n>1?'s':'')+' sélectionné'+(n>1?'s':'');}
 async function doAction(id,action){await request('/copies/'+encodeURIComponent(id)+'/action','POST',{action});}
 function confirmation(title,description,buttonLabel){return new Promise(resolve=>{
  const overlay=el('div',null,'tm-confirm-overlay');overlay.setAttribute('role','presentation');const dialog=el('div',null,'tm-confirm-card');dialog.setAttribute('role','alertdialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',title);
  const titleLine=el('h3',title),message=el('p',description),row=el('div',null,'tm-confirm-actions');
  const done=ok=>{overlay.remove();resolve(ok);};const cancel=btn('Annuler',()=>done(false),'tm-button');const accept=withIcon(buttonLabel,'trash',()=>done(true),'tm-button tm-danger-solid');
  row.append(cancel,accept);dialog.append(icon('trash'),titleLine,message,row);overlay.append(dialog);sectionRoot.append(overlay);cancel.focus();
  overlay.addEventListener('click',e=>{if(e.target===overlay)done(false);});overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();done(false);}if(e.key==='Tab'){const a=[cancel,accept],i=a.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();accept.focus();}else if(!e.shiftKey&&i===1){e.preventDefault();cancel.focus();}}});
 });}
 async function perform(id,action){
  if(action==='delete'){if(!(await confirmation('Supprimer définitivement ?','Cette action est irréversible : ce message ne pourra plus être récupéré.','Confirmer la suppression')))return false;}
  if(action==='trash'&&prefs.confirm_delete){if(!(await confirmation('Déplacer dans la corbeille ?','Ce message sera retiré du dossier actuel. Vous pourrez le restaurer depuis la corbeille.','Déplacer dans la corbeille')))return false;}
  await doAction(id,action);await list(current);return true;
 }
 async function bulk(action){const ids=[...selectedIds];if(!ids.length)return;if(action==='delete'){if(!(await confirmation('Supprimer définitivement ?','Vous allez supprimer définitivement '+ids.length+' message(s).','Confirmer la suppression')))return;}else if(action==='trash'&&prefs.confirm_delete){if(!(await confirmation('Déplacer la sélection ?','Vous pourrez restaurer les messages depuis la corbeille.','Déplacer dans la corbeille')))return;}
  for(const id of ids)await doAction(id,action);await list(current);notice(ids.length+' message(s) traité(s).');}
 function closeReader(){if(reader)reader.replaceChildren(empty('Sélectionnez un message','Son contenu s’affichera ici en toute sécurité.','mail'));content.classList.remove('tm-reading-open');content.querySelectorAll('.tm-mail-item').forEach(n=>n.setAttribute('aria-pressed','false'));}
 async function list(key,next=null){
  const v=++version;activate(key);cursor=next;const q=new URLSearchParams({folder:key,q:search});if(next)q.set('cursor',next);
  const d=await request('/copies?'+q);if(v!==version||!section.isConnected)return;
  messages=d.messages;selectedIds=new Set();
  const actions=el('div',null,'tm-title-actions');actions.append(withIcon('Actualiser','refresh',()=>run(()=>list(key)), 'tm-button tm-refresh-button'));
  const title=heading(key,actions),wrap=el('div',null,'tm-list-reader'),listWrap=el('div',null,'tm-list-column'),listTop=el('div',null,'tm-list-toolbar');
  const selectAll=el('input');selectAll.type='checkbox';selectAll.setAttribute('aria-label','Tout sélectionner sur cette page');selectAll.addEventListener('change',()=>{selectedIds=new Set(selectAll.checked?messages.map(m=>m.copyId):[]);listWrap.querySelectorAll('.tm-select-message').forEach(c=>c.checked=selectAll.checked);refreshSelected();});
  const filter=el('span','Tous les messages','tm-list-filter');filter.prepend(icon('filter'));
  const sort=el('select',null,'tm-list-sort');sort.setAttribute('aria-label','Ordre des messages');for(const [value,text] of [['recent','Plus récents'],['old','Plus anciens']]){const option=el('option',text);option.value=value;sort.append(option);}
  listTop.append(selectAll,filter,sort);
  selectionToolbar=el('div',null,'tm-selection-toolbar');selectionToolbar.hidden=true;
  const label=el('strong',null,'tm-selection-label');selectionToolbar.append(label);
  if(key==='trash')selectionToolbar.append(withIcon('Restaurer','restore',()=>run(()=>bulk('restore'))),withIcon('Supprimer définitivement','trash',()=>run(()=>bulk('delete')),'tm-button tm-danger'));
  else selectionToolbar.append(withIcon('Archiver','archive',()=>run(()=>bulk('archive'))),withIcon('Corbeille','trash',()=>run(()=>bulk('trash')),'tm-button tm-danger'));
  listPanel=el('div',null,'tm-list-panel');reader=el('section',null,'tm-reader-panel');reader.setAttribute('aria-label','Lecture du message');reader.append(empty('Sélectionnez un message','Son contenu s’affichera ici.','mail'));
  const countCaption=el('span',messages.length+(d.next?' ou plus':'')+' message'+(messages.length!==1?'s':'')+' sur cette page','tm-list-count');listTop.append(countCaption);listWrap.append(listTop,selectionToolbar,listPanel);
  wrap.append(listWrap,reader);content.className='tm-mail-content tm-split-view';content.replaceChildren(title,wrap);
  if(!messages.length){const empties={inbox:['Votre boîte de réception est vide','Les prochains messages reçus apparaîtront ici.'],sent:['Aucun message envoyé pour le moment','Vos échanges envoyés apparaîtront ici dès votre premier envoi.'],favorites:['Aucun favori pour le moment','Cliquez sur l’étoile d’un message pour le retrouver ici.'],archive:['Vos archives sont vides','Archivez un message pour le conserver à l’écart de la boîte de réception.'],trash:['Votre corbeille est vide','Les messages déplacés dans la corbeille apparaîtront ici.']};const t=empties[key]||['Aucun message','Ce dossier est actuellement vide.'];listPanel.append(empty(t[0],t[1],key));}
  for(const m of messages){
   const entry=el('div',null,'tm-mail-entry'),check=el('input');entry.dataset.index=String(listPanel.children.length);check.type='checkbox';check.className='tm-select-message';check.setAttribute('aria-label','Sélectionner '+(m.subject||'Sans objet'));check.addEventListener('change',()=>{if(check.checked)selectedIds.add(m.copyId);else selectedIds.delete(m.copyId);refreshSelected();selectAll.checked=selectedIds.size===messages.length;});
   const correspondent=key==='sent'?m.to:m.from;
   const open=btn('',()=>run(()=>read(m.copyId,open)),'tm-mail-item'+(!m.isRead?' unread':''));open.setAttribute('aria-pressed','false');
   const words=el('span',null,'tm-mail-summary');words.append(el('strong',(key==='sent'?'À : ':'')+(correspondent||'Expéditeur Taskly')),el('b',m.subject||'Sans objet'));
   if(prefs.preview_enabled&&m.preview)words.append(el('small',m.preview));
   const meta=el('span',null,'tm-item-meta');meta.append(el('time',stamp(m.date)));if(key==='sent'){const sentTag=el('span',null,'tm-sent-check');sentTag.append(icon('check'));sentTag.title='Envoyé via Taskly';sentTag.setAttribute('aria-label','Message envoyé');meta.append(sentTag);}if(!m.isRead&&key!=='sent')meta.append(el('i',null,'tm-dot'));
   open.append(avatar(correspondent),words,meta);
   const star=withIcon('', 'favorites',()=>run(async()=>{await doAction(m.copyId,m.starred?'unstar':'star');await list(current,cursor);}), 'tm-star'+(m.starred?' is-starred':''));star.setAttribute('aria-label',m.starred?'Retirer des favoris':'Ajouter aux favoris');star.title=m.starred?'Retirer des favoris':'Ajouter aux favoris';
   entry.append(check,open,star);listPanel.append(entry);
  }
  sort.addEventListener('change',()=>{const items=[...listPanel.querySelectorAll('.tm-mail-entry')];if(sort.value==='old')items.reverse();else items.sort((a,b)=>Number(a.dataset.index)-Number(b.dataset.index));for(const item of items)listPanel.append(item);});
  const pageNav=el('div',null,'tm-pagination');if(next)pageNav.append(btn('Première page',()=>run(()=>list(key))));if(d.next)pageNav.append(btn('Page suivante',()=>run(()=>list(key,d.next))));if(pageNav.children.length)listPanel.append(pageNav);
  notice('');await counts();
 }
 async function read(id,selected){
  const {message:m}=await request('/copies/'+encodeURIComponent(id)+'/read','POST',{});
  closeReader();content.classList.add('tm-reading-open');selected.setAttribute('aria-pressed','true');selected.classList.remove('unread');selected.closest('.tm-mail-entry')?.querySelector('.tm-dot')?.remove();
  const bar=el('div',null,'tm-reader-toolbar');bar.append(withIcon('Retour','back',()=>{closeReader();selected.focus();}));
  const action=(label,key,ico,cls)=>withIcon(label,ico,()=>run(()=>perform(id,key)),cls||'tm-button');
  if(m.trashed){bar.append(action('Restaurer','restore','restore'),action('Supprimer définitivement','delete','trash','tm-button tm-danger'));}
  else{bar.append(action(m.starred?'Retirer des favoris':'Ajouter aux favoris',m.starred?'unstar':'star','favorites'),action(m.archived?'Désarchiver':'Archiver',m.archived?'unarchive':'archive','archive'),action('Corbeille','trash','trash','tm-button tm-danger'));}
  const title=el('h3',m.subject||'Sans objet','tm-reader-subject'),sender=el('div',null,'tm-reader-sender'),info=el('div',null,'tm-reader-names');info.append(el('strong',m.from),el('small','À : '+m.to),el('small',date(m.date)));sender.append(avatar(m.from),info);
  const body=safeBody(m.body),bottom=el('div',null,'tm-reader-bottom');
  if(!m.trashed){const to=m.folder==='sent'?m.to:m.from;if(/^[^@]+@[a-z0-9-]+\.taskly\.test$/i.test(to))bottom.append(withIcon('Répondre','reply',()=>run(()=>compose({to,subject:('Re : '+(m.subject||'')).slice(0,200),body:''})),'tm-new'));bottom.append(withIcon('Transférer','forward',()=>run(()=>compose({to:'',subject:('Tr : '+(m.subject||'')).slice(0,200),body:'\n\n--- Message transféré ---\nDe : '+m.from+'\n'+m.body}))));}
  reader.replaceChildren(bar,title,sender,body,bottom);await counts();notice('');
 }
 async function showDraft(){
  if(!leave())return;stopAuto();dirty=false;activate('draft');const {draft:d}=await request('/draft');const title=heading('draft'),card=el('div',null,'tm-draft-board');content.className='tm-mail-content tm-drafts-view';content.replaceChildren(title,card);const exists=[d.to,d.subject,d.body].some(Boolean);
  if(exists&&(!search||[d.to,d.subject,d.body].join(' ').toLowerCase().includes(search.toLowerCase()))){
   title.querySelector('.tm-view-name h3').append(el('span','1','tm-heading-count'));const item=el('div',null,'tm-draft-row'),summary=el('div',null,'tm-draft-summary');summary.append(icon('draft'),el('strong',d.subject||'Sans objet'),el('small','À : '+(d.to||'(destinataire à renseigner)')),el('p',d.body.slice(0,150)||'Message à compléter'));
   const actions=el('div',null,'tm-draft-actions');actions.append(withIcon('Continuer la rédaction','edit',()=>run(()=>compose()),'tm-button tm-green-outline'),withIcon('Supprimer','trash',()=>run(async()=>{if(!(await confirmation('Supprimer ce brouillon ?','Cette action effacera votre brouillon enregistré.','Supprimer')))return;await request('/draft','DELETE');await showDraft();notice('Brouillon supprimé.');}),'tm-button tm-danger'));
   item.append(summary,actions);card.append(item);
  }else card.append(empty('Aucun brouillon','Commencez un message, puis enregistrez-le pour le retrouver ici.','draft'));
  card.append(el('p','Votre brouillon est enregistré uniquement dans cet espace Taskly. Un brouillon à la fois est pris en charge.','tm-draft-foot'));notice('');
 }
 function field(title,tag='input'){const node=el('label',null,'tm-field'),name=el('span',title),input=el(tag);node.append(name,input);return {node,input};}
 async function compose(initial=null){
  if(!leave())return;stopAuto();const {draft:saved}=await request('/draft');
  if(initial&&[saved.to,saved.subject,saved.body].some(Boolean)&&!confirm('Ouvrir une nouvelle rédaction ? Votre brouillon enregistré sera conservé tant que vous ne l’enregistrez pas à nouveau.'))return;
  const d=initial||saved;dirty=Boolean(initial);activate('draft');content.className='tm-mail-content tm-compose-view';
  const top=el('header',null,'tm-compose-header');const backButton=withIcon('Retour','back',()=>run(()=>switchFolder('inbox')),'tm-button tm-compose-back');const head=el('div');head.append(el('h3','Nouveau message'),el('p','Communication interne Taskly · Adresse personnelle protégée'));top.append(backButton,icon('edit'),head);
  const to=field('Destinataire'),subject=field('Objet'),body=field('Message','textarea');to.node.classList.add('tm-compose-to');subject.node.classList.add('tm-compose-subject');body.node.classList.add('tm-compose-body');to.node.querySelector('span').textContent='À';to.input.setAttribute('aria-label','Destinataire');to.input.type='email';to.input.maxLength=254;to.input.placeholder='Adresse Taskly du destinataire';subject.input.maxLength=200;subject.input.placeholder='Objet de votre message';body.input.maxLength=32000;body.input.rows=10;body.input.placeholder='Rédigez votre message...';to.input.value=d.to||'';subject.input.value=d.subject||'';body.input.value=d.body||'';
  // Les champs restent des contrôles HTML natifs et accessibles au clavier.
  const adorn=(field,iconName)=>{const label=field.node.querySelector('span'),control=el('span',null,'tm-compose-control');control.append(icon(iconName),field.input);field.node.replaceChildren(label,control);};
  adorn(to,'user');adorn(subject,'tag');
  // L'envoi n'accepte actuellement qu'un seul destinataire Taskly : pas de faux Cc/Cci.
  const recipientRow=el('div',null,'tm-compose-recipient-row');recipientRow.append(to.node);
  const copies=el('span',null,'tm-compose-copies');for(const name of ['Cc','Cci']){const b=btn(name,()=>{},'tm-compose-copy-button');b.disabled=true;b.title='Destinataires multiples indisponibles dans cette version';b.setAttribute('aria-label',name+' — indisponible');copies.append(b);}recipientRow.append(copies);
  if(!body.input.value&&prefs.signature_enabled&&prefs.signature.trim())body.input.value='\n\n'+prefs.signature.trim();
  const currentValues=()=>({to:to.input.value.trim(),subject:subject.input.value,body:body.input.value});
  const save=async(auto=false)=>{const result=await request('/draft','PUT',currentValues());dirty=false;if(!auto)notice(result.message||'Brouillon enregistré.');else feedback.textContent='Brouillon sauvegardé automatiquement.';};
  const feedback=el('span',prefs.auto_save?'Enregistrement automatique activé':'Enregistrement manuel','tm-compose-feedback');
  const formatting=el('div',null,'tm-format-toolbar');formatting.setAttribute('role','toolbar');formatting.setAttribute('aria-label','Mise en forme du message');
  const marker=(left,right=left)=>{const input=body.input;const a=input.selectionStart,b=input.selectionEnd,value=input.value,part=value.slice(a,b);input.value=value.slice(0,a)+left+part+right+value.slice(b);input.focus();input.setSelectionRange(a+left.length,b+left.length);input.dispatchEvent(new Event('input',{bubbles:true}));};
  const linePrefix=(text)=>{const input=body.input;const a=input.selectionStart;const pos=input.value.lastIndexOf('\n',a-1)+1;input.value=input.value.slice(0,pos)+text+input.value.slice(pos);input.focus();input.setSelectionRange(a+text.length,a+text.length);input.dispatchEvent(new Event('input',{bubbles:true}));};
  for(const [name,label,fn] of [['B','Gras',()=>marker('**')],['I','Italique',()=>marker('*')],['U','Souligné',()=>marker('__')],['•','Liste à puces',()=>linePrefix('- ')],['1.','Liste numérotée',()=>linePrefix('1. ')]] ) {const button=btn(name,fn,'tm-format-button');button.setAttribute('aria-label',label);button.title=label+' (notation texte)';formatting.append(button);}
  const formatSep=el('span',null,'tm-format-separator');formatting.append(formatSep);const linkBtn=withIcon('Lien','link',()=>marker('https://',''),'tm-format-button tm-format-icon');linkBtn.title='Insérer une adresse web';formatting.append(linkBtn);
  const formatTip=el('span','Mise en forme texte','tm-format-hint');formatting.append(formatTip);
  // Le serveur ne stocke pas encore les pièces jointes : le contrôle est désactivé honnêtement.
  const attach=withIcon('Joindre un fichier','attach',()=>{},'tm-button tm-compose-attachment');attach.disabled=true;attach.title='Pièces jointes non disponibles : aucune pièce ne sera transmise';attach.setAttribute('aria-label','Joindre un fichier — indisponible');
  for(const input of [to.input,subject.input,body.input])input.addEventListener('input',()=>{dirty=true;feedback.textContent='Modifications non enregistrées';stopAuto();if(prefs.auto_save)autoTimer=setTimeout(()=>{autoTimer=null;if(!busy&&dirty)run(()=>save(true));},8000);});
  const bar=el('div',null,'tm-mail-actions tm-compose-actions');
  const saveButton=withIcon('Enregistrer le brouillon','save',()=>run(async()=>{stopAuto();await save();}));
  const deleteButton=withIcon('Effacer le brouillon','trash',()=>run(async()=>{if(!(await confirmation('Supprimer le brouillon ?','Cette action efface votre brouillon enregistré.','Supprimer')))return;stopAuto();await request('/draft','DELETE');dirty=false;await showDraft();notice('Brouillon supprimé.');}),'tm-button tm-danger');
  const cancelButton=withIcon('Annuler','close',()=>run(()=>switchFolder('inbox')));
  const sendButton=withIcon('Envoyer','sent',()=>run(async()=>{
   stopAuto();const v=currentValues();if(!v.to||!to.input.checkValidity()||!v.subject.trim()||!v.body.trim())throw Error('Destinataire, objet et message requis.');
   if(!/^[^@]+@[a-z0-9-]+\.taskly\.test$/i.test(v.to))throw Error('Seules les adresses Taskly internes sont disponibles actuellement.');
   if(!confirm('Envoyer ce message à '+v.to+' ?'))return;
   const sig=JSON.stringify(v);if(sendSignature!==sig||!sendKey){sendKey=uuid();sendSignature=sig;}
   const response=await request('/send','POST',{...v,key:sendKey});dirty=false;sendKey=null;sendSignature=null;await list('sent');notice((response.message||'Message envoyé.')+' Le brouillon enregistré reste disponible.');
  }),'tm-new');
  const more=el('details',null,'tm-compose-more');more.append(el('summary','Autres actions'),deleteButton,cancelButton);
  bar.append(more,saveButton,sendButton);
  const sender=el('div',null,'tm-compose-from');sender.append(el('strong','De : '),el('span',account.address));
  const form=el('div',null,'tm-compose-form'),editor=el('section',null,'tm-compose-editor');editor.append(formatting,body.node);
  const statusRow=el('div',null,'tm-compose-status');statusRow.append(feedback,el('span','Les codes de sécurité restent envoyés uniquement à votre e-mail personnel.','tm-compose-security'));
  const foot=el('footer',null,'tm-compose-footer'),fileTools=el('div',null,'tm-compose-file-tools');fileTools.append(attach);foot.append(fileTools,bar);
  form.append(sender,recipientRow,subject.node,editor,statusRow,foot);content.replaceChildren(top,form);notice('');
 }
 function switchSetting(name,label,subtitle){const row=el('label',null,'tm-pref-row'),text=el('span',null,'tm-pref-desc');text.append(el('strong',label));if(subtitle)text.append(el('small',subtitle));const c=el('input');c.type='checkbox';c.checked=Boolean(prefs[name]);c.dataset.preference=name;const track=el('span',null,'tm-toggle-track');row.append(text,c,track);return row;}
 function infoRow(label,value){const r=el('div',null,'tm-pref-info');r.append(el('strong',label),el('span',value));return r;}
 function prefCard(name,title,subtitle){const c=el('section',null,'tm-settings-card');c.id='tm-setting-'+name;const h=el('div',null,'tm-settings-card-heading'),head=el('div');head.append(el('h4',title),el('small',subtitle));h.append(icon(name==='links'?'lock':name==='privacy'?'shield':name==='notifications'?'bell':name==='signature'?'edit':name==='display'?'eye':name==='security'?'shield':'settings'),head);c.append(h);return c;}
 function settings(){if(!leave())return;stopAuto();dirty=false;activate('settings');content.className='tm-mail-content tm-settings-view';
  const heading=el('div',null,'tm-settings-title');heading.append(icon('settings'),el('div',null));heading.lastChild.append(el('h3','Paramètres de Taskly Mail'),el('p','Personnalisez votre messagerie et vos préférences de confidentialité.'));
  if(!prefsReady){content.replaceChildren(heading,el('p','Impossible de charger les paramètres depuis le serveur. Vérifiez que la migration Premium V2 est appliquée.','tm-pref-error'));return;}
  const settingsLayout=el('div',null,'tm-settings-layout'),tabs=el('nav',null,'tm-settings-tabs'),grid=el('div',null,'tm-settings-grid');tabs.setAttribute('aria-label','Rubriques de paramètres');
  const categories=[['general','Général','settings'],['notifications','Notifications','bell'],['signature','Signature','edit'],['security','Sécurité','shield'],['links','Liens de consultation','lock'],['display','Affichage','eye'],['privacy','Confidentialité','user']];
  // Un seul panneau de paramètres à la fois, sans perdre les modifications non enregistrées.
  tabs.setAttribute('role','tablist');
  const tabButtons=new Map();
  function selectSettingsCategory(id,focus=false){
   if(!categories.some(c=>c[0]===id))id='general';
   activeSettingsCategory=id;
   for(const [name] of categories){
    const button=tabButtons.get(name),panel=grid.querySelector('#tm-setting-'+name),selected=name===id;
    button.classList.toggle('active',selected);
    button.setAttribute('aria-selected',String(selected));
    button.tabIndex=selected?0:-1;
    if(panel)panel.hidden=!selected;
   }
   if(focus)tabButtons.get(id).focus();
  }
  for(const [id,label,ico] of categories){
   const tab=withIcon(label,ico,()=>selectSettingsCategory(id),'tm-settings-tab');
   tab.type='button';tab.id='tm-setting-tab-'+id;tab.setAttribute('role','tab');
   tab.setAttribute('aria-controls','tm-setting-'+id);tabButtons.set(id,tab);tabs.append(tab);
  }
  tabs.addEventListener('keydown',event=>{
   if(!['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End'].includes(event.key))return;
   const ids=categories.map(row=>row[0]),index=ids.indexOf(activeSettingsCategory);
   const next=event.key==='Home'?0:event.key==='End'?ids.length-1:
    (index+(event.key==='ArrowDown'||event.key==='ArrowRight'?1:-1)+ids.length)%ids.length;
   event.preventDefault();selectSettingsCategory(ids[next],true);
  });
  const general=prefCard('general','Général','Préférences de votre messagerie.');general.append(infoRow('Langue de l’interface','Français'),infoRow('Adresse Taskly',account.address),switchSetting('auto_save','Enregistrement automatique des brouillons','Sauvegarde après 8 secondes sans saisie.'));
  const notifications=prefCard('notifications','Notifications par e-mail personnel','Une alerte lors de l’arrivée d’un message.');notifications.append(switchSetting('notify_email','Recevoir les notifications dans mon e-mail personnel','Le message reste dans Taskly Mail ; aucun code de sécurité n’y est envoyé.'),el('p','Les e-mails de connexion et de vérification restent envoyés directement à votre adresse personnelle, quel que soit ce réglage.','tm-pref-note'));
  const signature=prefCard('signature','Signature professionnelle','Ajout automatique dans les nouvelles rédactions.');signature.append(switchSetting('signature_enabled','Activer ma signature','Insérée dans le corps des nouveaux messages.'));const sign=field('Texte de votre signature','textarea');sign.input.rows=5;sign.input.maxLength=1200;sign.input.value=prefs.signature;sign.input.placeholder='Cordialement,\nVotre nom\nVotre activité';sign.input.dataset.preference='signature';signature.append(sign.node);
  const security=prefCard('security','Sécurité','Évitez les suppressions accidentelles.');security.append(switchSetting('confirm_delete','Demander confirmation avant suppression','Protège les déplacements vers la corbeille. La suppression définitive exige toujours confirmation.'));const profileHref=(u.role==='artisan'?'/espace/artisan/profil':'/espace/client/profil');const profileLink=el('a','Gérer le mot de passe et les données personnelles','tm-pref-link');profileLink.href=profileHref;security.append(profileLink);
  const links=prefCard('links','Liens de consultation sécurisés','Lecture externe limitée sans connexion.');links.append(infoRow('Durée de validité','30 minutes (fixée par sécurité)'),infoRow('Nombre d’utilisations','1 seule consultation'),infoRow('Répondre ou consulter d’autres messages','Connexion obligatoire'),el('p','Ces protections ne sont pas modifiables depuis Taskly Mail.','tm-pref-note'));
  const display=prefCard('display','Préférences d’affichage','Personnalisez la liste des messages.');display.append(switchSetting('preview_enabled','Afficher un aperçu du message','Montre les premières lignes sous l’objet.'));
  const privacy=prefCard('privacy','Confidentialité','Votre identité et vos échanges sont protégés.');privacy.append(infoRow('Adresse e-mail personnelle','Non visible par les autres utilisateurs'),infoRow('Adresse professionnelle active',account.address),infoRow('Messages internes','Consultables uniquement par le destinataire'));
  grid.append(general,notifications,signature,security,links,display,privacy);
  for(const [id] of categories){const panel=grid.querySelector('#tm-setting-'+id);panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','tm-setting-tab-'+id);panel.tabIndex=0;}
  selectSettingsCategory(activeSettingsCategory);
  const actions=el('div',null,'tm-settings-actions');const reset=withIcon('Réinitialiser','refresh',()=>{if(!confirm('Réinitialiser les préférences de cet espace ?'))return;Object.assign(prefs,defaults);settings();});const save=withIcon('Enregistrer les modifications','check',()=>run(async()=>{const next={...prefs};grid.querySelectorAll('[data-preference]').forEach(x=>{next[x.dataset.preference]=x.type==='checkbox'?x.checked:x.value;});const r=await request('/preferences','PUT',next);prefs={...defaults,...r.preferences};notice('Paramètres enregistrés.');settings();notice(r.message||'Paramètres enregistrés.');}),'tm-new');actions.append(reset,save);
  settingsLayout.append(tabs,grid);content.replaceChildren(heading,settingsLayout,actions);notice('');
 }
 await getPrefs();await list('inbox');
};
