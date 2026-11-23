/* V10 administrative mailbox: isolated 3-column UI. No dummy data. */
(()=>{'use strict';
const base='/api/admin/taskly-mail-v10';
const create=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
const btn=(label,fn,cls)=>{const x=create('button',cls||'',label);x.type='button';x.addEventListener('click',fn);return x;};
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
 const counts=[];for(const name of ['Non lus','Aujourd’hui','Avec pièces jointes']){const card=create('div','tmv6-kpi');card.append(create('span','tmv6-kpi-icon','✉'));const content=create('div');content.append(create('span','',name));const value=create('strong','','—');counts.push(value);content.append(value);card.append(content);kpis.append(card);}
 const tools=create('label','tmv6-search');tools.append(create('span','','⌕'));const search=create('input');search.type='search';search.placeholder='Rechercher un e-mail (expéditeur, sujet…)';search.setAttribute('aria-label','Rechercher un e-mail');tools.append(search);const items=create('div','tmv6-message-list');list.append(tools,items);
 const folderLabels=[['inbox','Réception'],['sent','Envoyés'],['draft','Brouillons'],['favorites','Favoris'],['archive','Archives'],['trash','Corbeille']];let active='inbox',selected=null,cache=[],ready=false;
 const q=(path,method,body)=>window.requeteAPI(base+path,{method:method||'GET',...(body===undefined?{}:{body:JSON.stringify(body)})});
 const msg=t=>{notice.textContent=t||'';};
 const error=e=>msg(e?.message||'Service temporairement indisponible.');
 const ids={};
 function showEmpty(){reader.replaceChildren(create('div','tmv6-read-placeholder','Sélectionnez un e-mail pour consulter son contenu.'));}
 function render(){items.replaceChildren();if(!cache.length)items.append(create('p','tmv6-read-placeholder',active==='draft'?'Brouillons non disponibles dans cette version.':'Aucun message dans ce dossier.'));
 for(const m of cache){const x=btn('',()=>open(m.id),'tmv6-mail-item'+(m.id===selected?' is-active':''));const av=create('span','tmv6-avatar',(m.from||'T')[0].toUpperCase());const info=create('div','tmv6-mail-copy');info.append(create('strong','',m.from||''),create('span','tmv6-subject',m.subject||'Sans objet'),create('small','',m.preview||''));x.append(av,info);items.append(x);}}
 async function load(){if(!ready)return;if(active==='draft'){cache=[];render();showEmpty();try{const data=await q('/draft');compose(data.draft.to,data.draft.subject,data.draft.body);}catch(e){error(e);}return;}
  try{const data=await q('/messages?folder='+encodeURIComponent(active)+'&q='+encodeURIComponent(search.value.trim()));cache=data.messages||[];render();showEmpty();msg('');}
  catch(e){cache=[];render();error(e);}}
 async function refresh(){if(!ready)return;try{const c=await q('/counts');counts[0].textContent=c.unread;counts[1].textContent=c.today;counts[2].textContent=c.attachments==null?'—':c.attachments;}catch(e){error(e);}}
 async function act(id,action){try{await q('/messages/'+encodeURIComponent(id)+'/action','POST',{action});await Promise.all([load(),refresh()]);}catch(e){error(e);}}
 async function open(id){try{const result=await q('/messages/'+encodeURIComponent(id)+'/read','POST');const m=result.message;selected=id;render();reader.replaceChildren();const head=create('header','tmv6-read-head'),who=create('div','tmv6-read-who');who.append(create('span','tmv6-avatar',(m.from||'T')[0].toUpperCase()));const info=create('div');info.append(create('strong','',m.from),create('div','','À : '+m.to));who.append(info);head.append(who);const actions=create('div','tmv6-read-actions');for(const [label,action] of [['☆','star'],['Archiver','archive'],['Corbeille','trash']]){actions.append(btn(label,()=>act(id,action),'tmv6-icon-btn'));}if(active==='trash')actions.append(btn('Restaurer',()=>act(id,'restore'),'tmv6-icon-btn'));head.append(actions);const body=create('div','tmv6-read-body');body.append(create('h2','',m.subject),create('small','',new Date(m.date).toLocaleString('fr-FR')),create('pre','',m.body));reader.append(head,body);
  const dest=m.from==='administration@taskly.dz'?m.to:m.from;
  const reply=btn('Répondre',()=>compose(dest,'Re: '+m.subject),'tmv6-new');reader.append(reply);await refresh();msg('');}
 catch(e){error(e);}}
 function compose(to='',subject='',savedBody=''){reader.replaceChildren();const area=create('form','tmv10-compose');area.append(create('h2','','Nouveau message'));const dest=create('input');dest.required=true;dest.maxLength=254;dest.value=to;dest.placeholder='Destinataire Taskly';dest.setAttribute('aria-label','Destinataire');dest.setAttribute('list','tmv10-recipient-list');const suggestions=create('datalist');suggestions.id='tmv10-recipient-list';dest.addEventListener('input',async()=>{try{const data=await q('/recipients?q='+encodeURIComponent(dest.value));suggestions.replaceChildren();for(const recipient of data.recipients||[]){const opt=create('option');opt.value=recipient.address;suggestions.append(opt);}}catch(e){/* no recipient enumeration on failure */}});
 const topic=create('input');topic.required=true;topic.maxLength=200;topic.value=subject;topic.placeholder='Objet';topic.setAttribute('aria-label','Objet');const text=create('textarea');text.required=true;text.maxLength=10000;text.rows=7;text.value=savedBody;text.placeholder='Votre message';text.setAttribute('aria-label','Message');const send=create('button','tmv6-new','Envoyer');send.type='submit';const draft=btn('Enregistrer brouillon',async()=>{try{await q('/draft','PUT',{to:dest.value,subject:topic.value,body:text.value});msg('Brouillon enregistré.');}catch(e){error(e);}},'tmv6-icon-btn');area.append(dest,suggestions,topic,text,draft,send);area.addEventListener('submit',async ev=>{ev.preventDefault();if(!area.reportValidity())return;send.disabled=true;try{await q('/send','POST',{to:dest.value.trim(),subject:topic.value.trim(),body:text.value});try{await q('/draft','DELETE');}catch(_){/* message already delivered */}msg('Message envoyé dans Taskly Mail.');active='sent';select('sent');await refresh();}catch(e){error(e);}finally{send.disabled=false;}});reader.append(area);dest.focus();}
 const folderBtns={};function select(key){active=key;selected=null;for(const k in folderBtns)folderBtns[k].setAttribute('aria-current',k===key?'page':'false');load();}
 for(const [key,title] of folderLabels){const b=btn(title,()=>select(key),'tmv6-folder');folderBtns[key]=b;nav.append(b);}nav.append(btn('＋ Nouveau message',()=>compose(),'tmv6-new'));search.addEventListener('input',()=>{if(ready)load();});grid.append(nav,list,reader);root.replaceChildren(kpis,grid,notice);showEmpty();
 try{await q('/counts');ready=true;select('inbox');await refresh();}
 catch(e){msg('Messagerie administrative non accessible : '+(e?.message||'vérifiez l’activation du service et les autorisations.'));nav.querySelectorAll('button').forEach(b=>b.disabled=true);search.disabled=true;}
}
function boot(){
 init();
 // Reattempt only if the API bootstrap was not ready at first paint.
 const tab=document.getElementById('tmv3-tab-admin-mail');
 if(tab)tab.addEventListener('click',()=>{
  const root=document.getElementById('tmv6-admin-mail');
  if(initialized && root && typeof window.requeteAPI==='function' && root.querySelector('.tmv6-mail-grid')===null){initialized=false;init();}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
