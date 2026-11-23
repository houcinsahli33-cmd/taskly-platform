/* Taskly Mail V3 - interface Administration. Aucune donnée fictive, aucune écriture hors réponse Support. */
(() => {
  'use strict';
  window.TasklyMailV3AdminUI = true;
  const mount = () => {
    const root = document.getElementById('taskly-mail-v3-support');
    const tabs = [document.getElementById('tmv3-tab-support'), document.getElementById('tmv3-tab-mailboxes')];
    const panes = [document.getElementById('tmv3-view-support'), document.getElementById('tmv3-view-mailboxes')];
    if (!root || tabs.some(x => !x) || panes.some(x => !x)) return;
    const make = (tag, cls, txt) => { const x=document.createElement(tag); if(cls)x.className=cls; if(txt!==undefined)x.textContent=String(txt); return x; };
    const button = (label, cls, fn) => { const x=make('button',cls,label); x.type='button'; x.addEventListener('click',fn); return x; };
    const switchTo = i => {tabs.forEach((t,n)=>{t.setAttribute('aria-selected',String(n===i));t.tabIndex=n===i?0:-1;panes[n].hidden=n!==i;});};
    tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>switchTo(i));tab.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=(i+(e.key==='ArrowRight'?1:-1)+2)%2;switchTo(next);tabs[next].focus();}});});
    const base='/api/admin/taskly-mail-service-v3';
    const request=(path,options={})=>window.requeteAPI(base+path,options);
    const state={threads:[],active:null,loading:false,filter:'all'};
    const msg=make('p','tmv3-status','Chargement des conversations…');msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');
    const stats=make('div','tmv3-stats');
    const controls=make('div','tmv3-controls');
    const search=make('input','tmv3-search');search.type='search';search.placeholder='Rechercher une conversation (email, sujet…)';search.setAttribute('aria-label','Rechercher une conversation');
    const filter=make('select','tmv3-filter');filter.setAttribute('aria-label','Filtrer les conversations');
    [['all','Toutes les conversations'],['client','Clients'],['artisan','Artisans']].forEach(([value,label])=>{const o=make('option',null,label);o.value=value;filter.append(o);});
    // Le backend n'expose pas le rôle dans la liste ; aucun filtrage client/artisan fictif.
    filter.hidden=true;
    const refresh=button('↻ Actualiser','tmv3-primary-soft',()=>load());
    controls.append(search,refresh);
    const layout=make('div','tmv3-conversation-layout');
    const left=make('section','tmv3-conversations');left.setAttribute('aria-label','Liste des conversations');
    const right=make('section','tmv3-thread-detail');right.setAttribute('aria-label','Détail de la conversation');
    layout.append(left,right);
    root.replaceChildren(stats,controls,msg,layout);
    function card(icon,title,value,subtitle){const x=make('div','tmv3-stat');x.append(make('span','tmv3-stat-icon',icon));const txt=make('div');txt.append(make('span','tmv3-stat-label',title),make('strong',null,String(value)));if(subtitle)txt.append(make('small',null,subtitle));x.append(txt);return x;}
    const date=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'});};
    const message=value=>{msg.textContent=value;};
    function renderStats(){stats.replaceChildren(card('▣','Conversations Support',state.threads.length,'50 dernières au maximum'),card('✉','Boîte de service','support@taskly.dz','Messagerie interne'),card('✓','Accès','Administrateur','Session contrôlée'));}
    function filtered(){const q=search.value.trim().toLocaleLowerCase('fr-FR');return state.threads.filter(t=>!q||String(t.subject||'').toLocaleLowerCase('fr-FR').includes(q)||String(t.user_address||'').toLocaleLowerCase('fr-FR').includes(q)||String(t.id).includes(q));}
    function renderList(){left.replaceChildren(make('h3',null,'Conversations ('+filtered().length+')'));const items=make('div','tmv3-conversation-items');for(const t of filtered()){
      const item=button('','tmv3-conversation'+(String(state.active)===String(t.id)?' is-active':''),()=>open(t.id));
      const head=make('span','tmv3-conversation-head');head.append(make('strong',null,t.user_address||'Compte Taskly'),make('small',null,date(t.updated_at)));
      item.append(head,make('span','tmv3-conversation-subject',t.subject||'Sans objet'),make('small','tmv3-conversation-meta','Conversation #'+t.id));items.append(item);
    }if(!items.children.length)items.append(make('p','tmv3-empty','Aucune conversation correspondante.'));left.append(items);}
    function emptyDetail(){right.replaceChildren(make('div','tmv3-placeholder','Sélectionnez une conversation à gauche pour consulter les messages et répondre depuis support@taskly.dz.'));}
    let currentRequest=0;
    async function open(id){if(state.loading)return;state.active=id;renderList();const seq=++currentRequest;right.replaceChildren(make('p','tmv3-status','Chargement de la conversation…'));
      try {const r=await request('/support/threads/'+encodeURIComponent(id));if(seq!==currentRequest)return;const t=r.thread||{};right.replaceChildren();
        const heading=make('div','tmv3-detail-heading');const identity=make('div');identity.append(make('strong',null,t.user_address||'Compte Taskly'),make('span',null,t.subject||'Sans objet'));
        heading.append(identity,make('span','tmv3-service-chip','Support'));right.append(heading);
        const notice=make('div','tmv3-detail-note','Réponse interne depuis support@taskly.dz · Conversations visibles seulement aux utilisateurs autorisés.');right.append(notice);
        const messages=make('div','tmv3-chat-messages');for(const entry of (r.entries||[])){
          const outgoing=entry.sender_kind==='admin';const wrap=make('article','tmv3-bubble '+(outgoing?'tmv3-bubble-admin':'tmv3-bubble-user'));
          const label=make('div','tmv3-bubble-label');label.append(make('strong',null,outgoing?'support@taskly.dz':(t.user_address||'Utilisateur')),make('small',null,date(entry.created_at)));
          wrap.append(label,make('p',null,entry.body||''));messages.append(wrap);
        }if(!messages.children.length)messages.append(make('p','tmv3-empty','Aucun message.'));right.append(messages);
        const form=make('form','tmv3-reply-form');const lbl=make('label',null,'Votre réponse');const body=make('textarea');body.placeholder='Rédigez votre réponse…';body.required=true;body.maxLength=10000;body.rows=4;lbl.append(body);
        const actions=make('div','tmv3-reply-actions');const submit=make('button','tmv3-primary','➤ Envoyer');submit.type='submit';actions.append(make('span',null,'Réponse au fil Support'),submit);form.append(lbl,actions);
        form.addEventListener('submit',async e=>{e.preventDefault();if(!form.reportValidity()||state.loading)return;state.loading=true;submit.disabled=true;try{await request('/support/threads/'+encodeURIComponent(id)+'/replies',{method:'POST',body:JSON.stringify({body:body.value})});await openAfterSubmit(id);message('Réponse enregistrée avec succès.');}catch(err){message(err?.message||'Envoi impossible.');}finally{state.loading=false;submit.disabled=false;}});
        right.append(form);
      }catch(e){right.replaceChildren(make('p','tmv3-status',e?.message||'Chargement impossible.'));}}
    async function openAfterSubmit(id){state.loading=false;await open(id);}
    async function load(){if(state.loading)return;state.loading=true;message('Actualisation…');try{const r=await request('/support/threads');state.threads=Array.isArray(r.threads)?r.threads:[];renderStats();renderList();message(state.threads.length+' conversation(s) Support disponibles.');const exists=state.threads.some(t=>String(t.id)===String(state.active));if(exists)await openAfterSubmit(state.active);else {state.active=null;emptyDetail();}}catch(e){message(e?.message||'Impossible de charger les conversations.');renderStats();emptyDetail();}finally{state.loading=false;}}
    search.addEventListener('input',renderList);renderStats();emptyDetail();if(typeof window.requeteAPI==='function')load();else message('Connexion API indisponible.');
    // Garde la vue classique pilot intacte : pas de modification du rendu des demandes existantes.
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
