'use strict';
// Presentation uniquement : les actions et les donnees restent celles de Taskly.
(() => {
  const paths={user:['M16 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0','M4 21v-2a8 8 0 0 1 16 0v2'],camera:['M3 7h4l2-3h6l2 3h4v13H3z','M16 13a4 4 0 1 0-8 0 4 4 0 0 0 8 0'],edit:['M4 20l5-1L20 8l-4-4L5 15z','m13 7 4 4']};
  function icon(name){const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');s.setAttribute('focusable','false');for(const d of paths[name]){const p=document.createElementNS(ns,'path');p.setAttribute('d',d);s.append(p);}return s;}
  function tag(name,cls){const el=document.createElement(name);el.className=cls;return el;}
  function openAction(tone){const action=document.querySelector('#account-profile-editor .workspace-action[data-tp-tone="'+tone+'"]');if(action&&!action.disabled)action.click();}
  document.addEventListener('DOMContentLoaded',()=>{
    if(document.body.dataset.requireRole!=='client'||document.body.dataset.workspacePage!=='profil')return;
    const root=document.getElementById('client-profile-card');if(!root)return;
    const heading=document.querySelector('.client-heading h1');
    if(heading&&!heading.querySelector('.tp-profile-heading-icon')){const mark=tag('span','tp-profile-heading-icon');mark.append(icon('user'));heading.prepend(mark);}
    function enhance(){
      const hero=root.querySelector('.client-profile-hero'), info=root.querySelector('.client-profile-fields');
      if(!hero||!info||hero.dataset.tpHero==='1')return;
      hero.dataset.tpHero='1';
      const avatar=hero.querySelector('#client-photo-preview');
      if(avatar){const wrap=tag('div','tp-profile-avatar-wrap');avatar.before(wrap);wrap.append(avatar);const camera=tag('button','tp-profile-camera');camera.type='button';camera.setAttribute('aria-label','Modifier ma photo');camera.title='Modifier ma photo';camera.append(icon('camera'));camera.addEventListener('click',()=>openAction('blue'));wrap.append(camera);}
      const sectionHeading=root.querySelector('.client-section-heading');
      if(sectionHeading){const block=tag('section','tp-profile-personal');sectionHeading.before(block);block.append(sectionHeading,info);const title=sectionHeading.querySelector('h2');if(title){const mark=tag('span','tp-personal-icon');mark.append(icon('user'));title.prepend(mark);}const sub=sectionHeading.querySelector(':scope > span');if(sub)sub.remove();const edit=tag('button','tp-personal-edit');edit.type='button';edit.append(icon('edit'),document.createTextNode('Modifier'));edit.addEventListener('click',()=>root.querySelector('#client-open-edit-profile')?.click());sectionHeading.append(edit);}
    }
    new MutationObserver(enhance).observe(root,{childList:true});enhance();
  });
})();