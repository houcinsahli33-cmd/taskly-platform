
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
    }catch(e){status('admin-profile-status',e.message,true);}
  }
  async function chargerListeAdmins(){
    try {
      const d=await requeteAPI('/api/admin-settings/admins');
      $('admin-admins-list').innerHTML=d.admins.map(a=>`<div class="admin-settings-list-entry"><div><strong>${safe(a.prenom)} ${safe(a.nom)}</strong><small>${safe(a.email)} · ${a.niveau==='principal'?'Principal':'Secondaire'} · ${a.statut_compte==='bloque'?'Désactivé':'Actif'}</small></div>${a.niveau!=='principal'?`<button class="admin-settings-secondary" type="button" data-admin-toggle="${a.statut_compte==='bloque'?'enable':'disable'}" data-admin-id="${Number(a.id)}">${a.statut_compte==='bloque'?'Réactiver':'Désactiver'}</button>`:''}</div>`).join('')||'<p class="admin-settings-empty">Aucun compte.</p>';
      $('admin-invites-list').innerHTML=d.invitations.map(i=>`<div class="admin-settings-list-entry"><div><strong>${safe(i.prenom)} ${safe(i.nom)}</strong><small>${safe(i.email)} · Expire le ${new Date(i.expires_at).toLocaleString('fr-FR')}</small></div><button class="admin-settings-secondary" type="button" data-invite-revoke="${Number(i.id)}">Annuler</button></div>`).join('')||'<p class="admin-settings-empty">Aucune invitation en attente.</p>';
      $('admin-audit-list').innerHTML=d.historique.map(a=>`<div class="admin-settings-list-entry"><div><strong>${safe(a.action.replaceAll('_',' '))}</strong><small>${safe(a.prenom)} ${safe(a.nom)} · ${safe(a.detail||'')} · ${new Date(a.created_at).toLocaleString('fr-FR')}</small></div></div>`).join('')||'<p class="admin-settings-empty">Aucune action récente.</p>';
    }catch(e){$('admin-admins-list').textContent=e.message;}
  }
  async function soumettre(form,id,url,method,payload,onSuccess){
    formBusy(form,true);status(id,'Traitement en cours…');
    try{const rep=await api(url,method,payload());status(id,rep.message);if(onSuccess)await onSuccess(rep);}
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
