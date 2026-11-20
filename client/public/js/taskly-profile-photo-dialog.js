'use strict';
// Interface uniquement : conserve le formulaire, ses identifiants et ses actions API.
(() => {
 const paths={camera:'M4 6h4l2-3h4l2 3h4v15H4z|M16 13a4 4 0 1 0-8 0 4 4 0 0 0 8 0',user:'M20 21v-2a8 8 0 0 0-16 0v2|M16 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0',upload:'M7 18H6a4 4 0 0 1-1-8 7 7 0 0 1 13-2 5 5 0 0 1 0 10h-1|M12 21V11m-4 4 4-4 4 4',photo:'M3 4h18v16H3z|M9 9a2 2 0 1 0-4 0 2 2 0 0 0 4 0|m3 18 5-5 4 4 4-5 5 5',folder:'M3 5h7l2 3h9v12H3Z',edit:'M4 20l5-1 11-11-4-4L5 15z|m13 7 4 4',reset:'M3 12a9 9 0 1 1 2.6 6.4M3 4v8h8',save:'M4 3h13l4 4v14H3V3z|M7 3v6h10V3M7 21v-8h10v8',trash:'M3 6h18|M9 6V3h6v3|M5 6l1 15h12l1-15|M10 10v7M14 10v7'};
 function el(tag,cls,text){const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;}
 function icon(name){const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');s.setAttribute('focusable','false');for(const d of paths[name].split('|')){const p=document.createElementNS(ns,'path');p.setAttribute('d',d);s.append(p);}return s;}
 function heading(name,text){const h=el('h3','tp-photo-heading');h.append(icon(name),document.createTextNode(text));return h;}
 document.addEventListener('DOMContentLoaded',()=>{
  const body=document.body,role=body.dataset.requireRole;if(body.dataset.workspacePage!=='profil'||!['client','artisan'].includes(role))return;
  function enhance(){
   const form=document.getElementById(role+'-photo-form'),dialog=form?.closest('dialog.workspace-dialog');
   if(!dialog||dialog.classList.contains('tp-photo-dialog'))return;
   const input=document.getElementById(role+'-photo-input'),remove=document.getElementById(role+'-photo-delete'),save=form.querySelector('button[type=submit]'),oldLabel=input?.closest('label'),oldActions=save?.parentElement;
   const header=dialog.querySelector('.workspace-dialog-header'),title=header?.querySelector('h2'),close=header?.querySelector('.workspace-close');
   if(!input||input.type!=='file'||!remove||!save||!oldLabel||!oldActions||!title||!close||!form.contains(input)||!form.contains(remove)||oldActions!==remove.parentElement)return;
   dialog.classList.add('tp-photo-dialog');
   const mark=el('span','tp-photo-mark');mark.append(icon('camera'));const titles=el('div','tp-photo-titles');titles.append(title,el('p','tp-photo-subtitle','Ajoutez, modifiez ou supprimez votre photo de profil.'));header.insertBefore(mark,close);header.insertBefore(titles,close);
   const row=el('div','tp-photo-panels'),current=el('section','tp-photo-current'),upload=el('section','tp-photo-upload'),avatarBox=el('div','tp-photo-avatar-box'),photo=el('img','tp-photo-avatar');photo.alt='Photo de profil actuelle';
   const edit=el('button','tp-photo-edit');edit.type='button';edit.setAttribute('aria-label','Choisir une nouvelle photo');edit.append(icon('edit'));edit.addEventListener('click',()=>input.click());avatarBox.append(photo,edit);current.append(heading('user','Photo actuelle'),avatarBox);
   const zone=el('div','tp-photo-drop'),symbol=el('span','tp-photo-picture');symbol.append(icon('photo'));
   const choose=el('label','tp-photo-choose');choose.htmlFor=input.id;choose.append(icon('folder'),document.createTextNode('Choisir un fichier'),input);
   // Le champ natif est conservé, avec son accept original et son fonctionnement clavier.
   const filename=el('p','tp-photo-filename','Aucun fichier choisi');filename.setAttribute('role','status');filename.setAttribute('aria-live','polite');
   zone.append(symbol,el('p','tp-photo-prompt','Glissez-déposez votre image ici'),el('span','tp-photo-or','ou'),choose,filename);
   upload.append(heading('upload','Choisir une nouvelle photo'),zone,el('p','tp-photo-hint','Formats autorisés : JPG, JPEG, PNG'));
   row.append(current,upload);oldLabel.before(row);oldLabel.remove();
   const reset=el('button','tp-photo-reset');reset.type='reset';reset.append(icon('reset'),document.createTextNode('Réinitialiser'));
   const footer=el('div','tp-photo-actions');oldActions.before(footer);save.classList.add('tp-photo-save');remove.classList.add('tp-photo-delete');save.prepend(icon('save'));remove.prepend(icon('trash'));footer.append(reset,save,remove);if(!oldActions.childElementCount)oldActions.remove();
   function syncPhoto(){const original=document.getElementById(role+'-photo-preview');const src=original?.getAttribute('src')||'/images/defaults/avatar.png';if(photo.getAttribute('src')!==src)photo.src=src;}
   function syncFile(){filename.textContent=input.files?.[0]?.name||'Aucun fichier choisi';filename.classList.remove('tp-photo-error');}
   input.addEventListener('change',syncFile);
   form.addEventListener('reset',()=>setTimeout(()=>{syncFile();syncPhoto();},0));
   zone.addEventListener('dragover',e=>{e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';zone.classList.add('tp-photo-drag');});
   zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('tp-photo-drag');});
   zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('tp-photo-drag');const files=e.dataTransfer?.files;const f=files?.[0];if(files?.length!==1||!f||!(f.type==='image/jpeg'||f.type==='image/png'||(!f.type&&/\.(jpe?g|png)$/i.test(f.name)))){filename.textContent='Choisissez une seule image JPG ou PNG.';filename.classList.add('tp-photo-error');return;}try{const transfer=new DataTransfer();transfer.items.add(f);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));}catch{filename.textContent='Utilisez le bouton Choisir un fichier.';filename.classList.add('tp-photo-error');}});
   new MutationObserver(()=>{if(dialog.open){syncPhoto();syncFile();}}).observe(dialog,{attributes:true,attributeFilter:['open']});
   new MutationObserver(records=>{if(records.some(r=>r.target.id===role+'-photo-preview'||r.type==='childList'))syncPhoto();}).observe(body,{attributes:true,attributeFilter:['src'],childList:true,subtree:true});
   syncPhoto();syncFile();
  }
  new MutationObserver(enhance).observe(body,{childList:true,subtree:true});enhance();
 });
})();