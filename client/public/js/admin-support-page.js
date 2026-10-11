'use strict';
// UI isolee de la rubrique Support. API requeteAPI fournit CSRF + cookies.
(() => {
 const $=id=>document.getElementById(id);
 const e=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
 const state={statut:'tous',recherche:'',tri:'recent',page:1,pagination:null,dialog:null,requestKey:null};
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
    rows.innerHTML=data.messages.length?data.messages.map((m,i)=>`<tr>
      <td><div class="support-subject"><span class="support-message-icon">▤</span><div><strong>${e(m.sujet)}</strong><small>${e(m.message?.slice(0,95))}${(m.message||'').length>95?'…':''}</small></div></div></td>
      <td><div class="support-sender"><span class="support-avatar ${['mint','blue','orange'][i%3]}">${e(initials(m.nom))}</span><div><strong>${e(m.nom)}</strong><small>${e(m.email)}</small></div></div></td>
      <td><strong>${e(date(m.created_at))}</strong><small>${e(heure(m.created_at))}</small></td>
      <td>${badge(m.statut)}</td><td><button class="support-examine" type="button" data-support-examine="${id(m.id)}">${m.statut==='traite'?'Consulter':'Examiner'}</button></td></tr>`).join(''):'<tr><td colspan="5" class="support-loading">Aucun message pour ces filtres.</td></tr>';
    toggleFilters();
   }catch(err){if(current===seq){rows.innerHTML=`<tr><td colspan="5" class="support-loading" role="alert">${e(err.message)}</td></tr>`;feedback(err.message,true);}}
 }
 function modalFeedback(text,err=false){const el=$('support-modal-feedback');if(el){el.textContent=text;el.classList.toggle('error',err);}}
 function close(){if(working)return;const root=$('support-dialog-root');root.hidden=true;root.innerHTML='';document.body.classList.remove('support-modal-open');state.dialog=null;state.requestKey=null;lastFocus?.focus?.();}
 function show(html){const root=$('support-dialog-root');root.hidden=false;root.innerHTML=html;document.body.classList.add('support-modal-open');root.querySelector('[data-support-close]')?.focus();}
 function history(d){
   const replies=d.reponses||[],events=d.historique||[];
   const items=[...replies.map(r=>({when:r.created_at,body:`${r.statut==='sent'?'E-mail envoyé':r.statut==='sending'?'Envoi en cours / à vérifier':'Échec ou envoi non confirmé'} · ${date(r.created_at)} ${heure(r.created_at)}\nPar : ${r.admin_prenom||''} ${r.admin_nom||''}\nObjet : ${r.sujet}\n${r.corps}`})),...events.map(h=>({when:h.created_at,body:`${date(h.created_at)} ${heure(h.created_at)} : ${statusNames[h.ancien_statut]||h.ancien_statut} → ${statusNames[h.nouveau_statut]||h.nouveau_statut} · ${h.admin_prenom||''} ${h.admin_nom||''}`}))].sort((a,b)=>new Date(b.when)-new Date(a.when));
   return `<section class="support-history"><h3>Historique administratif (${items.length})</h3>${items.length?items.map(x=>`<div class="support-history-item">${e(x.body)}</div>`).join(''):'<p>Aucune réponse ou décision enregistrée.</p>'}</section>`;
 }
 function renderDialog(d){
   const m=d.message;
   const linked=Boolean(m.compte_id)&&['client','artisan'].includes(m.compte_role);
   const statusAccount=m.compte_statut==='bloque'?'bloque':!m.compte_email_verifie?'non-active':'actif';
   const statusLabel=statusAccount==='bloque'?'Bloqué':statusAccount==='non-active'?'Non activé':'Actif';
   const roleLabel=linked?(m.compte_role==='artisan'?'Artisan':'Client'):'Visiteur anonyme';
   const fullname=linked?`${m.compte_prenom||''} ${m.compte_nom||''}`.trim():m.nom;
   const warning=m.liaison_compte==='correspondance_email'?'Compte retrouvé par adresse e-mail : l’identité de l’expéditeur public n’a pas été authentifiée.':m.liaison_compte==='identite_verifiee'?'Identité du compte confirmée par le parcours de support connecté.':'';
   const destination=linked?m.compte_email:'';
   show(`<div class="support-dialog" role="dialog" aria-modal="true" aria-labelledby="support-dialog-title" tabindex="-1">
     <header class="support-dialog-header"><div><p class="support-dialog-eyebrow">SUPPORT / TRAITEMENT DES DEMANDES</p><h2 id="support-dialog-title">Examiner un message</h2><p class="support-dialog-subtitle">Consultez la demande, identifiez l’expéditeur et choisissez la suite.</p></div><div class="support-dialog-top">${badge(m.statut)}<button class="support-close" data-support-close type="button" aria-label="Fermer">×</button></div></header>
     <div class="support-dialog-body"><p class="support-dialog-section-label">Informations du message</p>
      <div class="support-dialog-cards"><section class="support-dialog-card"><h3>EXPÉDITEUR</h3><p class="support-card-name">${e(fullname)}</p><p>${e(m.email)}</p><p>Profil : <strong>${e(roleLabel)}</strong></p>${linked?`<p>Compte : <span class="support-account-status ${statusAccount==='bloque'?'bloque':statusAccount==='non-active'?'non-active':''}">${e(statusLabel)}</span></p><p>Inscription : ${e(date(m.compte_inscription))}</p>`:'<p>Aucun compte correspondant.</p>'}${warning?`<span class="support-caution">${e(warning)}</span>`:''}</section>
      <section class="support-dialog-card"><h3>DÉTAILS DE LA DEMANDE</h3><p><strong>Référence #SUP-${String(id(m.id)).padStart(4,'0')}</strong></p><p>Canal : ${e(m.contexte==='artisan_activation'?'Support compte artisan':'Formulaire de contact')}</p><p>Reçu le : <strong>${e(date(m.created_at))} ${e(heure(m.created_at))}</strong></p><p>Statut : ${badge(m.statut)}</p><p>Traité le : ${e(date(m.date_traitement))}</p></section></div>
      <p class="support-dialog-section-label">Message reçu</p><section class="support-original"><div class="support-original-head"><strong>${e(m.sujet)}</strong><small>Message original</small></div><p class="support-original-text">${e(m.message)}</p></section>
      ${linked?`<form id="support-reply-form"><p class="support-dialog-section-label">Répondre par e-mail</p><label class="support-reply-label" for="support-reply-subject">Objet de la réponse <small>Destinataire : ${e(destination)}</small></label><input id="support-reply-subject" maxlength="160" required value="${e(('Re : '+m.sujet).slice(0,160))}"><label class="support-reply-label" for="support-reply-body">Votre réponse</label><textarea id="support-reply-body" maxlength="5000" minlength="5" required placeholder="Rédigez votre réponse professionnelle..."></textarea><p class="support-form-feedback" id="support-modal-feedback" role="status">Le statut du compte n'est pas modifié par l'envoi d'une réponse.</p></form>`:`<p class="support-caution">Visiteur sans compte Taskly : réponse e-mail indisponible. Vous pouvez uniquement consulter et marquer le message comme traité.</p><p class="support-form-feedback" id="support-modal-feedback" role="status"></p>`}
      ${history(d)}
     </div><footer class="support-dialog-footer"><small>Les actions sont enregistrées dans TiDB. Aucun compte n'est activé automatiquement.</small><div><button type="button" data-support-close>Fermer</button>${linked && m.statut!=='en_cours'?`<button type="button" data-support-set-status="en_cours">${m.statut==='traite'?'Rouvrir':'Mettre en cours'}</button>`:''}${m.statut!=='traite'?`<button type="button" data-support-set-status="traite">Marquer comme traité</button>`:''}${linked?`<button type="button" class="support-send" id="support-send-btn">✉ &nbsp; Envoyer la réponse</button>`:''}</div></footer>
   </div>`);
 }
 async function examine(contactId){if(!contactId)return;lastFocus=document.activeElement;show('<div class="support-dialog" role="status" style="padding:30px">Chargement du message… <button type="button" data-support-close>Fermer</button></div>');try{const d=await requeteAPI(`/api/admin/support/messages/${contactId}`);state.dialog=d;state.requestKey=null;renderDialog(d);}catch(err){show(`<div class="support-dialog" style="padding:30px"><p role="alert">${e(err.message)}</p><button type="button" data-support-close>Fermer</button></div>`);}}
 async function mark(statut){if(!state.dialog||working)return;working=true;try{await requeteAPI(`/api/admin/support/messages/${id(state.dialog.message.id)}`,{method:'PATCH',body:JSON.stringify({statut})});feedback('Statut du message enregistré.');await load();const item=await requeteAPI(`/api/admin/support/messages/${id(state.dialog.message.id)}`);state.dialog=item;renderDialog(item);}catch(err){modalFeedback(err.message,true);}finally{working=false;}}
 async function send(){if(!state.dialog||working)return;const f=$('support-reply-form');if(!f||!f.reportValidity())return;const sujet=$('support-reply-subject').value,corps=$('support-reply-body').value;const button=$('support-send-btn');working=true;button.disabled=true;modalFeedback('Envoi en cours…');
   state.requestKey=state.requestKey||crypto.randomUUID();
   try{await requeteAPI(`/api/admin/support/messages/${id(state.dialog.message.id)}/reponses`,{method:'POST',body:JSON.stringify({sujet,corps,cle:state.requestKey})});state.requestKey=null;feedback('Réponse envoyée et enregistrée.');await load();const item=await requeteAPI(`/api/admin/support/messages/${id(state.dialog.message.id)}`);state.dialog=item;renderDialog(item);modalFeedback('Réponse envoyée avec succès.');}
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
   document.querySelectorAll('[data-support-status],[data-support-card]').forEach(btn=>btn.addEventListener('click',()=>{state.statut=btn.dataset.supportStatus||btn.dataset.supportCard;state.page=1;toggleFilters();load();}));
   $('support-search').addEventListener('input',ev=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.recherche=ev.target.value.trim();state.page=1;load();},250);});
   $('support-sort').addEventListener('change',ev=>{state.tri=ev.target.value;state.page=1;load();});
   $('support-prev').addEventListener('click',()=>{if(state.pagination?.page>1){state.page--;load();}});
   $('support-next').addEventListener('click',()=>{if(state.pagination?.page<state.pagination?.totalPages){state.page++;load();}});
   $('support-export').addEventListener('click',exportCSV);
   $('support-rows').addEventListener('click',ev=>{const btn=ev.target.closest('[data-support-examine]');if(btn)examine(id(btn.dataset.supportExamine));});
   const root=$('support-dialog-root');root.addEventListener('click',ev=>{if(ev.target===root||ev.target.closest('[data-support-close]'))close();else if(ev.target.closest('[data-support-set-status]'))mark(ev.target.closest('[data-support-set-status]').dataset.supportSetStatus);else if(ev.target.closest('#support-send-btn'))send();});
   document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!root.hidden)close();});
   root.addEventListener('submit',ev=>{if(ev.target.id==='support-reply-form'){ev.preventDefault();send();}});
   await load();
 });
})();
