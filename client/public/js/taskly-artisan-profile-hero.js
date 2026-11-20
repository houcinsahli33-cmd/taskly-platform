'use strict';
// Presentation uniquement : les actions et les donnees restent celles de Taskly.
(() => {
  const paths={user:['M16 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0','M4 21v-2a8 8 0 0 1 16 0v2'],camera:['M3 7h4l2-3h6l2 3h4v13H3z','M16 13a4 4 0 1 0-8 0 4 4 0 0 0 8 0'],shield:['m12 3 8 4v5c0 5-4 8-8 9-4-1-8-4-8-9V7z','m8 12 3 3 5-6'],edit:['M4 20l5-1L20 8l-4-4L5 15z','m13 7 4 4']};
  function icon(name){const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');s.setAttribute('focusable','false');for(const d of paths[name]){const p=document.createElementNS(ns,'path');p.setAttribute('d',d);s.append(p);}return s;}
  function tag(name,cls){const el=document.createElement(name);el.className=cls;return el;}
  function action(label){return Array.from(document.querySelectorAll('#account-profile-editor .workspace-action')).find(button=>button.querySelector('strong')?.textContent.trim()===label);}
  function openAction(label){const button=action(label);if(button&&!button.disabled)button.click();}
  function button(cls,label,iconName,actionLabel){const b=tag('button',cls);b.type='button';if(iconName)b.append(icon(iconName));if(label)b.append(document.createTextNode(label));b.addEventListener('click',()=>openAction(actionLabel));return b;}
  document.addEventListener('DOMContentLoaded',()=>{
    if(document.body.dataset.requireRole!=='artisan'||document.body.dataset.workspacePage!=='profil')return;
    const root=document.getElementById('artisan-profile-card');if(!root)return;
    const heading=document.querySelector('.artisan-upper h1');
    if(heading&&!heading.querySelector('.tp-profile-heading-icon')){const mark=tag('span','tp-profile-heading-icon');mark.append(icon('user'));heading.prepend(mark);}
    function enhance(){
      const hero=root.querySelector(':scope > .profile-panel'),fields=root.querySelector(':scope > .profile-fields');
      if(!hero||!fields||hero.dataset.tpHero==='1')return;
      const avatar=hero.querySelector('#artisan-photo-preview'),details=hero.querySelector(':scope > div');
      if(!avatar||!details||fields.children.length!==8)return;
      hero.dataset.tpHero='1';hero.classList.remove('profile-panel');hero.classList.add('artisan-profile-hero');
      const person=tag('div','artisan-profile-person'),wrap=tag('div','tp-profile-avatar-wrap');
      const camera=button('tp-profile-camera','','camera','Modifier ma photo');camera.setAttribute('aria-label','Modifier ma photo');camera.title='Modifier ma photo';wrap.append(avatar,camera);
      const over=tag('p','artisan-profile-overline');over.textContent='MON ESPACE PROFESSIONNEL';details.prepend(over);
      details.querySelector('p.muted')?.classList.add('artisan-profile-email');
      const badges=details.querySelectorAll('.meta-row .badge');badges.forEach((b,i)=>{b.classList.add('artisan-profile-label');if(i===1)b.classList.add('secondary');});
      person.append(wrap,details);
      const aside=tag('aside','artisan-profile-right'),shield=tag('span','artisan-profile-shield');shield.append(icon('shield'));
      const title=tag('strong','');title.textContent='Vos informations, à portée de main.';
      const desc=tag('p','');desc.textContent='Mettez votre profil professionnel à jour.';
      const edit=button('btn outline','Modifier mon profil →',null,'Modifier mes informations');edit.id='artisan-open-edit-profile';aside.append(shield,title,desc,edit);hero.append(person,aside);
      const block=tag('section','tp-profile-personal'),header=tag('div','tp-artisan-section-heading'),h2=tag('h2',''),mark=tag('span','tp-personal-icon');mark.append(icon('user'));h2.append(mark,document.createTextNode('Informations personnelles et professionnelles'));
      header.append(h2,button('tp-personal-edit','Modifier','edit','Modifier mes informations'));fields.before(block);fields.classList.add('artisan-profile-fields');block.append(header,fields);
    }
    new MutationObserver(enhance).observe(root,{childList:true});enhance();
  });
})();