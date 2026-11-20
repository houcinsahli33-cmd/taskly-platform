'use strict';
// Les dossiers sont les copies propres au profil courant. Les identifiants de copie ne sont jamais des ID de compte.
window.afficherTasklyMailFolders=async function(section,status,account){
 const uuid=()=>{if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const hex=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');};
 const base='/api/taskly-mail/mailbox';let current='inbox',cursor=null,search='',version=0,busy=false,sendKey=null,signature=null,dirty=false;
 const el=(tag,t,cls)=>{const x=document.createElement(tag);if(t!=null)x.textContent=t;if(cls)x.className=cls;return x;};
 const btn=(label,fn,cls='tm-button')=>{const b=el('button',label,cls);b.type='button';b.addEventListener('click',fn);return b;};
const iconPaths={
 inbox:'M3 5h18v14H3z|m3 6 9 7 9-7',
 sent:'m22 2-7 20-4-9-9-4 20-7z|M22 2 11 13',
 draft:'M5 3h10l4 4v14H5z|M9 12h6M9 16h6',
 favorites:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
 archive:'M3 4h18v5H3z|M5 9v12h14V9|M9 13h6',
 trash:'M3 6h18|M9 6V3h6v3|M5 6l1 15h12l1-15|M10 10v7M14 10v7',
 settings:'M9 3h6l1 3 3 1 2 4-2 3v4l-4 2-3-2-3 2-4-2v-4l-2-3 2-4 3-1z|M15 12a3 3 0 1 0-6 0a3 3 0 1 0 6 0',
 plus:'M12 4v16M4 12h16',
 search:'M15 15l6 6|M17 10a7 7 0 1 0-14 0a7 7 0 1 0 14 0',
 edit:'m4 16 12-12 4 4-12 12H4z|m13 7 4 4',
 save:'M4 3h14l3 3v15H3V3z|M7 3v6h10V3|M7 21v-8h10v8',
 close:'M6 6l12 12M18 6 6 18',
 brand:'m3 12 9-9 9 9-9 9z|m8 12 3 3 6-6'
};
function icon(name){
 const ns='http://www.w3.org/2000/svg';
 const s=document.createElementNS(ns,'svg');
 s.setAttribute('viewBox','0 0 24 24');
 s.setAttribute('class','tm-icon');
 s.setAttribute('aria-hidden','true');
 for(const d of (iconPaths[name]||iconPaths.draft).split('|')){
  const p=document.createElementNS(ns,'path');
  p.setAttribute('d',d);
  s.append(p);
 }
 return s;
}
 const request=(url,method='GET',body)=>requeteAPI(base+url,{method,...(body===undefined?{}:{body:JSON.stringify(body)})});
 function notice(s){status.textContent=s||'';}
 async function run(fn){if(busy)return;busy=true;section.setAttribute('aria-busy','true');try{await fn();}catch(e){notice(e.message);}finally{busy=false;section.setAttribute('aria-busy','false');}}
 const labels={inbox:'Boîte de réception',sent:'Messages envoyés',draft:'Brouillons',favorites:'Favoris',archive:'Archives',trash:'Corbeille',settings:'Paramètres'};
 const symbols={inbox:'✉',sent:'➤',draft:'▤',favorites:'☆',archive:'▣',trash:'▥',settings:'⚙'};
 section.classList.add('tm-app');const heading=el('div',null,'tm-app-heading'),info=el('div');info.append(el('h2','Ma messagerie'),el('p',account.address));heading.append(info,el('span','● Compte actif','tm-active'));const shell=el('div',null,'tm-mail-shell'),tools=el('div',null,'tm-mail-tools'),nav=el('nav',null,'tm-mail-nav'),content=el('div',null,'tm-mail-content');
 const searchForm=el('form',null,'tm-mail-search'),searchInput=el('input');searchInput.type='search';searchInput.maxLength=100;searchInput.placeholder='Rechercher dans les messages';searchInput.setAttribute('aria-label','Rechercher dans les messages');const searchBtn=btn('Rechercher',()=>{},'tm-search-button');searchBtn.type='submit';searchForm.append(searchInput,searchBtn);searchForm.addEventListener('submit',e=>{e.preventDefault();if(current==='draft'&&!leave())return;
dirty=false;
search=searchInput.value.trim();
run(()=>list(['draft','settings'].includes(current)?'inbox':current));});
 const brand=el('div',null,'tm-brand');
brand.append(icon('brand'),el('span','Taskly'));
const newButton=btn('',()=>run(compose),'tm-new');
newButton.append(icon('plus'),el('span','Nouveau message'));
nav.append(brand,newButton);

searchForm.prepend(icon('search'));
searchInput.placeholder='Rechercher un message...';

const u=window.utilisateurCourant||{};
const name=[u.prenom,u.nom].filter(Boolean).join(' ')||'Mon compte';
const initials=name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();

info.replaceChildren(el('h2',name),el('p',account.address));
heading.replaceChildren(el('span',initials,'tm-profile-avatar'),info);
tools.append(searchForm,heading);

shell.append(nav,tools,content);
section.replaceChildren(shell);
 const buttons={};let badge;
 for(const [key,label] of Object.entries(labels)){const b=btn('',()=>run(()=>key==='draft'?compose():key==='settings'?settings():switchFolder(key)),'tm-folder');b.dataset.folder=key;b.append(icon(key),el('span',label));if(key==='inbox'){badge=el('b','','tm-unread-count');badge.hidden=true;b.append(badge);}buttons[key]=b;nav.append(b);}
 function active(key){current=key;for(const [k,b] of Object.entries(buttons)){b.classList.toggle('active',k===key);b.setAttribute('aria-current',k===key?'page':'false');}searchForm.hidden=false;}
 async function counts(){try{const d=await request('/counts');if(!Number.isSafeInteger(d.unread)||d.unread<0)throw Error();badge.textContent=d.unread>99?'99+':String(d.unread);badge.hidden=!d.unread;}catch{badge.hidden=true;}}
 function leave(){return !dirty||confirm('Quitter sans enregistrer les modifications du brouillon ?');}
 async function switchFolder(key){if(!leave())return;dirty=false;search='';searchInput.value='';await list(key);}
 function date(x){const d=new Date(x);return Number.isNaN(d.getTime())?'':d.toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'});}
 async function list(key,next=null){const v=++version;active(key);cursor=next;const q=new URLSearchParams({folder:key,q:search});if(next)q.set('cursor',next);const d=await request('/copies?'+q);if(v!==version||!section.isConnected)return;const top=el('header',null,'tm-mail-list-head');top.append(el('h3',labels[key]),btn('Actualiser',()=>run(()=>list(key,cursor))));content.replaceChildren(top);if(!d.messages.length)content.append(el('p','Aucun message dans ce dossier.','tm-empty'));for(const m of d.messages){const name=m.folder==='sent'?m.to:m.from,b=btn('',()=>run(()=>read(m.copyId)),'tm-mail-item'+(!m.isRead?' unread':''));b.append(el('span',String(name||'?')[0].toUpperCase(),'tm-mail-avatar'));const summary=el('span',null,'tm-mail-summary');summary.append(el('strong',name),el('span',m.subject||'Sans objet'));b.append(summary,el('time',date(m.date)));if(!m.isRead)b.append(el('i',null,'tm-dot'));content.append(b);}const bottom=el('div',null,'tm-mail-actions');if(next)bottom.append(btn('Première page',()=>run(()=>list(key))));if(d.next)bottom.append(btn('Page suivante',()=>run(()=>list(key,d.next))));content.append(bottom);notice('');await counts();}
 async function read(id){const {message:m}=await request('/copies/'+encodeURIComponent(id)+'/read','POST',{});const bar=el('div',null,'tm-mail-actions');bar.append(btn('← Retour',()=>run(()=>list(current,cursor))));const act=(label,action,cls)=>btn(label,()=>run(async()=>{await request('/copies/'+encodeURIComponent(id)+'/action','POST',{action});await list(current,cursor);}),cls);if(m.trashed)bar.append(act('Restaurer','restore'));else bar.append(act(m.starred?'Retirer des favoris':'Ajouter aux favoris',m.starred?'unstar':'star'),act(m.archived?'Désarchiver':'Archiver',m.archived?'unarchive':'archive'),act('Corbeille','trash','tm-button tm-danger'));const header=el('div',null,'tm-mail-reading');header.append(el('h3',m.subject||'Sans objet'),el('p','De : '+m.from),el('p','À : '+m.to),el('p',date(m.date)));content.replaceChildren(bar,header,el('pre',m.body,'taskly-mail-body'));await counts();notice('');}
 function field(label,tag='input'){const l=el('label',label,'tm-field'),e=el(tag);l.append(e);return {l,e};}
 async function compose(){if(dirty&&current==='draft')return;if(!leave())return;active('draft');const {draft:d}=await request('/draft'),to=field('Destinataire'),subject=field('Objet'),body=field('Message','textarea');to.e.type='email';to.e.maxLength=254;
to.e.placeholder='Adresse Taskly du destinataire...';
subject.e.placeholder='Saisissez l’objet de votre message...';
body.e.placeholder='Rédigez votre message...';subject.e.maxLength=200;body.e.maxLength=32000;body.e.rows=9;to.e.value=d.to;subject.e.value=d.subject;body.e.value=d.body;dirty=false;const values=()=>({to:to.e.value.trim(),subject:subject.e.value,body:body.e.value});for(const x of [to.e,subject.e,body.e])x.addEventListener('input',()=>dirty=true);const bar=el('div',null,'tm-mail-actions');bar.append(btn('Enregistrer le brouillon',()=>run(async()=>{const r=await request('/draft','PUT',values());dirty=false;notice(r.message);})),btn('Effacer le brouillon',()=>run(async()=>{if(!confirm('Supprimer ce brouillon ?'))return;await request('/draft','DELETE');dirty=false;sendKey=null;signature=null;await compose();notice('Brouillon supprimé.');}),'tm-button tm-danger'),btn('Envoyer',()=>run(async()=>{const v=values();if(!v.to||!to.e.checkValidity()||!v.subject.trim()||!v.body.trim())throw Error('Destinataire, objet et message requis.');if(!/^[^@]+@[a-z0-9-]+\.taskly\.test$/i.test(v.to))throw Error('Seules les adresses Taskly internes sont disponibles actuellement.');if(!confirm('Envoyer le message à '+v.to+' ?'))return;const sig=JSON.stringify(v);if(signature!==sig||!sendKey){sendKey=uuid();signature=sig;}const r=await request('/send','POST',{...v,key:sendKey});dirty=false;sendKey=null;signature=null;await list('sent');notice(r.message+' Le brouillon enregistré reste disponible.');}),'tm-new'));const header=el('header',null,'tm-compose-header');
const mark=el('div',null,'tm-compose-icon');
mark.append(icon('edit'));
const titles=el('div');
titles.append(
 el('h3','Nouveau message'),
 el('p','Messagerie interne sécurisée — destinataire Taskly uniquement.')
);
header.append(mark,titles);

const cancel=btn('Annuler',()=>run(()=>switchFolder('inbox')));
cancel.prepend(icon('close'));

const actions=Array.from(bar.children);
actions[0].prepend(icon('save'));
actions[1].prepend(icon('trash'));
actions[2].prepend(icon('sent'));

bar.insertBefore(cancel,actions[2]);
content.replaceChildren(header,to.l,subject.l,body.l,bar);notice('');}
 function settings(){if(!leave())return;dirty=false;active('settings');content.replaceChildren(el('h3','Paramètres'),el('p','Adresse professionnelle interne : '+account.address),el('p','Les connexions externes Gmail, Outlook et Yahoo ne sont pas encore configurées. Chaque espace Taskly possède sa propre boîte privée.'),el('p','Votre accès utilise la session Taskly sécurisée de cet espace.'));notice('');}
 await list('inbox');
};
