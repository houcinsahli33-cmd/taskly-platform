'use strict';
// Decoration uniquement : conserve les boutons et leurs gestionnaires existants.
(() => {
 const icons={user:'M20 21v-2a8 8 0 0 0-16 0v2|M16 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0',edit:'M4 20l5-1 11-11-4-4L5 15z|m13 7 4 4',photo:'M3 4h18v16H3z|M9 9a2 2 0 1 0-4 0 2 2 0 0 0 4 0|m3 18 5-5 4 4 4-5 5 5',mail:'M3 5h18v14H3z|m3 6 9 7 9-7',key:'M2 18v3h3v-3h3v-3h3l3.5-3.5a6 6 0 1 0-3-3L2 18z',trash:'M3 6h18|M9 6V3h6v3|M5 6l1 15h12l1-15|M10 10v7M14 10v7',chevron:'m9 5 7 7-7 7',arrow:'M4 12h15m-6-6 6 6-6 6',shield:'m12 3 8 4v5c0 5-4 8-8 9-4-1-8-4-8-9V7z|m8 12 3 3 5-6',document:'M5 3h10l4 4v14H5z|M14 3v5h5|M8 12h8M8 16h8',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8|M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2'};
 function icon(name){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');for(const d of icons[name].split('|')){const p=document.createElementNS(ns,'path');p.setAttribute('d',d);svg.append(p);}return svg;}
 function element(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;}
 const config={
  'Modifier mes informations':['edit','mint', 'Nom, coordonnées et activité professionnelle'],
  'Modifier ma photo':['photo','blue','Choisir une photo ou retirer la photo actuelle'],
  'Changer mon adresse e-mail':['mail','orange','Mettre à jour votre adresse e-mail sécurisée'],
  'Changer mon mot de passe':['key','purple','Modifier votre mot de passe en toute sécurité'],
  'Supprimer mon compte':['trash','danger','Supprimez définitivement le profil et les données liées à cet espace.'],
  'Mes justificatifs':['document','mint','Consulter ou compléter vos documents professionnels'],
  'Confidentialité et sécurité':['shield','blue','Gérer la visibilité de vos coordonnées']
 };
 document.addEventListener('DOMContentLoaded',()=>{
  const body=document.body;
  if(body.dataset.workspacePage!=='profil'||!['client','artisan'].includes(body.dataset.requireRole))return;
  const root=document.getElementById('account-profile-editor');if(!root)return;
  function enhance(){const actions=root.querySelector('.workspace-actions');if(!actions||actions.dataset.premium==='1')return;
   actions.dataset.premium='1';root.classList.add('tp-management');
   const oldHeading=root.previousElementSibling;if(oldHeading?.classList.contains('client-account-actions-heading'))oldHeading.hidden=true;
   const header=element('header','tp-management-header'),mark=element('span','tp-management-mark');mark.append(icon('user'));const titles=element('div','tp-management-title');titles.append(element('h2','','Gérer mon compte'),element('p','','Consultez et modifiez les informations de votre compte'));header.append(mark,titles);root.insertBefore(header,actions);
   actions.querySelectorAll(':scope > button.workspace-action').forEach(button=>{
    const strong=button.querySelector('strong'),small=button.querySelector('span');if(!strong||!small)return;
    const c=config[strong.textContent.trim()];if(!c)return;
    button.dataset.tpTone=c[1];small.textContent=c[2];
    const badge=element('span','tp-action-icon');badge.append(icon(c[0]));
    const copy=element('span','tp-action-copy');copy.append(strong,small);small.classList.add('tp-action-description');
    const arrow=element('span','tp-action-end');if(c[1]==='danger'){arrow.append(icon('trash'),element('span','','Demander la suppression'),icon('arrow'));}else arrow.append(icon('chevron'));
    button.replaceChildren(badge,copy,arrow);
   });
   // Preserve the real existing confirmation handler; only change card order visually/structurally.
   const danger=actions.querySelector('[data-tp-tone="danger"]');if(danger)actions.append(danger);
  }
  const observer=new MutationObserver(enhance);observer.observe(root,{childList:true,subtree:true});enhance();
 });
})();