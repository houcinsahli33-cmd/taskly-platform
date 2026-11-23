'use strict';
// Gestion des demandes, et accès à la boîte seulement si la passerelle est configurée.
document.addEventListener('DOMContentLoaded',async()=>{
 await attendreSession();
 const root=document.getElementById('mail-pilot-content'),status=document.getElementById('mail-pilot-status');
 if(!root||!status||!window.utilisateurCourant)return;
 const admin=window.utilisateurCourant.role==='admin',base=admin?'/api/admin/taskly-mail':'/api/taskly-mail';
 const labels={pending_confirmation:'Confirmation personnelle requise',pending_admin:'En attente de validation administrative',cancelled:'Annulée',rejected:'Refusée',approved_pending_provider:'Approuvée — état de la boîte à vérifier'};
 let busy=false,after=0;
 function text(tag,value){const e=document.createElement(tag);e.textContent=value;return e;}
 function button(label,fn,cls='primary'){const e=text('button',label);e.type='button';e.className='btn '+cls;e.addEventListener('click',fn);return e;}
 function message(value){status.textContent=value;}
 async function action(url,payload){if(busy)return;busy=true;const originallyEnabled=[...root.querySelectorAll('button')].filter(e=>!e.disabled);originallyEnabled.forEach(e=>e.disabled=true);try{const r=await requeteAPI(url,{method:'POST',body:JSON.stringify(payload)});if(r.activated&&!admin){const state=await requeteAPI(base+'/mailbox');if(state.state!=='active')throw Error('Activation à vérifier. Actualisez la page.');showSuccess(state);message('');}else{await load();message(r.message);}}catch(e){message(e.message);}finally{busy=false;originallyEnabled.forEach(e=>{if(e.isConnected)e.disabled=false;});}}
 function card(symbol,title,description){root.replaceChildren();const card=text('section','');card.className='tm-onboard';const icon=text('div','');icon.className='tm-onboard-icon';const paths=symbol==='✉'?'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 6 8 7 8-7"/>':title.startsWith('Bienvenue')?'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>':'<path d="M12 3 3 7v5c0 5 4 8 9 10 5-2 9-5 9-10V7z"/><path d="m8 12 3 3 5-6"/>';icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+paths+'</svg>'; card.append(icon,text('h2',title),text('p',description));root.append(card);return card;}
 function showSuccess(state){const c=card('✓','Bienvenue dans Taskly Mail !','Votre adresse professionnelle interne a été créée.');const list=text('div','');list.className='tm-checklist';for(const value of ['Identité confirmée','Profil Taskly vérifié','Adresse professionnelle réservée','Boîte de messagerie créée','Accès activé']){const line=text('p','✓  '+value);list.append(line);}c.append(list,button('Accéder à ma messagerie',async()=>{root.replaceChildren();await window.afficherTasklyMailbox(root,status);},'primary tm-wide'));}
 function otp(){const group=text('div','');group.className='tm-otp';group.setAttribute('role','group');group.setAttribute('aria-label','Code à six chiffres');const inputs=Array.from({length:6},(_,i)=>{const e=document.createElement('input');e.type='text';e.inputMode='numeric';e.maxLength=1;e.placeholder='–';e.autocomplete=i===0?'one-time-code':'off';e.setAttribute('aria-label','Chiffre '+(i+1));group.append(e);return e;});function fill(v,i){const digits=v.replace(/\D/g,'').slice(0,6-i);for(let j=0;j<digits.length;j++)inputs[i+j].value=digits[j];inputs[Math.min(5,i+digits.length)].focus();}inputs.forEach((e,i)=>{e.addEventListener('input',()=>{const v=e.value;e.value='';fill(v,i);});e.addEventListener('paste',ev=>{ev.preventDefault();const v=ev.clipboardData.getData('text').replace(/\D/g,'');fill(v,v.length===6?0:i);});e.addEventListener('keydown',ev=>{if(ev.key==='Backspace'&&!e.value&&i>0)inputs[i-1].focus();if(ev.key==='ArrowLeft'&&i>0)inputs[i-1].focus();if(ev.key==='ArrowRight'&&i<5)inputs[i+1].focus();});});return {group,value:()=>inputs.map(e=>e.value).join('')};}
 async function artisanPage(d,gatewayConfigured,autoInternal,internalMode){root.replaceChildren();if(!d||d.status==='cancelled'){const c=card('✉','Votre adresse professionnelle',internalMode?'Votre messagerie personnelle et sécurisée sur Taskly.':'Une adresse sera proposée selon votre identité et votre métier.');const list=text('div','');list.className='tm-checklist';for(const value of [autoInternal?'Création automatique après confirmation':'Création après validation','Accès personnel sécurisé','Une boîte privée par espace Taskly'])list.append(text('p','✓  '+value));c.append(list,button('Créer mon adresse professionnelle',()=>action(base+'/request',{}),'primary tm-wide'));if(internalMode)c.append(text('small','Adresse interne uniquement. Les e-mails Internet ne sont pas encore disponibles.'));return;}
  if(d.status==='approved_pending_provider'&&gatewayConfigured&&typeof window.afficherTasklyMailbox==='function'){if(autoInternal){const state=await requeteAPI(base+'/mailbox');if(state.state==='waiting_provider'){const c=card('✉','Terminer la création','Confirmez à nouveau votre identité pour créer votre boîte automatiquement.');c.append(button('Recevoir un nouveau code',()=>action(base+'/request',{}),'primary tm-wide'));return;}}await window.afficherTasklyMailbox(root,status);return;}
  if(d.status==='pending_admin'&&autoInternal){const c=card('✉','Terminer la création','Confirmez à nouveau votre identité. Aucune validation manuelle ne sera nécessaire.');c.append(button('Recevoir un nouveau code',()=>action(base+'/request',{}),'primary tm-wide'));return;}
  if(d.status==='pending_confirmation'){const c=card('✓','Confirmez votre demande','Un code de sécurité à 6 chiffres a été envoyé à votre adresse e-mail personnelle.');const address=text('p',d.proposed_address);address.className='tm-address';c.append(address);const code=otp(),form=text('form','');form.className='tm-confirm-form';const submit=button(autoInternal?'Confirmer et créer ma boîte':'Confirmer la demande',()=>{},'primary tm-wide');submit.type='submit';form.append(code.group,text('small','Code valable 10 minutes · 3 tentatives'),submit);const verify=decision=>{const v=code.value();if(!/^\d{6}$/.test(v)){message('Saisissez les six chiffres reçus.');return;}action(base+'/confirm',{code:v,decision});};form.addEventListener('submit',e=>{e.preventDefault();verify('confirm');});const resend=button('Renvoyer le code',()=>action(base+'/request',{}),'tm-text');const cancel=button('Annuler ma demande',()=>verify('cancel'),'tm-text tm-danger');c.append(form,resend,cancel);return;}
  const c=card('✉',labels[d.status]||'État de la demande',d.proposed_address);if(d.refusal_reason)c.append(text('p','Motif : '+d.refusal_reason));}
 function adminPage(data){
  root.replaceChildren();
  const icon=name=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','tmv9-action-icon');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');const paths={eye:['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12','M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],edit:['M12 20h9','M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4z'],trash:['M3 6h18','M8 6V4h8v2','M6 6l1 15h10l1-15','M10 10v7','M14 10v7'],restore:['M3 11a9 9 0 1 1 2 7','M3 4v7h7']};for(const d of paths[name]||paths.eye){const node=document.createElementNS('http://www.w3.org/2000/svg','path');node.setAttribute('d',d);svg.append(node);}return svg;};
  const fmtDate=value=>{if(!value)return '—';const x=new Date(value);return Number.isNaN(x.valueOf())?'—':x.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});};
  const lines=(title,items)=>{const wrap=document.createElement('div');wrap.className='tmv9-dialog-data';wrap.append(text('h3',title));for(const [key,value]of items){const line=document.createElement('p');line.append(text('strong',key+' : '),text('span',String(value??'—')));wrap.append(line);}return wrap;};
  function details(d){const overlay=document.createElement('div');overlay.className='tmv9-modal';const dialog=document.createElement('section');dialog.className='tmv9-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Détails de la boîte');const x=button('Fermer',()=>overlay.remove(),'outline');const head=document.createElement('header');head.append(text('h2','Détails de la boîte'),x);dialog.append(head,lines('Adresse et compte', [['Adresse professionnelle',d.proposed_address],['Type de compte',d.artisan_id==null?'Client':'Artisan'],['Identifiant utilisateur',d.user_id],['Profil artisan',d.artisan_id],['Statut de la demande',labels[d.status]||d.status],['Accès à la boîte',d.mailbox_state==='active'?'Actif':d.mailbox_state==='activation_required'?'Activation requise':d.mailbox_state==='waiting_provider'?'En attente':'Non renseigné'],['Date de demande',fmtDate(d.requested_at)],['Décision',fmtDate(d.decided_at)]]));overlay.append(dialog);overlay.addEventListener('click',ev=>{if(ev.target===overlay)overlay.remove();});const key=ev=>{if(ev.key==='Escape'){overlay.remove();document.removeEventListener('keydown',key);}};document.addEventListener('keydown',key);document.body.append(overlay);x.focus();}
  // Optional separate administrator action, never changes automatic activation.
  if(data.manualMailEnabled){
    const actionRow=document.createElement('div');actionRow.className='tmv9-manual-mail';
    const open=button('＋ Ajouter une boîte manuellement',()=>{
      const overlay=document.createElement('div');overlay.className='tmv9-modal';
      const dialog=document.createElement('section');dialog.className='tmv9-dialog';
      dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
      dialog.setAttribute('aria-label','Provisionnement manuel');
      const form=document.createElement('form');
      const heading=text('h2','Ajouter une boîte existante approuvée');
      const description=text('p','Réservé aux demandes approuvées et confirmées. L’activation reste personnelle. La création automatique est inchangée.');
      const selector=document.createElement('select');selector.required=true;selector.setAttribute('aria-label','Demande approuvée');
      const blank=document.createElement('option');blank.value='';blank.textContent='Sélectionnez une demande';selector.append(blank);
      for(const item of data.demandes.filter(d=>d.status==='approved_pending_provider'&&d.mailbox_state==='waiting_provider')){
        const option=document.createElement('option');option.value=String(item.user_id);option.textContent=item.proposed_address;selector.append(option);
      }
      const send=button('Créer la boîte',()=>{},'primary');send.type='submit';
      const cancel=button('Annuler',()=>overlay.remove(),'outline');
      const feedback=text('p','');feedback.setAttribute('role','status');
      form.append(heading,description,selector,feedback,send,cancel);
      form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity())return;
        if(!window.confirm('Créer manuellement cette boîte confirmée ?'))return;
        send.disabled=true;try{await requeteAPI(base+'/'+encodeURIComponent(selector.value)+'/manual-provision',{method:'POST',body:JSON.stringify({})});overlay.remove();await load();}
        catch(error){feedback.textContent=error.message||'Création refusée.';}finally{send.disabled=false;}});
      dialog.append(form);overlay.append(dialog);overlay.addEventListener('click',event=>{if(event.target===overlay)overlay.remove();});
      document.body.append(overlay);selector.focus();
    },'primary');actionRow.append(open);root.append(actionRow);
  }
  if(!data.demandes.length)root.append(text('p','Aucune boîte sur cette page.'));
  for(const d of data.demandes){
    const card=document.createElement('section');card.className='panel mt-22 tmv9-mailbox-row';
    const body=document.createElement('div');body.className='panel-body';card.append(body);
    const address=text('h2',d.proposed_address);address.className='tmv9-col-address';body.append(address);
    const profile=document.createElement('p');profile.className='tmv9-col-profile';profile.append(text('strong',d.artisan_id==null?'Client':'Artisan'),text('small','Compte : '+(d.artisan_id==null?d.user_id:d.artisan_id)));body.append(profile);
    const approved=d.status==='approved_pending_provider';const status=text('span',approved?'✓ Approuvée':d.status==='pending_admin'?'◷ En attente':labels[d.status]||d.status);status.className='tmv9-col-status '+(approved?'is-approved':'');body.append(status);
    const active=d.mailbox_state==='active';const access=text('span',active?'● Actif':d.mailbox_state==='activation_required'?'◷ À activer':d.mailbox_state==='waiting_provider'?'◷ En attente':'—');access.className='tmv9-col-access'+(active?' is-active':'');body.append(access);
    const date=text('time',fmtDate(d.requested_at));date.className='tmv9-col-date';if(d.requested_at)date.dateTime=String(d.requested_at);body.append(date);
    const actions=document.createElement('div');actions.className='tmv9-col-actions';
    const view=button('Voir',()=>details(d),'outline');view.className='tmv9-icon-button';view.replaceChildren(icon('eye'));view.title='Voir la boîte';view.setAttribute('aria-label','Voir '+d.proposed_address);actions.append(view);
    // Changement de statut autorisé seulement si l'API V10 l'annonce.
    // Les adresses sont réservées automatiquement: aucune édition d'identité côté admin.
    const edit=button('Modifier',()=>details(d),'outline');edit.className='tmv9-icon-button';edit.replaceChildren(icon('edit'));edit.title='Consulter les paramètres immuables de la boîte';actions.append(edit);
    const suspended=d.mailbox_state==='suspended';
    const label=suspended?'Réactiver':'Désactiver';
    const change=button(label,async()=>{
      if(!window.confirm((suspended?'Réactiver':'Désactiver')+' la boîte '+d.proposed_address+' ? Les messages seront conservés.'))return;
      try{await requeteAPI(base+'/'+d.user_id+'/access',{method:'POST',body:JSON.stringify({action:suspended?'restore':'suspend'})});await load();}
      catch(err){message(err.message||'Opération refusée.');}
    },'outline');change.className='tmv9-icon-button'+(suspended?'':' is-danger');change.replaceChildren(icon(suspended?'restore':'trash'));
    change.disabled=!data.adminActionsV10||!approved||!['active','suspended'].includes(d.mailbox_state);
    change.title=change.disabled?'Action indisponible pour cette boîte':label+' (réversible)';change.setAttribute('aria-label',label+' '+d.proposed_address);actions.append(change);
    body.append(actions);
    if(d.status==='approved_pending_provider'&&d.mailbox_state==='waiting_provider'&&data.gatewayConfigured&&!data.autoInternal){const go=button('Provisionner',()=>action(base+'/'+d.user_id+'/provision',{}),'primary');actions.append(go);}
    if(d.status==='pending_admin'&&!data.autoInternal){const motif=document.createElement('textarea');motif.className='form-control tmv9-review-reason';motif.maxLength=500;motif.placeholder='Motif du refus';motif.setAttribute('aria-label','Motif du refus');body.append(motif);const decisions=document.createElement('div');decisions.className='tmv9-review-actions';decisions.append(button('Approuver',()=>action(base+'/'+d.user_id+'/decision',{decision:'approve'})),button('Refuser',()=>action(base+'/'+d.user_id+'/decision',{decision:'reject',motif:motif.value}),'danger'));body.append(decisions);}
    root.append(card);
  }
  if(after!==0)root.append(button('Première page',()=>{after=0;load();},'outline'));
  if(data.next)root.append(button('Page suivante',()=>{after=data.next;load();},'outline'));
 }
 async function load(){try{const data=await requeteAPI(base+(admin?'?after='+after:''));message('');if(admin){adminPage(data);if(data.mailboxStateUnavailable)message('Demandes chargées. État des boîtes temporairement indisponible : aucune action sur les accès.');}else await artisanPage(data.demande,data.gatewayConfigured,data.autoInternal,data.internalMode);}catch(e){message(e.message);}}
 await load();
});
