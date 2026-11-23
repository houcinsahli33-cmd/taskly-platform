'use strict';
// UI isolee de la rubrique Support. API requeteAPI fournit CSRF + cookies.
(() => {
 const $=id=>document.getElementById(id);
 const e=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
 const state={statut:'tous',recherche:'',tri:'recent',page:1,pagination:null,dialog:null,requestKey:null,activeId:null};
 let lastFocus=null,seq=0,searchTimer=null,working=false;
 const statusNames={nouveau:'Nouveau',en_cours:'En cours',traite:'Traité'};
 const date=v=>{if(!v)return '—';const d=new Date(v);return isNaN(d.getTime())?'—':d.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});};
 const heure=v=>{if(!v)return '';const d=new Date(v);return isNaN(d.getTime())?'':d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});};
 const badge=v=>`<span class="support-badge ${e(v)}">${e(statusNames[v]||v||'Inconnu')}</span>`;
 const id=v=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):0;
 function feedback(m,isError=false){const node=$('support-notice');node.textContent=m||'';node.style.color=isError?'#b13c36':'';}
 function initials(n){return String(n||'?').split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('');}
 function params(page=state.page){return new URLSearchParams({statut:state.statut,recherche:state.recherche,tri:state.tri,page:String(page)});}
 function toggleFilters(){
   document.querySelectorAll('[data-support-status]').forEach(b=>{b.classList.toggle('active',b.dataset.supportStatus===state.statut);b.setAttribute('aria-pressed',String(b.dataset.supportStatus===state.statut));});
   document.querySelectorAll('[data-support-card]').forEach(b=>b.classList.toggle('active',b.dataset.supportCard===state.statut));
 }
 async function load(){
   const current=++seq;const rows=$('support-rows');rows.innerHTML='<tr><td colspan="5" class="support-loading">Chargement des messages…</td></tr>';
   try{
    const data=await requeteAPI('/api/admin/support/messages?'+params());
    if(current!==seq)return;
    state.pagination=data.pagination;
    for(const k of ['tous','nouveau','en_cours','traite']) {const target=$(k==='en_cours'?'support-en-cours':`support-${k==='tous'?'total':k}`);if(target)target.textContent=String(data.compteurs[k]??0);}
    $('support-count-chip').textContent=`${data.pagination.total} message${data.pagination.total!==1?'s':''}`;
    $('support-pagination-label').textContent=data.pagination.total?`Affichage de ${(data.pagination.page-1)*data.pagination.taille+1} à ${Math.min(data.pagination.page*data.pagination.taille,data.pagination.total)} sur ${data.pagination.total} messages`:'Aucun message';
    $('support-page-number').textContent=`Page ${data.pagination.page} sur ${data.pagination.totalPages}`;
    $('support-prev').disabled=data.pagination.page<=1;
    $('support-next').disabled=data.pagination.page>=data.pagination.totalPages;
    state.page=data.pagination.page;
    rows.innerHTML=data.messages.length?data.messages.map((m,i)=>`<tr data-support-examine="${id(m.id)}" class="${state.activeId===id(m.id)?'support-selected':''}" tabindex="0" role="button" aria-label="Examiner ${e(m.sujet)}">
      <td><div class="support-ticket-row"><span class="support-ticket-avatar ${['mint','blue','orange'][i%3]}">${e(initials(m.nom))}</span><div class="support-ticket-content"><div class="support-ticket-head"><strong>${e(m.nom)}</strong><time>${e(date(m.created_at))}, ${e(heure(m.created_at))}</time></div><div class="support-ticket-sub"><small>${e(m.message?.slice(0,75)||m.sujet)}${(m.message||'').length>75?'…':''}</small>${badge(m.statut)}</div></div></div></td>
      <td><div class="support-sender"><span class="support-avatar ${['mint','blue','orange'][i%3]}">${e(initials(m.nom))}</span><div><strong>${e(m.nom)}</strong><small>${e(m.email)}</small></div></div></td>
      <td><strong>${e(date(m.created_at))}</strong><small>${e(heure(m.created_at))}</small></td>
      <td>${badge(m.statut)}</td><td><button class="support-examine" type="button" data-support-examine="${id(m.id)}">${m.statut==='traite'?'Consulter':'Examiner'}</button></td></tr>`).join(''):'<tr><td colspan="5" class="support-loading">Aucun message pour ces filtres.</td></tr>';
    toggleFilters();
    if(data.messages.length && (!state.activeId || !data.messages.some(m=>id(m.id)===state.activeId))) examine(id(data.messages[0].id));
    else if(!data.messages.length){state.activeId=null;emptyPane('Aucune demande avec ces filtres.');}
   }catch(err){if(current===seq){rows.innerHTML=`<tr><td colspan="5" class="support-loading" role="alert">${e(err.message)}</td></tr>`;feedback(err.message,true);}}
 }
 function modalFeedback(text,err=false){const el=$('support-modal-feedback');if(el){el.textContent=text;el.classList.toggle('error',err);}}
 function emptyPane(message='Sélectionnez une demande dans la liste à gauche.'){
   document.getElementById('support-actions-bar')?.remove();const root=$('support-dialog-root');root.innerHTML=`<div class="support-inline-empty"><strong>Demande de support</strong><p>${e(message)}</p></div>`;
 }
 function close(){
   if(working)return;state.dialog=null;state.requestKey=null;state.activeId=null;
   emptyPane();document.querySelectorAll('.support-selected').forEach(row=>row.classList.remove('support-selected'));
   lastFocus?.focus?.();
 }
 function show(html){
   const root=$('support-dialog-root');root.innerHTML=html;
   const dialog=root.querySelector('.support-dialog');
   const oldActions=document.getElementById('support-actions-bar');
   if(oldActions)oldActions.remove();
   if(dialog){
     dialog.setAttribute('role','region');dialog.removeAttribute('aria-modal');
     const body=dialog.querySelector('.support-dialog-body');
     const cards=body?.querySelector('.support-dialog-cards');
     if(cards){
       const side=document.createElement('aside');side.className='support-detail-side';
       side.innerHTML='<h3>Détails de la demande</h3>';
       while(cards.firstChild)side.append(cards.firstChild);
       cards.remove();dialog.insertBefore(side,dialog.querySelector('.support-dialog-footer'));
     }
     const historyEl=dialog.querySelector('.support-history');
     const footerEl=dialog.querySelector('.support-dialog-footer');
     if(historyEl&&footerEl){
       const actions=document.createElement('section');
       actions.id='support-actions-bar';
       actions.className='support-actions-bar';
       actions.append(historyEl,footerEl);
       document.getElementById('support-workspace').append(actions);
     }
   }
 }
 function history(d){
   const replies=d.reponses||[],events=d.historique||[];
   const items=[...replies.map(r=>({when:r.created_at,body:`Réponse enregistrée · ${date(r.created_at)} ${heure(r.created_at)}\n${r.corps||''}`})),...events.map(h=>({when:h.created_at,body:`${date(h.created_at)} ${heure(h.created_at)} : ${statusNames[h.ancien_statut]||h.ancien_statut} → ${statusNames[h.nouveau_statut]||h.nouveau_statut}`}))].sort((a,b)=>new Date(b.when)-new Date(a.when));
   return `<section class="support-history"><div><h3>◈ &nbsp; Historique administratif (${items.length})</h3>${items.length?items.map(x=>`<div class="support-history-item">${e(x.body)}</div>`).join(''):'<p>Aucune note ou action enregistrée.</p>'}</div></section>`;
 }
 function renderDialog(d){
   const m=d.message;
   const linked=Boolean(m.compte_id)&&Number(m.user_id)===Number(m.compte_id)&&['client','artisan'].includes(m.compte_role);
   const statusAccount=m.compte_statut==='bloque'?'bloque':!m.compte_email_verifie?'non-active':'actif';
   const statusLabel=statusAccount==='bloque'?'Bloqué':statusAccount==='non-active'?'Non activé':'Actif';
   const fullname=linked?`${m.compte_prenom||''} ${m.compte_nom||''}`.trim():m.nom;
   const roleLabel=linked?(m.compte_role==='artisan'?'Artisan':'Client'):'Visiteur';
   const warning=m.liaison_compte==='correspondance_email'?'Correspondance par e-mail uniquement : identité non authentifiée.':'';
   const replies=(d.reponses||[]).filter(r=>r.corps);
   const number=String(id(m.id)).padStart(5,'0');
   const userBubble=`<article class="support-chat-message user"><span class="support-chat-avatar">${e(initials(fullname))}</span><div><div class="support-chat-meta"><strong>${e(fullname)}</strong><time>${e(date(m.created_at))}, ${e(heure(m.created_at))}</time></div><p>${e(m.message)}</p></div></article>`;
   const replyBubbles=replies.map(r=>`<article class="support-chat-message admin"><span class="support-chat-avatar">♧</span><div><div class="support-chat-meta"><strong>Équipe Support Taskly <span class="support-verified">✓</span></strong><time>${e(date(r.created_at))}, ${e(heure(r.created_at))}</time></div><p>${e(r.corps)}</p></div></article>`).join('');
   const canReply=linked;
   show(`<div class="support-dialog" role="region" aria-labelledby="support-dialog-title" tabindex="-1">
     <header class="support-dialog-header"><div class="support-dialog-title"><span class="support-title-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></svg></span><div><h2 id="support-dialog-title">Demande de support</h2><p>Consultez la conversation et répondez à l’utilisateur.</p></div></div><div class="support-dialog-top"><span class="support-reference">#SUP-${number}</span>${badge(m.statut)}<button class="support-close" data-support-close type="button" aria-label="Fermer">×</button></div></header>
     <section class="support-dialog-body"><div class="support-chat-stream">${userBubble}${replyBubbles}</div>
     ${canReply?`<form id="support-reply-form" class="support-compose"><label class="support-compose-label" for="support-reply-body">☏ &nbsp; Répondre à l’utilisateur (via le support Taskly)</label><input id="support-reply-subject" type="hidden" value="${e(('Re : '+m.sujet).slice(0,160))}"><textarea id="support-reply-body" maxlength="5000" minlength="5" required placeholder="Rédigez votre message..."></textarea><div class="support-compose-bottom"><button type="button" class="support-attach" disabled title="Pièces jointes non disponibles dans cette version">♧ &nbsp; Joindre un fichier</button><span>La réponse sera visible dans l’espace Support de l’utilisateur.</span><button type="submit" class="support-send" id="support-send-btn">➤ &nbsp; Envoyer dans le support</button></div><p class="support-form-feedback" id="support-modal-feedback" role="status"></p></form>`:`<div class="support-compose"><p class="support-caution">Visiteur sans compte Taskly authentifié : réponse interne indisponible.</p><p class="support-form-feedback" id="support-modal-feedback" role="status"></p></div>`}
     </section>
     <aside class="support-detail-side"><h3>ⓘ &nbsp; Détails de la demande</h3><dl><dt>Expéditeur</dt><dd><strong>${e(fullname)}</strong><small>${e(m.email)}</small></dd><dt>Espace concerné</dt><dd><span class="support-role-chip">${e(roleLabel)}</span></dd><dt>Inscription</dt><dd>${e(date(m.compte_inscription))}</dd><dt>Demande créée</dt><dd>${e(date(m.created_at))} ${e(heure(m.created_at))}</dd><dt>Statut</dt><dd>${badge(m.statut)}</dd></dl><div class="support-note-zone"><h3>✎ &nbsp; Note interne (administration)</h3><textarea disabled placeholder="Notes internes à activer côté serveur — non visibles par l’utilisateur"></textarea><small>${warning?e(warning):'Non disponible : aucune note n’est enregistrée depuis ce champ.'}</small></div></aside>
     ${history(d)}
     <footer class="support-dialog-footer"><div><button type="button" data-support-close>Fermer</button>${m.statut!=='en_cours'?`<button type="button" data-support-set-status="en_cours">${m.statut==='traite'?'Rouvrir':'Mettre en cours'}</button>`:''}${m.statut!=='traite'?`<button type="button" class="support-mark-treated" data-support-set-status="traite">✓ &nbsp; Marquer comme traité</button>`:''}</div></footer>
   </div>`);
 }
 async function examine(contactId){if(!contactId)return;lastFocus=document.activeElement;state.activeId=contactId;document.querySelectorAll('[data-support-examine]').forEach(row=>row.classList.toggle('support-selected',row.tagName==='TR'&&id(row.dataset.supportExamine)===contactId));show('<div class="support-dialog" role="status" style="padding:30px">Chargement du message… <button type="button" data-support-close>Fermer</button></div>');try{const d=await requeteAPI(`/api/admin/support/messages/${contactId}`);state.dialog=d;state.requestKey=null;renderDialog(d);}catch(err){show(`<div class="support-dialog" style="padding:30px"><p role="alert">${e(err.message)}</p><button type="button" data-support-close>Fermer</button></div>`);}}
 async function mark(statut){if(!state.dialog||working)return;working=true;try{await requeteAPI(`/api/admin/support/messages/${id(state.dialog.message.id)}`,{method:'PATCH',body:JSON.stringify({statut})});feedback('Statut du message enregistré.');await load();const item=await requeteAPI(`/api/admin/support/messages/${id(state.dialog.message.id)}`);state.dialog=item;renderDialog(item);}catch(err){modalFeedback(err.message,true);}finally{working=false;}}
 async function send(){if(!state.dialog||working)return;const f=$('support-reply-form');if(!f||!f.reportValidity())return;const sujet=$('support-reply-subject').value,corps=$('support-reply-body').value;const button=$('support-send-btn');working=true;button.disabled=true;modalFeedback('Envoi en cours…');
   state.requestKey=state.requestKey||crypto.randomUUID();
   try{await requeteAPI(`/api/admin/support/messages/${id(state.dialog.message.id)}/reponses-internes`,{method:'POST',body:JSON.stringify({sujet,corps,cle:state.requestKey})});state.requestKey=null;feedback('Réponse envoyée et enregistrée.');await load();const item=await requeteAPI(`/api/admin/support/messages/${id(state.dialog.message.id)}`);state.dialog=item;renderDialog(item);modalFeedback('Réponse enregistrée dans le support Taskly.');}
   catch(err){modalFeedback(err.message,true);button.disabled=false;}
   finally{working=false;}
 }
 async function exportCSV(){
   const button=$('support-export');button.disabled=true;
   try {let page=1,pages=1,all=[];do{const data=await requeteAPI('/api/admin/support/messages?'+params(page));all.push(...data.messages);pages=data.pagination.totalPages;page++;if(pages>100)throw new Error('Export trop volumineux : utilisez des filtres plus précis.');}while(page<=pages);
     const csvValue=v=>{let s=String(v??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
     const lines=[['ID','Sujet','Nom','Email','Message','Statut','Recu le','Traite le'],...all.map(m=>[m.id,m.sujet,m.nom,m.email,m.message,statusNames[m.statut]||m.statut,m.created_at,m.date_traitement])];
     const blob=new Blob(['\uFEFF'+lines.map(cols=>cols.map(csvValue).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8;'}),link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download='taskly-support.csv';document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);
     feedback(`${all.length} messages exportés (filtres appliqués).`);
   }catch(err){feedback(err.message,true);}finally{button.disabled=false;}
 }
 document.addEventListener('DOMContentLoaded',async()=>{
   await attendreSession();if(window.utilisateurCourant?.role!=='admin')return;
   document.querySelectorAll('[data-support-status],[data-support-card]').forEach(btn=>btn.addEventListener('click',()=>{state.statut=btn.dataset.supportStatus||btn.dataset.supportCard;state.page=1;state.activeId=null;toggleFilters();load();}));
   $('support-search').addEventListener('input',ev=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.recherche=ev.target.value.trim();state.page=1;load();},250);});
   $('support-sort').addEventListener('change',ev=>{state.tri=ev.target.value;state.page=1;load();});
   $('support-prev').addEventListener('click',()=>{if(state.pagination?.page>1){state.page--;load();}});
   $('support-next').addEventListener('click',()=>{if(state.pagination?.page<state.pagination?.totalPages){state.page++;load();}});
   $('support-export').addEventListener('click',exportCSV);
   $('support-rows').addEventListener('click',ev=>{const btn=ev.target.closest('[data-support-examine]');if(btn)examine(id(btn.dataset.supportExamine));});
   $('support-rows').addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('tr[data-support-examine]')){ev.preventDefault();examine(id(ev.target.dataset.supportExamine));}});
   const root=$('support-workspace');root.addEventListener('click',ev=>{if(ev.target.closest('[data-support-close]'))close();else if(ev.target.closest('[data-support-set-status]'))mark(ev.target.closest('[data-support-set-status]').dataset.supportSetStatus);});
   document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&state.dialog)close();});
   root.addEventListener('submit',ev=>{if(ev.target.id==='support-reply-form'){ev.preventDefault();send();}});
   await load();
 });
})();
