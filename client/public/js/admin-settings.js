
/* Gestion securisee de l'administration Taskly. */
(() => {
  const $ = id => document.getElementById(id);
  const safe = value => echapperHTML(value ?? '');
  const api = (url,method,body) => requeteAPI(url,{method,body:JSON.stringify(body)});
  const status = (id,message,error=false)=>{const el=$(id);if(el){el.textContent=message;el.classList.toggle('error',error);}};
  function formBusy(form,busy){const b=form.querySelector('button[type=submit]');if(b)b.disabled=busy;}
  function redirigerVersConnexion(message){
    alert(message);
    const path=window.location.pathname.split('/dashboard')[0];
    window.location.replace(path);
  }
  async function chargerCompteAdmin(){
    try{
      const {compte:a}=await requeteAPI('/api/admin-settings/me');
      if($('admin-profile-nom'))$('admin-profile-nom').value=a.nom||'';if($('admin-profile-prenom'))$('admin-profile-prenom').value=a.prenom||'';
      if($('admin-profile-email'))$('admin-profile-email').value=a.email||'';
      if($('admin-account-role'))$('admin-account-role').textContent=a.niveau==='principal'?'Administrateur principal':'Administrateur secondaire';
      const principal=a.niveau==='principal';
      $('tab-admins').hidden=!principal;
      if(principal&&$('admin-admins-list'))await chargerListeAdmins();
      if($('tab-site'))$('tab-site').hidden=!principal;
      document.dispatchEvent(new CustomEvent('taskly:admin-account-loaded',{detail:{compte:a}}));
    }catch(e){status('admin-profile-status',e.message,true);}
  }
  // Toutes les valeurs proviennent de l'API privee ; echapperHTML neutralise les textes externes.
  const initiales = a => [String(a.prenom||'')[0],String(a.nom||'')[0]].filter(Boolean).join('').toLocaleUpperCase('fr-FR')||'AD';
  const safeDate = value => {const date=new Date(value);return Number.isNaN(date.getTime())?'Date inconnue':new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);};
  const empty = (title,subtitle) => `<div class="t-admin-list-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg><strong>${safe(title)}</strong><span>${safe(subtitle)}</span></div>`;
  function renderAdministrateur(a){
    const principal=a.niveau==='principal';
    const blocked=a.statut_compte==='bloque';
    const name=[a.prenom,a.nom].filter(Boolean).join(' ').trim()||'Administrateur';
    const role=principal?'Principal':'Secondaire';
    const state=blocked?'Désactivé':'Actif';
    const toggle=blocked?'enable':'disable';
    const action=principal?'<details class="t-admin-admin-options"><summary title="Informations sur le compte principal" aria-label="Informations sur le compte principal"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="1.9" aria-hidden="true"><circle cx="9" cy="4" r="1"/><circle cx="9" cy="10" r="1"/><circle cx="9" cy="16" r="1"/></svg></summary><span>Compte principal protégé : aucune désactivation possible.</span></details>':`<button class="admin-settings-secondary" type="button" data-admin-toggle="${toggle}" data-admin-id="${Number(a.id)}">${blocked?'Réactiver':'Désactiver'}</button>`;
    return `<div class="admin-settings-list-entry"><div class="t-admin-admin-identity"><span class="t-admin-admin-avatar" aria-hidden="true">${safe(initiales(a))}</span><div class="t-admin-admin-text"><strong>${safe(name)}</strong><small>${safe(a.email)}</small></div></div><div class="t-admin-admin-tags"><span class="t-admin-role-tag">${role}</span><span class="t-admin-status-tag ${blocked?'is-blocked':''}">${state}</span>${action}</div></div>`;
  }
  async function chargerListeAdmins(){
    try {
      const d=await requeteAPI('/api/admin-settings/admins');
      const admins=Array.isArray(d.admins)?d.admins:[];
      const invitations=Array.isArray(d.invitations)?d.invitations:[];
      const historique=Array.isArray(d.historique)?d.historique:[];
      $('admin-admins-list').innerHTML=admins.map(renderAdministrateur).join('')||empty('Aucun compte administrateur','Les comptes autorises apparaitront ici.');
      $('admin-invites-list').innerHTML=invitations.map(i=>`<div class="admin-settings-list-entry"><div class="t-admin-admin-identity"><span class="t-admin-admin-avatar" aria-hidden="true">${safe(initiales(i))}</span><div class="t-admin-admin-text"><strong>${safe([i.prenom,i.nom].filter(Boolean).join(' '))}</strong><small>${safe(i.email)} · Expire le ${safe(safeDate(i.expires_at))}</small></div></div><button class="admin-settings-secondary" type="button" data-invite-revoke="${Number(i.id)}">Annuler</button></div>`).join('')||empty('Aucune invitation en attente','Les prochaines invitations envoyees apparaitront ici avec leur statut.');
      $('admin-audit-list').innerHTML=historique.length?`<div class="t-admin-timeline">${historique.map(a=>`<div class="t-admin-timeline-entry"><div><strong>${safe(String(a.action||'Action').replaceAll('_',' '))}</strong><span class="t-admin-audit-label">Securite</span></div><small>${safe([a.prenom,a.nom].filter(Boolean).join(' '))}${a.detail?' · '+safe(a.detail):''} · ${safe(safeDate(a.created_at))}</small></div>`).join('')}</div>`:empty('Aucune action recente','Les actions des administrateurs apparaitront dans ce journal.');
      document.dispatchEvent(new CustomEvent('taskly:admin-list-loaded',{detail:{...d,admins,invitations,historique}}));
    }catch(e){$('admin-admins-list').textContent=e.message;status('admin-invite-status','Impossible de charger les comptes administrateurs.',true);}
  }

  async function soumettre(form,id,url,method,payload,onSuccess){
    formBusy(form,true);status(id,'Traitement en cours…');
    try{const rep=await api(url,method,payload());status(id,rep.message);if(onSuccess)await onSuccess(rep);document.dispatchEvent(new CustomEvent('taskly:admin-saved',{detail:{url,rep}}));}
    catch(e){status(id,e.message,true);}
    finally{formBusy(form,false);}
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    await attendreSession();
    if(!window.utilisateurCourant||window.utilisateurCourant.role!=='admin')return;
    await chargerCompteAdmin();
    $('admin-profile-form')?.addEventListener('submit',e=>{
      e.preventDefault();soumettre(e.currentTarget,'admin-profile-status','/api/admin-settings/me','PUT',()=>({nom:$('admin-profile-nom').value,prenom:$('admin-profile-prenom').value}));
    });
    $('admin-password-form')?.addEventListener('submit',e=>{
      e.preventDefault();const f=e.currentTarget;
      if($('admin-password-new').value!==$('admin-password-repeat').value)return status('admin-password-status','Les nouveaux mots de passe ne correspondent pas.',true);
      soumettre(f,'admin-password-status','/api/admin-settings/password','PUT',()=>({ancienMotDePasse:$('admin-password-old').value,nouveauMotDePasse:$('admin-password-new').value}),r=>{f.reset();if(r.deconnexion)redirigerVersConnexion(r.message);});
    });
    $('admin-email-request-form')?.addEventListener('submit',e=>{
      e.preventDefault();const f=e.currentTarget;
      soumettre(f,'admin-email-status','/api/admin-settings/email/request','POST',()=>({nouvelEmail:$('admin-email-new').value,motDePasse:$('admin-email-password').value}),()=>{$('admin-email-password').value='';$('admin-email-verify-form').hidden=false;});
    });
    $('admin-email-verify-form')?.addEventListener('submit',e=>{
      e.preventDefault();const f=e.currentTarget;
      soumettre(f,'admin-email-status','/api/admin-settings/email/verify','POST',()=>({code:$('admin-email-code').value.trim()}),r=>{f.reset();if(r.deconnexion)redirigerVersConnexion(r.message);});
    });
    $('admin-invite-form')?.addEventListener('submit',e=>{
      e.preventDefault();const f=e.currentTarget;
      soumettre(f,'admin-invite-status','/api/admin-settings/admins/invite','POST',()=>({nom:$('admin-invite-nom').value,prenom:$('admin-invite-prenom').value,email:$('admin-invite-email').value,motDePasse:$('admin-invite-password').value}),async()=>{f.reset();await chargerListeAdmins();});
    });
    $('admin-admins-list')?.addEventListener('click',async e=>{
      const b=e.target.closest('[data-admin-toggle]');if(!b)return;
      if(!confirm(`Confirmer : ${b.textContent.toLowerCase()} cet administrateur secondaire ?`))return;
      b.disabled=true;
      try{const r=await api(`/api/admin-settings/admins/${b.dataset.adminId}/${b.dataset.adminToggle}`,'PUT',{});alert(r.message);await chargerListeAdmins();}
      catch(err){alert(err.message);b.disabled=false;}
    });
    $('admin-invites-list')?.addEventListener('click',async e=>{
      const b=e.target.closest('[data-invite-revoke]');if(!b)return;
      if(!confirm('Annuler cette invitation ?'))return;
      b.disabled=true;
      try{const r=await requeteAPI(`/api/admin-settings/admins/invitations/${b.dataset.inviteRevoke}`,{method:'DELETE'});alert(r.message);await chargerListeAdmins();}
      catch(err){alert(err.message);b.disabled=false;}
    });
  });
})();
