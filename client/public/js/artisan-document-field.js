document.addEventListener('DOMContentLoaded',()=>{
 const input=document.getElementById('artisan-document'),name=document.getElementById('artisan-document-name');
 if(!input||!name)return;
 const update=()=>{const file=input.files[0];name.textContent=file?file.name:'Aucun fichier sélectionné';name.title=file?file.name:'';};
 input.addEventListener('change',update);
 input.form.addEventListener('reset',()=>setTimeout(update,0));
});
