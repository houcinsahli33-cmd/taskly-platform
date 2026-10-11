/* Comportements visuels des pages admin; les mutations utilisent admin-settings.js + API securisee. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const current = document.body?.dataset.workspacePage;
  const keys = ['email', 'facebook', 'instagram', 'twitter', 'linkedin'];
  const socials = {facebook:'Facebook', instagram:'Instagram', twitter:'X', linkedin:'LinkedIn'};
  const socialLink = value => {
    try {
      const url=new URL(String(value||''));
      return url.protocol==='https:' && !url.username && !url.password && url.hostname && !/\s/.test(value) ? url.href : null;
    } catch {return null;}
  };
  function showPreview(){
    const form=$('site-settings-form');if(!form)return;
    const email=String(form.elements.namedItem('email')?.value||'').trim();
    const contact=$('t-preview-email');
    if(contact){
      contact.textContent=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)?email:'Adresse e-mail à renseigner';
      contact.removeAttribute('href');
      if(email===contact.textContent)contact.href='mailto:'+email;
    }
    const target=$('t-preview-social');if(!target)return;
    target.replaceChildren();let count=0;
    Object.entries(socials).forEach(([name,label])=>{
      const url=socialLink(form.elements.namedItem(name)?.value);
      if(!url)return;
      const link=document.createElement('a');link.href=url;link.textContent=label;link.target='_blank';link.rel='noopener noreferrer';target.append(link);count++;
    });
    if(!count){const placeholder=document.createElement('span');placeholder.className='t-admin-placeholder-social';placeholder.textContent='Liens à renseigner';target.append(placeholder);}
  }
  async function loadPublicSettings(resetForm=false){
    const {parametres}=await requeteAPI('/api/site-settings');
    const form=$('site-settings-form');
    if(resetForm && form){
      keys.forEach(key=>{const field=form.elements.namedItem(key);if(field)field.value=parametres?.[key]||'';});
    }
    showPreview();
  }
  function sitePage(){
    const form=$('site-settings-form');if(!form)return;
    $('t-admin-year').textContent=String(new Date().getFullYear());
    form.addEventListener('input',showPreview);
    form.addEventListener('change',showPreview);
    $('site-settings-reload')?.addEventListener('click',async event=>{
      const button=event.currentTarget;button.disabled=true;
      try {await loadPublicSettings(true);$('site-settings-status').textContent='Dernières coordonnées enregistrées rechargées.';}
      catch(error){$('site-settings-status').textContent=error.message;}
      finally{button.disabled=false;}
    });
    // site-settings.js est volontairement conserve : seul lui peut enregistrer, avec l'API admin.
    loadPublicSettings(false).catch(()=>{showPreview();});
    // Les champs sont hydrates par le script local site-settings.js, puis apercu par l'evenement input.
    const observer=new MutationObserver(()=>showPreview());
    const fs=form.querySelector('fieldset');
    if(fs)observer.observe(fs,{attributes:true,attributeFilter:['disabled']});
  }
  function text(id,value){const target=$(id);if(target)target.textContent=String(value===null||value===undefined||value===''?'—':value);}
  function accountDetails(compte){
    const name=[compte.prenom,compte.nom].filter(Boolean).join(' ').trim();
    const initials=[compte.prenom?.[0],compte.nom?.[0]].filter(Boolean).join('').toUpperCase();
    text('t-admin-name',name);text('t-admin-display-name',name);
    text('t-admin-avatar',initials);text('t-admin-display-email',compte.email);
    text('t-admin-display-role',compte.niveau==='principal'?'Administrateur principal':'Administrateur secondaire');
    const badge=$('t-admin-account-status');if(badge){const blocked=compte.statut_compte==='bloque';badge.textContent=blocked?'●  Compte desactive':'●  Compte actif';badge.classList.toggle('is-blocked',blocked);}
  }
  function accountPage(){
    const dialog=$('t-admin-account-dialog');if(!dialog)return;
    const names={profile:'Modifier mes informations',password:'Changer mon mot de passe',email:'Changer mon adresse e-mail'};
    document.querySelectorAll('[data-account-open]').forEach(button=>button.addEventListener('click',()=>{
      const pane=button.dataset.accountOpen;
      if(!Object.hasOwn(names,pane))return;
      document.querySelectorAll('[data-account-panel]').forEach(el=>{el.hidden=el.dataset.accountPanel!==pane;});
      text('t-admin-dialog-title',names[pane]);
      if(!dialog.open)dialog.showModal();
      dialog.querySelector(`[data-account-panel="${pane}"] input`)?.focus();
    }));
    dialog.querySelector('[data-account-close]')?.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
    dialog.addEventListener('close',()=>{
      ['admin-password-old','admin-password-new','admin-password-repeat','admin-email-password','admin-email-code'].forEach(id=>{if($(id))$(id).value='';});
    });
    document.addEventListener('taskly:admin-account-loaded',event=>accountDetails(event.detail.compte));
    document.addEventListener('taskly:admin-saved',async event=>{
      if(event.detail.url==='/api/admin-settings/me'){
        try{const {compte}=await requeteAPI('/api/admin-settings/me');accountDetails(compte);}
        catch{/* message d'erreur gere par admin-settings.js */}
        dialog.close();
      }
    });
  }
  function applyAdminSearch(){
    const needle=String($('t-admin-search')?.value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    document.querySelectorAll('#admin-admins-list .admin-settings-list-entry').forEach(row=>{
      const text=row.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      row.hidden=!text.includes(needle);
    });
  }
  function adminsPage(){
    $('t-admin-search')?.addEventListener('input',applyAdminSearch);
    document.addEventListener('taskly:admin-list-loaded',event=>{
      const {admins=[],invitations=[],historique=[]}=event.detail;
      text('t-admin-count-total',admins.length);
      text('t-admin-count-active',admins.filter(a=>a.statut_compte==='actif').length);
      text('t-admin-count-invites',invitations.length);
      text('t-admin-count-history',historique.length);
      text('t-admin-list-caption',`${admins.length} compte${admins.length===1?'':'s'}`);
      text('t-admin-invite-caption',`${invitations.length} en attente`);
      applyAdminSearch();
    });
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    await attendreSession();
    if(window.utilisateurCourant?.role!=='admin')return;
    if(current==='site')sitePage();
    if(current==='account')accountPage();
    if(current==='admins')adminsPage();
  });
})();
