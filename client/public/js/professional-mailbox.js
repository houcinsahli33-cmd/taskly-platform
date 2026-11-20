'use strict';
// Interface texte uniquement : aucun HTML reçu d'un e-mail n'est interprété.
window.afficherTasklyMailbox=async function(root,status){
 const base='/api/taskly-mail/mailbox',section=document.createElement('section');section.className='taskly-mailbox';root.append(section);
 let version=0,busy=false,sendKey=null,sendSignature=null;
 const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e;};
 function button(label,fn,cls='outline'){const e=text('button',label);e.type='button';e.className='btn '+cls;e.addEventListener('click',fn);return e;}
 function field(label,tag='input'){const l=document.createElement('label'),e=document.createElement(tag);e.className='form-control';l.append(text('span',label),e);return {l,e};}
 function message(value){status.textContent=value;}
 async function request(route,payload,method='POST'){return requeteAPI(base+route,{method,...(payload===undefined?{}:{body:JSON.stringify(payload)})});}
 async function run(fn){if(busy)return;busy=true;section.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){message(e.message);}finally{busy=false;section.querySelectorAll('button').forEach(b=>b.disabled=false);}}
 async function state(){const result=await requeteAPI(base);if(!section.isConnected)return;section.replaceChildren();
  if(result.state==='waiting_provider'){section.append(text('p','Création de la boîte en attente du fournisseur.'));return;}
  if(result.state==='activation_required'){
   const code=field('Code d’activation reçu sur votre adresse personnelle');code.e.inputMode='numeric';code.e.maxLength=6;code.e.autocomplete='one-time-code';
   section.append(text('h3','Activer votre boîte professionnelle'),button('Envoyer le code',()=>run(async()=>{const r=await request('/activation/request',{});message(r.message);}), 'primary'),code.l,button('Activer mon accès',()=>run(async()=>{const r=await request('/activation/confirm',{code:code.e.value.trim()});await state();message(r.message);}),'primary'));return;
  }
  if(result.state!=='active')throw Error('État de la messagerie inconnu.');
  if(result.foldersEnabled&&typeof window.afficherTasklyMailFolders==='function'){await window.afficherTasklyMailFolders(section,status,result);return;}
  section.append(text('h3','Votre boîte professionnelle'),text('p',result.address),text('p','Accès réservé à votre profil Taskly.'));
  const nav=document.createElement('div');nav.className='taskly-mailbox-nav';const content=document.createElement('div');content.className='taskly-mailbox-content';section.append(nav,content);
  nav.append(button('Boîte de réception',()=>run(()=>list('inbox'))),button('Messages envoyés',()=>run(()=>list('sent'))),button('Rédiger / brouillon',()=>run(compose),'primary'));
  async function list(folder,cursor){const v=++version;const query=new URLSearchParams({folder});if(cursor)query.set('cursor',cursor);const d=await requeteAPI(base+'/messages?'+query.toString());if(v!==version||!section.isConnected)return;content.replaceChildren(text('h3',folder==='inbox'?'Boîte de réception':'Messages envoyés'));if(!d.messages.length)content.append(text('p','Aucun message dans cette page.'));
   for(const m of d.messages){const b=button((folder==='inbox'?m.from:m.to)+' — '+(m.subject||'Sans objet'),()=>run(async()=>{const result=await requeteAPI(base+'/messages/'+encodeURIComponent(m.id));if(!section.isConnected)return;const x=result.message;const body=text('pre',x.body);body.className='taskly-mail-body';content.replaceChildren(button('Retour aux messages',()=>run(()=>list(folder,cursor))),text('h3',x.subject||'Sans objet'),text('p','De : '+x.from),text('p','À : '+x.to),text('p',new Date(x.date).toLocaleString('fr-FR')),body); }));b.classList.add('taskly-mail-row');content.append(b);}
   if(cursor)content.append(button('Première page',()=>run(()=>list(folder))));if(d.next)content.append(button('Page suivante',()=>run(()=>list(folder,d.next))));message('Messages chargés.');
  }
  async function compose(){++version;const d=(await requeteAPI(base+'/draft')).draft;if(!section.isConnected)return;const to=field('Destinataire'),subject=field('Objet'),body=field('Message','textarea');to.e.type='email';to.e.maxLength=254;subject.e.maxLength=200;body.e.maxLength=32000;body.e.rows=9;to.e.value=d.to;subject.e.value=d.subject;body.e.value=d.body;
   const values=()=>({to:to.e.value.trim(),subject:subject.e.value,body:body.e.value});
   content.replaceChildren(text('h3','Nouveau message'),text('p','Un brouillon par profil. Enregistrez avant de quitter cette rubrique.'),to.l,subject.l,body.l);
   content.append(button('Enregistrer le brouillon',()=>run(async()=>{const r=await request('/draft',values(),'PUT');message(r.message);})),button('Effacer le brouillon',()=>run(async()=>{if(!confirm('Supprimer ce brouillon ?'))return;await request('/draft',undefined,'DELETE');sendKey=null;sendSignature=null;await compose();message('Brouillon supprimé.');}),'danger'),button('Envoyer',()=>run(async()=>{
    const value=values(),signature=JSON.stringify(value);if(!to.e.checkValidity()||!value.to||!value.subject.trim()||!value.body.trim()){message('Destinataire, objet et message requis.');return;}if(!confirm('Envoyer le message à '+value.to+' ?'))return;if(signature!==sendSignature||!sendKey){sendSignature=signature;sendKey=crypto.randomUUID();}
    const r=await request('/send',{...value,key:sendKey});sendKey=null;sendSignature=null;to.e.value='';subject.e.value='';body.e.value='';message(r.message+' Le brouillon enregistré est conservé ; supprimez-le si nécessaire.');
   }),'primary'));
  }
  await list('inbox');
 }
 try{await state();}catch(e){message(e.message);}
};
