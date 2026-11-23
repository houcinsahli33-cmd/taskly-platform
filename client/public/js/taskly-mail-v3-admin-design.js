/* Taskly Mail V3 — vues fidèles aux deux maquettes validées.
   Données réelles uniquement. Pas de modification de la sidebar, des comptes, du backend ni du pilot. */
(() => {
  'use strict';
  window.TasklyMailV3AdminUI = true;
  function mount() {
    const host = document.getElementById('taskly-mail-v3-support');
    const tabs = [document.getElementById('tmv3-tab-support'), document.getElementById('tmv3-tab-mailboxes'),document.getElementById('tmv3-tab-admin-mail')];
    const panels = [document.getElementById('tmv3-view-support'), document.getElementById('tmv3-view-mailboxes'),document.getElementById('tmv3-view-admin-mail')];
    if (!host || tabs.some(x=>!x) || panels.some(x=>!x)) return;
    const el=(tag, cls, value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=String(value);return n;};
    const btn=(label,cls,click)=>{const n=el('button',cls,label);n.type='button';if(click)n.addEventListener('click',click);return n;};
    const icon=(value,cls='tmv5-icon')=>el('span',cls,value);
    function switchTo(i){tabs.forEach((tab,j)=>{tab.setAttribute('aria-selected',String(i===j));tab.tabIndex=i===j?0:-1;panels[j].hidden=i!==j;});}
    tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>switchTo(i));tab.addEventListener('keydown',ev=>{if(!['ArrowRight','ArrowLeft'].includes(ev.key))return;ev.preventDefault();const k=(i+(ev.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;switchTo(k);tabs[k].focus();});});
    const state={threads:[],contacts:[],showAccounts:false,selected:null,search:'',sort:'recent',busy:false,displayed:null,loadError:null};
    const api=(path,opt={})=>window.requeteAPI('/api/admin/taskly-mail-service-v3'+path,opt);
    const date=(v)=>{if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});};
    const status=el('p','tmv5-status','Chargement des conversations…');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const metricRow=el('div','tmv5-metrics');
    const tools=el('div','tmv5-tools');
    const find=el('input','tmv5-find');find.type='search';find.placeholder='Rechercher une conversation (email, sujet, message…)';find.setAttribute('aria-label','Rechercher une conversation');
    const filters=el('div','tmv5-filters');
    const all=btn('Tous','tmv5-filter is-selected',()=>{state.showAccounts=false;accounts.classList.remove('is-selected');find.value='';paintList();});
    const support=btn('Support','tmv5-filter',()=>{state.showAccounts=false;accounts.classList.remove('is-selected');all.classList.remove('is-selected');support.classList.add('is-selected');paintList();});
    const adm=btn('Administration','tmv5-filter');adm.disabled=true;adm.title='Les fils Support et Administration sont distincts : aucun message privé client-artisan n’est consultable ici.';
    const unread=btn('Non lus','tmv5-filter');unread.disabled=true;unread.title='Le serveur ne fournit pas encore de statut de lecture.';
    all.addEventListener('click',()=>{support.classList.remove('is-selected');all.classList.add('is-selected');});
    const sort=el('select','tmv5-sort');[['recent','Plus récents'],['old','Plus anciens']].forEach(([key,label])=>{const o=el('option',null,label);o.value=key;sort.append(o);});sort.setAttribute('aria-label','Ordre des conversations');
    const accounts=btn('Comptes','tmv5-filter',async()=>{
      state.showAccounts=true;accounts.classList.add('is-selected');all.classList.remove('is-selected');support.classList.remove('is-selected');
      try{await loadDirectory();}catch(err){status.textContent=err?.message||'Comptes indisponibles.';}
    });
    filters.append(all,support,adm,unread); // Keep the validated filter bar; account directory lives in the existing list menu.
    const searchWrap=el('label','tmv5-find-wrap');searchWrap.append(icon('⌕'),find);
    tools.append(searchWrap,filters,sort);
    const initiate=btn('＋ Nouvelle conversation','tmv5-filter');
    initiate.setAttribute('aria-label','Choisir un compte client ou artisan pour une conversation');
    // No extra action in the validated toolbar; the existing list menu opens account selection.
    initiate.addEventListener('click',()=>showCompose());
    function showCompose(prefillAccount=null){
      const form=el('form','tmv5-compose');form.setAttribute('aria-label','Nouvelle conversation Support');
      const lookup=el('input','tmv5-compose-subject');lookup.type='search';lookup.placeholder='Rechercher un client ou artisan (nom, e-mail…)';lookup.setAttribute('aria-label','Rechercher un compte');
      const uid=el('select','tmv5-compose-subject');uid.required=true;uid.setAttribute('aria-label','Choisir le compte destinataire');
      const pages=el('div','tmv5-compose-toolbar');let currentPage=0;
      const more=btn('Afficher d’autres comptes','tmv5-secondary',()=>loadContacts(currentPage+1,true));
      const found=el('p','tmv5-status','Recherche des comptes…');pages.append(more);
      async function loadContacts(page=0,append=false){
        try{const data=await api('/support/contacts?q='+encodeURIComponent(lookup.value.trim())+'&page='+page);
          if(!append)uid.replaceChildren(el('option',null,'Sélectionnez un compte'));
          if(!append)uid.firstChild.value='';
          for(const account of data.contacts||[]){const option=el('option',null,
            [account.prenom,account.nom].filter(Boolean).join(' ')+' · '+account.role+' · '+account.email);
            option.value=String(account.id);uid.append(option);}
          currentPage=page;more.hidden=!data.hasMore;
          found.textContent=(data.contacts||[]).length+' compte(s) dans cette page.';
        }catch(error){found.textContent=error?.message||'Annuaire indisponible.';more.hidden=true;}
      }
      let searchSequence=0;lookup.addEventListener('input',()=>{const seq=++searchSequence;
        Promise.resolve().then(()=>{if(seq===searchSequence)loadContacts(0);});});
      loadContacts().then(()=>{if(prefillAccount){const existing=Array.from(uid.options).find(o=>o.value===String(prefillAccount.id));if(!existing){const option=el('option',null,prefillAccount.email);option.value=String(prefillAccount.id);uid.append(option);}uid.value=String(prefillAccount.id);}});
      const subject=el('input','tmv5-compose-subject');subject.required=true;subject.maxLength=200;subject.placeholder='Objet';
      const body=el('textarea','tmv5-compose-text');body.required=true;body.maxLength=10000;body.rows=4;body.placeholder='Message de l’administration';
      const send=el('button','tmv5-send','Envoyer');send.type='submit';
      form.append(lookup,uid,found,pages,subject,body,send);
      form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity())return;send.disabled=true;
        try{const result=await api('/support/threads',{method:'POST',body:JSON.stringify({userId:uid.value,subject:subject.value,body:body.value})});
          await refresh();await open(result.threadId);status.textContent='Conversation créée.';
        }catch(err){status.textContent=err?.message||'Envoi impossible.';}finally{send.disabled=false;}});
      detail.replaceChildren(form);lookup.focus();
    }
    const layout=el('div','tmv5-layout');
    const list=el('section','tmv5-list');list.setAttribute('aria-label','Conversations Support');
    const detail=el('section','tmv5-detail');detail.setAttribute('aria-label','Conversation sélectionnée');
    layout.append(list,detail);host.replaceChildren(metricRow,tools,status,layout);
    function metric(symbol,label,value,note,kind){const n=el('div','tmv5-metric'+(kind?' tmv5-'+kind:''));const pict=icon(symbol,'tmv5-metric-icon');const copy=el('div','tmv5-metric-copy');copy.append(el('span','tmv5-metric-title',label),el('strong','tmv5-metric-value',value));if(note)copy.append(el('small','tmv5-metric-note',note));n.append(pict,copy);return n;}
    function paintMetrics(){
      metricRow.replaceChildren(
        metric('☏','Conversations actives',state.threads.length,'Fils Support enregistrés','main'),
        metric('✉','Non lus','—','Statut non disponible',''),
        metric('♧','Clients','—','Profil non transmis',''),
        metric('⚒','Artisans','—','Profil non transmis',''),
        metric('✓','Résolus','—','Statut non disponible','')
      );
    }
    function ordered(){const q=find.value.trim().toLocaleLowerCase('fr-FR');return state.threads.filter(t=>!q||[t.user_address,t.subject,t.id].some(v=>String(v??'').toLocaleLowerCase('fr-FR').includes(q))).sort((a,b)=>{const da=Date.parse(a.updated_at||a.created_at)||0;const db=Date.parse(b.updated_at||b.created_at)||0;return sort.value==='old'?da-db:db-da;});}
    async function loadDirectory(){
      const q=find.value.trim();const result=await api('/support/contacts?q='+encodeURIComponent(q)+'&page=0');
      state.contacts=Array.isArray(result.contacts)?result.contacts:[];
      paintList();status.textContent=state.contacts.length+' comptes affichés (recherche possible).';
    }
    function paintList(){const threads=ordered();const header=el('div','tmv5-list-heading');header.append(el('strong',null,state.showAccounts?'Comptes clients et artisans ('+state.contacts.length+')':'Conversations ('+threads.length+')'));const more=btn('•••','tmv5-more',async()=>{state.showAccounts=!state.showAccounts;if(state.showAccounts){await loadDirectory();}else{paintList();status.textContent=state.threads.length+' conversation(s) Support disponibles.';}});more.setAttribute('aria-label','Afficher les comptes clients et artisans ou revenir aux conversations');more.title='Choisir un compte ou revenir aux conversations';header.append(more);const items=el('div','tmv5-items');
      if(state.showAccounts){
        for(const account of state.contacts){
          const label=[account.prenom,account.nom].filter(Boolean).join(' ')||account.email;
          const item=btn('','tmv5-item',()=>showCompose(account));
          item.append(icon(label[0]?.toUpperCase()||'U','tmv5-avatar'));
          const content=el('div','tmv5-item-body');content.append(el('strong','tmv5-email',label),el('p','tmv5-preview',account.email),el('span','tmv5-type',account.role+' · Contacter'));
          item.append(content);items.append(item);
        }
        if(!state.contacts.length)items.append(el('p','tmv5-empty','Aucun compte correspondant.'));
        list.replaceChildren(header,items);return;
      }
      for(const t of threads){const active=String(t.id)===String(state.selected);const item=btn('','tmv5-item'+(active?' is-active':''),()=>open(t.id));item.setAttribute('aria-label','Ouvrir la conversation '+String(t.subject||t.id));
        const av=icon(String(t.user_address||'T').charAt(0).toUpperCase(),'tmv5-avatar');const content=el('div','tmv5-item-body');const line=el('div','tmv5-item-line');line.append(el('strong','tmv5-email',t.user_address||'Utilisateur Taskly'),el('small','tmv5-when',date(t.updated_at||t.created_at)));content.append(line,el('strong','tmv5-subject',t.subject||'Sans objet'),el('p','tmv5-preview','Conversation Support • #'+t.id));const foot=el('div','tmv5-item-foot');foot.append(el('span','tmv5-type','Support'),el('span','tmv5-state','Conversation'));content.append(foot);item.append(av,content);items.append(item);
      }
      if(!threads.length)items.append(el('p','tmv5-empty','Aucune conversation correspondante.'));list.replaceChildren(header,items);
    }
    function emptyDetail(){detail.replaceChildren(el('div','tmv5-placeholder','Sélectionnez une conversation à gauche pour consulter les messages et répondre depuis support@taskly.dz.'));}
    let seq=0;
    async function open(id){state.selected=id;paintList();const current=++seq;detail.replaceChildren(el('p','tmv5-load','Chargement de la conversation…'));
      try{const data=await api('/support/threads/'+encodeURIComponent(id));if(current!==seq)return;const thread=data.thread||{};
        const head=el('header','tmv5-thread-header');const who=el('div','tmv5-person');who.append(icon(String(thread.user_address||'U').charAt(0).toUpperCase(),'tmv5-avatar'),el('div','tmv5-person-meta'));who.lastChild.append(el('strong',null,thread.user_address||'Compte Taskly'),el('span',null,thread.subject||'Sans objet'));head.append(who);
        const actions=el('div','tmv5-actions');const reply=btn('↩ Répondre','tmv5-reply-top',()=>detail.querySelector('textarea')?.focus());const archive=btn('▣ Archiver','tmv5-secondary');archive.disabled=true;archive.title='Fonction non disponible dans l’API Support V3.';const close=btn('✓ Clore','tmv5-secondary');close.disabled=true;close.title='Fonction non disponible dans l’API Support V3.';actions.append(reply,archive,close);head.append(actions);
        const note=el('p','tmv5-info','ⓘ Réponse envoyée depuis support@taskly.dz · Historique visible uniquement pour les comptes autorisés.');
        const messages=el('div','tmv5-messages');for(const e of (data.entries||[])){const sent=e.sender_kind==='admin';const entry=el('article','tmv5-message '+(sent?'is-admin':'is-user'));const avatar=icon(sent?'✿':String(thread.user_address||'U').charAt(0).toUpperCase(),'tmv5-avatar');const content=el('div','tmv5-message-content');const meta=el('div','tmv5-message-meta');meta.append(el('strong',null,sent?'support@taskly.dz':(thread.user_address||'Utilisateur')),el('span',null,date(e.created_at)));content.append(meta,el('p','tmv5-message-text',e.body||''));entry.append(avatar,content);messages.append(entry);}if(!messages.children.length)messages.append(el('p','tmv5-empty','Aucun message dans cette conversation.'));
        const form=el('form','tmv5-compose');const subjectLabel=el('label','tmv5-compose-label','Sujet');const subject=el('input','tmv5-compose-subject');subject.value='RE : '+String(thread.subject||'Conversation Support');subject.readOnly=true;subjectLabel.append(subject);const textLabel=el('label','tmv5-compose-label','Message');const body=el('textarea','tmv5-compose-text');body.required=true;body.maxLength=10000;body.placeholder='Rédigez votre réponse…';body.rows=3;textLabel.append(body);const toolbar=el('div','tmv5-compose-toolbar');toolbar.append(el('span','tmv5-compose-hint','Réponse interne · sans pièce jointe'));const send=el('button','tmv5-send','➤ Envoyer');send.type='submit';toolbar.append(send);form.append(subjectLabel,textLabel,toolbar);
        form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity()||state.busy)return;state.busy=true;send.disabled=true;try{await api('/support/threads/'+encodeURIComponent(id)+'/replies',{method:'POST',body:JSON.stringify({body:body.value})});status.textContent='Réponse enregistrée.';await open(id);}catch(err){status.textContent=err?.message||'Réponse non envoyée.';}finally{state.busy=false;send.disabled=false;}});
        detail.replaceChildren(head,note,messages,form);
      }catch(err){if(current!==seq)return;detail.replaceChildren(el('p','tmv5-load',err?.message||'Impossible de charger la conversation.'));}
    }
    async function refresh(){if(state.busy)return;state.busy=true;status.textContent='Actualisation…';try{const data=await api('/support/threads');state.threads=Array.isArray(data.threads)?data.threads:[];paintMetrics();paintList();status.textContent=state.threads.length+' conversation(s) Support disponibles.';if(state.threads.some(t=>String(t.id)===String(state.selected)))await open(state.selected);else{state.selected=null;emptyDetail();}}catch(err){state.loadError=true;status.textContent=err?.message||'Liste des conversations indisponible.';paintMetrics();emptyDetail();}finally{state.busy=false;}}
    find.addEventListener('input',()=>{if(state.showAccounts)loadDirectory().catch(err=>{status.textContent=err?.message||'Recherche indisponible.';});else paintList();});sort.addEventListener('change',paintList);paintMetrics();emptyDetail();
    if(typeof window.requeteAPI==='function')refresh();else status.textContent='Connexion API indisponible.';

    // Gestion des boîtes : enrichissement purement visuel des cartes réelles rendues par professional-mail-pilot.js.
    const mbHost=document.getElementById('mail-pilot-content'),mbSearch=document.getElementById('tmv3-mb-search'),mbFilter=document.getElementById('tmv3-mb-filter');
    if(mbHost&&mbSearch&&mbFilter){
      const toolbar=document.querySelector('.tmv3-mb-toolbar');
      const profileSelect=el('select','tmv5-profile-filter');profileSelect.setAttribute('aria-label','Filtrer par profil');[['all','Tous les profils'],['client','Clients'],['artisan','Artisans']].forEach(([v,l])=>{const o=el('option',null,l);o.value=v;profileSelect.append(o);});
      const profileLabel=el('label','tmv5-profile-label');profileLabel.append(el('span','tmv3-sr-only','Filtrer les profils'),profileSelect);
      if(toolbar)toolbar.append(profileLabel);
      let queued=false;
      function update(){queued=false;
        const cards=Array.from(mbHost.children).filter(n=>n.nodeType===1&&!n.matches('[hidden]'));
        const lower=s=>String(s||'').toLocaleLowerCase('fr-FR');
        let approved=0,pending=0;
        for(const card of cards){const raw=lower(card.textContent);const ok=/approuv[ée]e?|approved/i.test(raw);const wait=/en attente|pending|confirmation personnelle/i.test(raw)&&!ok;
          if(ok)approved++;else if(wait)pending++;
          const filtered=!!mbSearch.value.trim()&&!raw.includes(lower(mbSearch.value.trim()))||(mbFilter.value==='approved'&&!ok)||(mbFilter.value==='pending'&&!wait)||(profileSelect.value==='client'&&!raw.includes('compte client'))||(profileSelect.value==='artisan'&&!raw.includes('profil artisan'));
          card.hidden=filtered;
          if(!card.classList.contains('tmv5-mailbox-card')){
            card.classList.add('tmv5-mailbox-card');
            // Le contenu d'origine reste présent avec tous ses contrôles et gestionnaires d'événement.
            const box=el('div','tmv5-mailbox-tags');box.append(el('span','tmv5-mailbox-pill',ok?'✓ Approuvée':wait?'◷ En attente':'État à vérifier'));
            const access= /accès activé/i.test(raw)?'● Accès activé':/activation requise/i.test(raw)?'Activation requise':'État de la boîte à vérifier';box.append(el('span','tmv5-mailbox-pill tmv5-access-pill',access));card.append(box);
          }else{const badges=card.querySelector('.tmv5-mailbox-tags');if(badges){badges.children[0].textContent=ok?'✓ Approuvée':wait?'◷ En attente':'État à vérifier';}}
        }
        [['all',cards.length],['approved',approved],['pending',pending]].forEach(([key,value])=>{const strong=document.querySelector('.tmv3-mb-count[data-metric="'+key+'"] strong');if(strong)strong.textContent=String(value);});
      }
      function schedule(){if(queued)return;queued=true;queueMicrotask(update);}
      mbSearch.addEventListener('input',update);mbFilter.addEventListener('change',update);profileSelect.addEventListener('change',update);
      new MutationObserver(schedule).observe(mbHost,{childList:true,subtree:false});update();
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
