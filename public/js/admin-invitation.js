document.addEventListener('DOMContentLoaded',async()=>{
 const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
 history.replaceState(null,'',location.pathname);
 const status=document.getElementById('invitation-status'),form=document.getElementById('invitation-form');
 try{const d=await requeteAPI('/api/admin-settings/invitation?token='+encodeURIComponent(token));status.textContent='Invitation pour '+d.invitation.email;form.hidden=false;}catch(e){status.textContent=e.message;}
 form.addEventListener('submit',async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;
 try{const d=await requeteAPI('/api/admin-settings/invitation/accept',{method:'POST',body:JSON.stringify({token,motDePasse:document.getElementById('invitation-password').value})});status.textContent=d.message;form.hidden=true;}catch(err){status.textContent=err.message;b.disabled=false;}});
});