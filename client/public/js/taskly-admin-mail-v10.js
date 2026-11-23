/* V10 administrative mailbox: isolated 3-column UI. No dummy data. */
(()=>{'use strict';
const base='/api/admin/taskly-mail-v10';
const create=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
const btn=(label,fn,cls)=>{const x=create('button',cls||'',label);x.type='button';x.addEventListener('click',fn);return x;};
// Only built-in, fixed SVG paths; no user content is interpreted as markup.
const paths={inbox:['M3 4h18v16H3z','M3 13h5l2 3h4l2-3h5'],sent:['m22 2-9 20-4-9-9-4z','M22 2 9 13'],draft:['M4 3h12l4 4v14H4z','M8 12h8','M8 16h8'],favorites:['m12 2 3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z'],archive:['M3 4h18v5H3z','M5 9v12h14V9','M9 13h6'],trash:['M4 6h16','M7 6l1 15h8l1-15','M9 6V3h6v3'],reply:['m9 10-5 5 5 5','M4 15h10a6 6 0 0 1 6 6'],forward:['m15 4 6 6-6 6','M21 10H10a6 6 0 0 0-6 6'],search:['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16','m17 17 5 5'],calendar:['M3 5h18v16H3z','M7 2v6','M17 2v6','M3 10h18'],paperclip:['M21 11 12 20a6 6 0 0 1-8-8l9-9a4 4 0 0 1 6 6l-9 9a2 2 0 0 1-3-3l8-8'],mail:['M3 5h18v14H3z','m3 7 9 6 9-6'],star:['m12 2 3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z']};
function pict(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','tmv16-icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');for(const d of paths[name]||paths.mail){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);svg.append(path);}return svg;}

let initialized=false;
async function init(){
 if(initialized)return;
 const root=document.getElementById('tmv6-admin-mail');if(!root)return;
 initialized=true;
 if(typeof window.requeteAPI!=='function'){
  const notice=create('p','tmv6-error','Connexion au service Taskly Mail indisponible. Rechargez la page.');
  notice.setAttribute('role','status');
  root.replaceChildren(notice);
  return;
 }
 const kpis=create('div','tmv6-kpis'),grid=create('div','tmv6-mail-grid'),nav=create('nav','tmv6-folder-panel'),list=create('section','tmv6-message-panel'),reader=create('section','tmv6-read-panel'),notice=create('p','tmv6-error');
 nav.setAttribute('aria-label','Dossiers de la messagerie administrative');list.setAttribute('aria-label','Liste des e-mails');reader.setAttribute('aria-label','Lecture du courrier');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 const counts=[];for(const name of ['Non lus','Aujourd’hui','Avec pièces jointes']){const card=create('div','tmv6-kpi');const picture=create('span','tmv6-kpi-icon');picture.append(pict(name==='Non lus'?'mail':name==='Aujourd’hui'?'calendar':'paperclip'));card.append(picture);const content=create('div');content.append(create('span','',name));const value=create('strong','','—');counts.push(value);content.append(value);card.append(content);kpis.append(card);}
 const tools=create('label','tmv6-search');tools.append(pict('search'));const search=create('input');search.type='search';search.placeholder='Rechercher un e-mail (expéditeur, sujet…)';search.setAttribute('aria-label','Rechercher un e-mail');tools.append(search);const items=create('div','tmv6-message-list');list.append(tools,items);
 const folderLabels=[['inbox','Réception'],['sent','Envoyés'],['draft','Brouillons'],['favorites','Favoris'],['archive','Archives'],['trash','Corbeille']];let active='inbox',selected=null,cache=[],ready=false;
 const q=(path,method,body)=>window.requeteAPI(base+path,{method:method||'GET',...(body===undefined?{}:{body:JSON.stringify(body)})});
 const msg=t=>{notice.textContent=t||'';};
 const error=e=>msg(e?.message||'Service temporairement indisponible.');
 const ids={};
 function showEmpty(){reader.replaceChildren(create('div','tmv6-read-placeholder','Sélectionnez un e-mail pour consulter son contenu.'));}
 function render(){items.replaceChildren();if(!cache.length)items.append(create('p','tmv6-read-placeholder',active==='draft'?'Brouillons non disponibles dans cette version.':'Aucun message dans ce dossier.'));
 for(const m of cache){const x=btn('',()=>open(m.id),'tmv6-mail-item'+(m.id===selected?' is-active':''));const av=create('span','tmv6-avatar',(m.from||'T')[0].toUpperCase());const info=create('div','tmv6-mail-copy');const top=create('div','tmv16-mail-top');top.append(create('strong','',m.from||''));if(m.date){const d=new Date(m.date);if(!Number.isNaN(d.getTime()))top.append(create('time','',d.toLocaleString('fr-FR',{hour:'2-digit',minute:'2-digit'})));}info.append(top,create('span','tmv6-subject',m.subject||'Sans objet'),create('small','',m.preview||''));if(m.isRead===0||m.isRead===false)info.append(create('span','tmv16-unread','1'));x.append(av,info);items.append(x);}}
 async function load(){if(!ready)return;if(active==='draft'){cache=[];render();showEmpty();try{const data=await q('/draft');compose(data.draft.to,data.draft.subject,data.draft.body);}catch(e){error(e);}return;}
  try{const data=await q('/messages?folder='+encodeURIComponent(active)+'&q='+encodeURIComponent(search.value.trim()));cache=data.messages||[];render();showEmpty();msg('');}
  catch(e){cache=[];render();error(e);}}
 async function refresh(){if(!ready)return;try{const c=await q('/counts');counts[0].textContent=c.unread;counts[1].textContent=c.today;counts[2].textContent=c.attachments==null?'—':c.attachments;}catch(e){error(e);}}
 async function act(id,action){try{await q('/messages/'+encodeURIComponent(id)+'/action','POST',{action});await Promise.all([load(),refresh()]);}catch(e){error(e);}}
 async function open(id){try{const result=await q('/messages/'+encodeURIComponent(id)+'/read','POST');const m=result.message;selected=id;render();reader.replaceChildren();const head=create('header','tmv6-read-head'),who=create('div','tmv6-read-who');who.append(create('span','tmv6-avatar',(m.from||'T')[0].toUpperCase()));const info=create('div');info.append(create('strong','',m.from),create('div','','À : '+m.to));who.append(info);head.append(who);const actions=create('div','tmv6-read-actions');
  function actionButton(title,icon,fn){const b=btn('',fn,'tmv6-icon-btn');b.append(pict(icon));b.title=title;b.setAttribute('aria-label',title);return b;}
  actions.append(actionButton('Répondre','reply',()=>compose(m.from,'Re: '+m.subject)));
  actions.append(actionButton('Transférer','forward',()=>compose('','Tr: '+m.subject,'\n\n'+m.body)));
  actions.append(actionButton(m.starred?'Retirer des favoris':'Ajouter aux favoris','star',()=>act(id,m.starred?'unstar':'star')));
  actions.append(actionButton('Archiver','archive',()=>act(id,'archive')));
  actions.append(actionButton('Corbeille','trash',()=>act(id,'trash')));
  if(active==='trash')actions.append(actionButton('Restaurer','inbox',()=>act(id,'restore')));
  head.append(actions);const body=create('div','tmv6-read-body');body.append(create('h2','',m.subject),create('small','',new Date(m.date).toLocaleString('fr-FR')),create('pre','',m.body));reader.append(head,body);
  const dest=m.from==='administration@taskly.dz'?m.to:m.from;
  const replyForm=create('form','tmv16-reply-bar');const replyInput=create('textarea');replyInput.setAttribute('aria-label','Répondre au courrier');replyInput.placeholder='Écrire une réponse…';replyInput.rows=1;replyInput.required=true;replyInput.maxLength=10000;
  const replySend=create('button','tmv6-new','Envoyer');replySend.type='submit';replyForm.append(replyInput,replySend);
  replyForm.addEventListener('submit',async ev=>{ev.preventDefault();if(!replyForm.reportValidity())return;replySend.disabled=true;try{await q('/send','POST',{to:dest,subject:'Re: '+m.subject,body:replyInput.value});msg('Réponse envoyée.');replyInput.value='';await refresh();}catch(e){error(e);}finally{replySend.disabled=false;}});
  reader.append(replyForm);await refresh();msg('');}
 catch(e){error(e);}}
 function compose(to='',subject='',savedBody=''){reader.replaceChildren();const area=create('form','tmv10-compose');area.append(create('h2','','Nouveau message'));const dest=create('input');dest.required=true;dest.maxLength=254;dest.value=to;dest.placeholder='Destinataire Taskly';dest.setAttribute('aria-label','Destinataire');dest.setAttribute('list','tmv10-recipient-list');const suggestions=create('datalist');suggestions.id='tmv10-recipient-list';dest.addEventListener('input',async()=>{try{const data=await q('/recipients?q='+encodeURIComponent(dest.value));suggestions.replaceChildren();for(const recipient of data.recipients||[]){const opt=create('option');opt.value=recipient.address;suggestions.append(opt);}}catch(e){/* no recipient enumeration on failure */}});
 const topic=create('input');topic.required=true;topic.maxLength=200;topic.value=subject;topic.placeholder='Objet';topic.setAttribute('aria-label','Objet');const text=create('textarea');text.required=true;text.maxLength=10000;text.rows=7;text.value=savedBody;text.placeholder='Votre message';text.setAttribute('aria-label','Message');const send=create('button','tmv6-new','Envoyer');send.type='submit';const draft=btn('Enregistrer brouillon',async()=>{try{await q('/draft','PUT',{to:dest.value,subject:topic.value,body:text.value});msg('Brouillon enregistré.');}catch(e){error(e);}},'tmv6-icon-btn');area.append(dest,suggestions,topic,text,draft,send);area.addEventListener('submit',async ev=>{ev.preventDefault();if(!area.reportValidity())return;send.disabled=true;try{await q('/send','POST',{to:dest.value.trim(),subject:topic.value.trim(),body:text.value});try{await q('/draft','DELETE');}catch(_){/* message already delivered */}msg('Message envoyé dans Taskly Mail.');active='sent';select('sent');await refresh();}catch(e){error(e);}finally{send.disabled=false;}});reader.append(area);dest.focus();}
 const folderBtns={};function select(key){active=key;selected=null;for(const k in folderBtns)folderBtns[k].setAttribute('aria-current',k===key?'page':'false');load();}
 for(const [key,title] of folderLabels){const b=btn('',()=>select(key),'tmv6-folder');b.append(pict(key),create('span','',title));folderBtns[key]=b;nav.append(b);}const newButton=btn('',()=>compose(),'tmv6-new');newButton.append(pict('draft'),create('span','','Nouveau message'));nav.append(newButton);search.addEventListener('input',()=>{if(ready)load();});grid.append(nav,list,reader);root.replaceChildren(kpis,grid,notice);showEmpty();
 try{await q('/counts');ready=true;select('inbox');await refresh();}
 catch(e){msg('Messagerie administrative non accessible : '+(e?.message||'vérifiez la migration SQL et les autorisations.')+' Cliquez sur Réessayer.');const retry=btn('Réessayer',async()=>{retry.disabled=true;try{await q('/counts');ready=true;retry.remove();select('inbox');await refresh();msg('');}catch(err){error(err);retry.disabled=false;}},'tmv6-new');notice.append(retry);}
}
function boot(){
 // Always show the approved three-column shell, even when the API is disabled.
 function ensureMailPanel(){
  const root=document.getElementById('tmv6-admin-mail');
  if(!root)return;
  if(!initialized || !root.querySelector('.tmv6-mail-grid')){initialized=false;init();}
 }
 ensureMailPanel();
 const tab=document.getElementById('tmv3-tab-admin-mail');
 if(tab)tab.addEventListener('click',()=>{if(typeof window.requeteAPI==='function')ensureMailPanel();else ensureMailPanel();});
 window.addEventListener('taskly:admin-mail-visible',ensureMailPanel);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
