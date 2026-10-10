document.addEventListener('DOMContentLoaded',()=>{
 const input=document.getElementById('artisan-document');
 const name=document.getElementById('artisan-document-name');
 const status=document.getElementById('artisan-document-status');
 if(!input||!name)return;
 const update=()=>{const file=input.files[0];name.textContent=file?file.name:'Joindre un fichier';name.title=file?file.name:'';if(status)status.textContent=file?'Fichier sélectionné : '+file.name:'';};
 input.addEventListener('change',update);
 input.form?.addEventListener('reset',()=>setTimeout(update,0));
});
