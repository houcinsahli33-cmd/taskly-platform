/* Les formulaires gardent leurs champs et écouteurs, dans une petite fenêtre native. */
(() => {
 let counter=0;
 function action(node,title,label,description){
  const button=document.createElement('button');button.type='button';button.className='workspace-action';
  const strong=document.createElement('strong');strong.textContent=label;
  const small=document.createElement('span');small.textContent=description;
  button.append(strong,small);
  const dialog=document.createElement('dialog');dialog.className='workspace-dialog';
  const id='workspace-dialog-title-'+(++counter);dialog.setAttribute('aria-labelledby',id);
  const header=document.createElement('header');header.className='workspace-dialog-header';
  const heading=document.createElement('h2');heading.id=id;heading.textContent=title;
  const close=document.createElement('button');close.type='button';close.className='workspace-close';close.textContent='×';close.setAttribute('aria-label','Fermer');
  header.append(heading,close);const content=document.createElement('div');content.className='workspace-dialog-body';
  content.append(node);dialog.append(header,content);document.body.append(dialog);
  button.addEventListener('click',()=>{dialog.showModal();close.focus();});
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{
   node.querySelectorAll('input[type=password],input[data-taskly-password-managed]').forEach(input=>{input.value='';input.type='password';const oeil=input.parentElement?.querySelector('.taskly-password-eye-button');if(oeil){oeil.setAttribute('aria-pressed','false');oeil.setAttribute('aria-label','Afficher le mot de passe');}});button.focus();
  });
  return button;
 }
 window.installerActionsCompte=function(target){
  if(!target || target.dataset.actionsInstalled)return;
  target.dataset.actionsInstalled='true';const actions=document.createElement('div');actions.className='workspace-actions';
  const edit=target.querySelector('#account-edit-form');
  if(edit){target.querySelector('h3')?.remove();actions.append(action(edit,'Mes informations','Modifier mes informations','Nom, coordonnées et activité professionnelle'));}
  const photo=document.querySelector('form[id$="-photo-form"]');
  if(photo)actions.append(action(photo,'Photo de profil','Modifier ma photo','Choisir une photo ou retirer la photo actuelle'));
  const documents=document.getElementById('artisan-verification-panel');
  if(documents)actions.append(action(documents,'Mes justificatifs','Mes justificatifs','Consulter ou compléter mes documents professionnels'));
  target.querySelectorAll('.account-details').forEach(detail=>{
   const title=detail.querySelector('summary').textContent;detail.open=true;
   const label=detail.classList.contains('account-danger')?'Supprimer mon compte':title;
   actions.append(action(detail,title,label,detail.classList.contains('account-danger')?'Mot de passe puis confirmation obligatoire':'Ouvrir le formulaire sécurisé'));
  });
  target.append(actions);
 };
 document.addEventListener('DOMContentLoaded',()=>{
  const grid=document.querySelector('[data-workspace-page="account"] .admin-settings-grid');
  if(grid){const actions=document.createElement('div');actions.className='workspace-actions';
   grid.querySelectorAll('.admin-settings-panel').forEach(panel=>{const title=panel.querySelector('h3')?.textContent||'Modifier mon compte';actions.append(action(panel,title,title,'Ouvrir le formulaire sécurisé'));});grid.append(actions);}
  const pending=document.querySelector('.pending-page .account-danger');
  if(pending){const host=document.createElement('div');host.className='pending-account-action';pending.before(host);pending.open=true;host.append(action(pending,'Supprimer mon compte artisan','Supprimer mon compte','Mot de passe puis confirmation obligatoire'));}
 });
})();
