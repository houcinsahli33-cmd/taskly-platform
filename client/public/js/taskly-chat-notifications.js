'use strict';
// Le compteur est chargé uniquement dans le cadre principal (pas dans chaque iframe).
document.addEventListener('DOMContentLoaded',async()=>{
 await attendreSession();const role=window.utilisateurCourant?.role;if(!['client','artisan'].includes(role))return;
 const url='/espace/'+role+'/messagerie',link=document.querySelector('.sidebar [data-dashboard-link="messagerie"]');if(!link)return;
 if(!link.querySelector('svg'))link.insertAdjacentHTML('afterbegin','<svg class="chat-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11a8 8 0 0 1-8 8H4l2-5a8 8 0 1 1 15-3Z"/><path d="M8 11h8"/></svg>');
 const navIcons={"accueil": "<svg class=\"chat-nav-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/></svg>", "demandes": "<svg class=\"chat-nav-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"5\" y=\"4\" width=\"14\" height=\"17\" rx=\"2\"/><path d=\"M9 3h6v4H9zM9 12h6m-6 4h6\"/></svg>", "profil": "<svg class=\"chat-nav-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"7\" r=\"4\"/><path d=\"M4 21v-2a8 8 0 0 1 16 0v2\"/></svg>", "support": "<svg class=\"chat-nav-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01\"/></svg>"};
 if(role==='client'){for(const [key,markup] of Object.entries(navIcons)){const entry=document.querySelector('.sidebar [data-dashboard-link="'+key+'"]');if(entry&&!entry.querySelector('svg'))entry.insertAdjacentHTML('afterbegin',markup);}const title=document.querySelector('.sidebar-title');if(title&&!title.querySelector('svg'))title.insertAdjacentHTML('afterbegin',"<svg class=\"chat-nav-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m3 10 9-7 9 7v10H3zM9 20v-7h6v7\"/></svg>");}
 const header=document.querySelector('#site-header .header-actions');let bell=null;
 if(header){bell=document.createElement('a');bell.href=url;bell.className='cw-bell';bell.title='Notifications de messagerie';bell.setAttribute('aria-label','Messagerie — notifications indisponibles');bell.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 6-3 7-3 9h18c0-2-3-3-3-9M10 21h4"/></svg><span class="chat-nav-count" data-chat-unread hidden></span>';header.prepend(bell);bell.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();link.click();});}
 let busy=false,last=0,timer;
 async function refresh(force=false){
  if(busy||document.visibilityState!=='visible'||(!force&&Date.now()-last<12000))return;busy=true;last=Date.now();
  try{const {total}=await requeteAPI('/api/demandes/chat/unread');if(!Number.isSafeInteger(total)||total<0)throw Error('Compteur invalide');
   document.querySelectorAll('[data-chat-unread]').forEach(el=>{el.hidden=total===0;el.textContent=total>99?'99+':String(total);el.setAttribute('aria-label',`${total} messages non lus`);});
   bell?.setAttribute('aria-label',total?`${total} nouveaux messages`:'Aucun nouveau message');if(bell)bell.title=total?`${total} nouveaux messages`:'Aucun nouveau message';
  }catch(e){document.querySelectorAll('[data-chat-unread]').forEach(el=>{el.hidden=true;});bell?.setAttribute('aria-label','Notifications indisponibles');if(bell)bell.title='Notifications indisponibles';if([401,403].includes(e.status))clearInterval(timer);}
  finally{busy=false;}
 }
 addEventListener('message',e=>{const frame=document.querySelector('iframe[id$="content-frame"]');if(e.origin===location.origin&&e.source===frame?.contentWindow&&e.data?.type==='taskly-chat-read'&&Date.now()-last>1000)refresh(true);});
 document.addEventListener('visibilitychange',()=>refresh());timer=setInterval(refresh,30000);addEventListener('pagehide',()=>clearInterval(timer),{once:true});refresh(true);
});
