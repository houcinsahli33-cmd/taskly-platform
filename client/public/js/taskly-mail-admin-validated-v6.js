/* TASKLY Mail Administration : habillage fidel e aux 3 captures validees.
   Toutes les donnees affichees proviennent des API autorisees. Aucune simulation de courrier. */
(()=>{
'use strict';
const shapes={mail:['M3 5h18v14H3z','m3 7 9 6 9-6'],chat:['M21 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-4 2v-7A7.5 7.5 0 0 1 10.5 6h3A7.5 7.5 0 0 1 21 13.5z'],inbox:['M3 4h18v15H3z','m3 12 5 0 2 3h4l2-3h5'],check:['m4 12 5 5 11-11'],clock:['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20','M12 6v6l4 2'],users:['M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M22 20v-2a4 4 0 0 0-3-3.87','M16 2.13a4 4 0 0 1 0 7.75'],tools:['M14.5 6.5 17.5 3.5l3 3-3 3','M2 21l9-9','M4 7l13 13','M2 3l5 2-2 5'],headset:['M3 14v-4a9 9 0 0 1 18 0v4','M3 14h4v6H5a2 2 0 0 1-2-2v-4','M21 14h-4v6h2a2 2 0 0 0 2-2v-4'],search:['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16','m17 17 5 5'],reply:['m9 10-5 5 5 5','M4 15h10a6 6 0 0 1 6 6'],archive:['M3 4h18v5H3z','M5 9v12h14V9','M9 13h6'],star:['m12 2 3.2 6.8 7.4 1.1-5.3 5.2 1.3 7.4-6.6-3.5-6.6 3.5 1.3-7.4-5.3-5.2 7.4-1.1z'],sent:['M22 2 11 13','m22 2-7 20-4-9-9-4z'],draft:['M5 3h10l4 4v14H5z','M9 12h6','M9 16h6'],trash:['M4 6h16','M7 6l1 15h8l1-15','M9 6V3h6v3'],calendar:['M3 5h18v16H3z','M7 2v6M17 2v6M3 10h18'],paperclip:['M21 11.5 12 20.5a6 6 0 0 1-8.5-8.5l9.5-9.5a4 4 0 0 1 5.7 5.7l-9.5 9.5a2 2 0 0 1-2.8-2.8L15 7.5'],plus:['M12 4v16M4 12h16'],forward:['m14 5 7 7-7 7','M21 12H4'],info:['M12 17v-5','M12 8h.01','M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20'],menu:['M5 6h14M5 12h14M5 18h14'],shield:['M12 2 3 6v7c0 5 4 8 9 9 5-1 9-4 9-9V6z'],favorite:['m12 2 3.2 6.8 7.4 1.1-5.3 5.2 1.3 7.4-6.6-3.5-6.6 3.5 1.3-7.4-5.3-5.2 7.4-1.1z']};
const E=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=String(txt);return e;};
function ico(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','tmv6-svg');svg.setAttribute('aria-hidden','true');for(const d of shapes[name]||shapes.mail){const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);svg.append(p);}return svg;}
function withIcon(e,name,only=false){if(!e||e.dataset.tmv6Icon)return;e.dataset.tmv6Icon='1';if(only)e.replaceChildren();e.prepend(ico(name));}
function mount(){
const page=document.querySelector('.tmv3-admin-page');if(!page)return;
page.dataset.tmv6='1';
const tabs=[['tmv3-tab-support','chat'],['tmv3-tab-mailboxes','mail'],['tmv3-tab-admin-mail','inbox']];
tabs.forEach(([id,name])=>withIcon(document.getElementById(id),name));
/* V8 : navigation commune a TROIS onglets. Le controle V3 precedent n'en connait que deux.
   Interception en capture pour neutraliser sa bascule partielle et l'ancienne page blanche. */
const fullTabs=['tmv3-tab-support','tmv3-tab-mailboxes','tmv3-tab-admin-mail'].map(id=>document.getElementById(id));
const fullPanels=['tmv3-view-support','tmv3-view-mailboxes','tmv3-view-admin-mail'].map(id=>document.getElementById(id));
function chooseTab(i){
 if(fullTabs.some(x=>!x)||fullPanels.some(x=>!x))return;
 fullTabs.forEach((tab,j)=>{tab.setAttribute('aria-selected',String(i===j));tab.tabIndex=i===j?0:-1;});
 fullPanels.forEach((panel,j)=>{panel.hidden=i!==j;panel.toggleAttribute('inert',i!==j);});
}
fullTabs.forEach((tab,i)=>{
 if(!tab)return;
 tab.addEventListener('click',ev=>{ev.stopImmediatePropagation();chooseTab(i);},true);
 tab.addEventListener('keydown',ev=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(ev.key))return;ev.preventDefault();ev.stopImmediatePropagation();const j=ev.key==='Home'?0:ev.key==='End'?2:(i+(ev.key==='ArrowRight'?1:2))%3;chooseTab(j);fullTabs[j].focus();},true);
});
chooseTab(0);
const metrics=document.querySelector('.tmv5-metrics');
const metricsMap=['headset','mail','users','tools','check'];
function decorateMetrics(){if(!metrics)return;metrics.querySelectorAll('.tmv5-metric-icon').forEach((e,i)=>{if(!e.querySelector('svg.tmv6-svg'))e.replaceChildren(ico(metricsMap[i]||'mail'));});}
const search=document.querySelector('.tmv5-find-wrap .tmv5-icon');if(search)search.replaceChildren(ico('search'));
const boxMap=['mail','check','clock'];document.querySelectorAll('.tmv3-mb-symbol').forEach((e,i)=>e.replaceChildren(ico(boxMap[i]||'mail')));
const actionMap=['reply','archive','check'];
function decorateActions(){document.querySelectorAll('.tmv5-actions button').forEach((b,i)=>{if(b.querySelector('svg.tmv6-svg'))return;const title=b.title||b.textContent;b.title=title;b.setAttribute('aria-label',title);b.replaceChildren(ico(actionMap[i%3]));});}
const observer=new MutationObserver(()=>{decorateMetrics();decorateActions();});
if(metrics)observer.observe(metrics,{childList:true});
const detail=document.querySelector('.tmv5-detail');if(detail)observer.observe(detail,{childList:true,subtree:false});
decorateMetrics();decorateActions();
const mailboxes=document.getElementById('mail-pilot-content');
const pilot=document.getElementById('professional-mail-pilot');
if(mailboxes&&pilot){
 const panel=pilot.querySelector('.panel-body');
 const hd=E('div','tmv6-mailbox-bar');
 const title=E('strong',null,'Boîtes de messagerie');
 const add=E('button','tmv6-action','＋ Ajouter une boîte');add.type='button';add.disabled=true;add.title='Création manuelle non disponible : API administrative à connecter après vérification des comptes.';
 hd.append(ico('mail'),title,add);
 if(panel)panel.prepend(hd);
 const tableHead=E('div','tmv6-table-head');['Adresse e-mail','Profil / Compte','Statut','Accès','Informations'].forEach(t=>tableHead.append(E('span',null,t)));
 if(panel)panel.insertBefore(tableHead,mailboxes);
}
const folderPanel=E('section','tmv6-folder-panel');const messagePanel=E('section','tmv6-message-panel');const readPanel=E('section','tmv6-read-panel');
const root=document.getElementById('tmv6-admin-mail');if(!root)return;
const kpis=E('div','tmv6-kpis');
const vals=[['mail','Non lus'],['calendar','Aujourd’hui'],['paperclip','Avec pièces jointes']];
const statEls=[];
for(const [n,title]of vals){const card=E('div','tmv6-kpi');const image=E('span','tmv6-kpi-icon');image.append(ico(n));const box=E('div');box.append(E('span',null,title));const strong=E('strong',null,'—');statEls.push(strong);box.append(strong);card.append(image,box);kpis.append(card);}
const grid=E('div','tmv6-mail-grid');grid.append(folderPanel,messagePanel,readPanel);
const notice=E('p','tmv6-error');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
root.replaceChildren(kpis,grid,notice);
const folders=[['inbox','Réception','inbox'],['sent','Envoyés','sent'],['draft','Brouillons','draft'],['favorites','Favoris','favorite'],['archive','Archives','archive'],['trash','Corbeille','trash']];
let current='inbox',messages=[],selected=null;
const folderBtns={};
function selectFolder(folder){current=folder;for(const key in folderBtns){folderBtns[key].setAttribute('aria-current',key===folder?'page':'false');}renderList();clearRead();}
for(const [key,label,icon]of folders){const b=E('button','tmv6-folder');b.type='button';b.append(ico(icon),E('span',null,label));b.addEventListener('click',()=>selectFolder(key));folderPanel.append(b);folderBtns[key]=b;}
const newBtn=E('button','tmv6-new');newBtn.append(ico('plus'),E('span',null,'Nouveau message'));
newBtn.disabled=true;newBtn.title='Envoi administratif non raccordé à une API autorisée dans les fichiers fournis.';folderPanel.append(newBtn);
const searchWrap=E('label','tmv6-search');searchWrap.append(ico('search'));const query=E('input');query.type='search';query.placeholder='Rechercher un e-mail (expéditeur, sujet…)';query.setAttribute('aria-label','Rechercher un e-mail');searchWrap.append(query);const settings=E('span','tmv8-search-options');settings.setAttribute('aria-hidden','true');settings.append(ico('menu'));searchWrap.append(settings);const items=E('div','tmv6-message-list');messagePanel.append(searchWrap,items);query.addEventListener('input',renderList);
function clearRead(){selected=null;readPanel.replaceChildren(E('div','tmv6-read-placeholder','Sélectionnez un e-mail pour consulter son contenu.'));}
function renderList(){items.replaceChildren();const q=query.value.trim().toLocaleLowerCase('fr-FR');const filtered=messages.filter(m=>(m.folder||'inbox')===current&&[m.subject,m.from,m.to,m.body].some(v=>String(v||'').toLocaleLowerCase('fr-FR').includes(q)));
 if(!filtered.length){items.append(E('p','tmv6-read-placeholder',messages.length?'Aucun message dans ce dossier.':'Aucun e-mail disponible dans la boîte administrative.'));return;}
 for(const m of filtered){const b=E('button','tmv6-mail-item'+(String(selected)===String(m.id)?' is-active':''));b.type='button';const av=E('span','tmv6-avatar',(m.from||'T')[0].toUpperCase());const copy=E('div','tmv6-mail-copy');copy.append(E('strong',null,m.from||'Expéditeur'),E('span','tmv6-subject',m.subject||'Sans objet'),E('small',null,m.preview||''));b.append(av,copy);b.addEventListener('click',()=>showMessage(m));items.append(b);}
}
function showMessage(m){selected=m.id;renderList();readPanel.replaceChildren();const h=E('header','tmv6-read-head');const who=E('div','tmv6-read-who');who.append(E('span','tmv6-avatar',(m.from||'T')[0].toUpperCase()));const whoText=E('div');whoText.append(E('strong',null,m.from||'Expéditeur'),E('div',null,'À : '+(m.to||'—')));who.append(whoText);h.append(who);
 const actions=E('div','tmv6-read-actions');for(const [n,title]of [['reply','Répondre'],['forward','Transférer'],['archive','Archiver'],['trash','Supprimer'],['favorite','Favoris']]){const b=E('button','tmv6-icon-btn');b.type='button';b.disabled=true;b.title=title+' indisponible sans API administrative';b.setAttribute('aria-label',title);b.append(ico(n));actions.append(b);}h.append(actions);
 const content=E('div','tmv6-read-body');content.append(E('h2',null,m.subject||'Sans objet'),E('small',null,m.date||''),E('pre',null,m.body||''));const bottom=E('div','tmv6-reply');const input=E('input');input.placeholder='Écrire une réponse…';input.disabled=true;const send=E('button','tmv6-action','Envoyer');send.disabled=true;bottom.append(ico('paperclip'),input,send);readPanel.append(h,content,bottom);
}
selectFolder('inbox');
/* Un vrai endpoint de boîte administrative n'est pas identifié dans les fichiers reçus.
   Il serait dangereux d'utiliser le endpoint personnel /api/taskly-mail/mailbox, ou d'afficher
   des mails de démonstration. Les actions restent désactivées jusqu'au raccordement vérifié. */
notice.textContent='Boîte administrative : connexion serveur à finaliser. Les e-mails de démonstration ne sont pas affichés.';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
