/* Taskly Mail V3 — conversations Support, montage isole des formulaires historiques. */
(() => {
  'use strict';
  const ready = () => {
    const host=document.getElementById('taskly-mail-v3-support');
    if(!host || typeof window.requeteAPI!=='function')return;
    if(host.dataset.mode==='admin' && window.TasklyMailV3AdminUI)return;
    const admin=host.dataset.mode==='admin';
    const base=admin?'/api/admin/taskly-mail-service-v3':'/api/taskly-mail-service-v3';
    const create=(tag,txt,cls)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=String(txt);if(cls)e.className=cls;return e;};
    const btn=(label,fn)=>{const b=create('button',label,'tmv3-button');b.type='button';b.addEventListener('click',fn);return b;};
    const info=create('p','Chargement des conversations…','tmv3-info');info.setAttribute('role','status');
    const list=create('div',undefined,'tmv3-list');
    const detail=create('div',undefined,'tmv3-detail');
    host.append(info,list,detail);
    let busy=false;
    const request=(path,method='GET',data)=>window.requeteAPI(base+path,{method,...(data===undefined?{}:{body:JSON.stringify(data)})});
    const notify=(t)=>{info.textContent=t;};
    const run=async fn=>{if(busy)return;busy=true;try{await fn();}catch(e){notify(e?.message||'Erreur de chargement.');}finally{busy=false;}};
    const fmt=value=>{const d=new Date(value);return Number.isNaN(d.valueOf())?'':d.toLocaleString('fr-FR');};
    async function openThread(id){
      const result=await request('/support/threads/'+encodeURIComponent(id));
      const thread=result.thread;
      detail.replaceChildren(create('h3',thread.subject),create('p','Conversation #'+thread.id));
      if(admin)detail.append(create('p','Expéditeur : '+thread.user_address));
      const messages=create('div',undefined,'tmv3-messages');
      for(const entry of (result.entries||[])){
        const item=create('article',undefined,'tmv3-message');
        item.append(create('strong',entry.sender_kind==='admin'?'Support Taskly':'Utilisateur'),
          create('small',fmt(entry.created_at)),create('p',entry.body));messages.append(item);
      }
      detail.append(messages);
      if(!admin){
        const replyForm=create('form',undefined,'tmv3-form');
        const replyLabel=create('label','Votre réponse');const replyBody=create('textarea');
        replyBody.required=true;replyBody.maxLength=10000;replyBody.rows=4;
        replyLabel.append(replyBody);
        const replySubmit=create('button','Répondre au Support','tmv3-button');replySubmit.type='submit';
        replyForm.append(replyLabel,replySubmit);
        replyForm.addEventListener('submit',event=>{event.preventDefault();if(!replyForm.reportValidity())return;
          run(async()=>{await request('/support/threads/'+encodeURIComponent(id)+'/replies','POST',{body:replyBody.value});
            await openThread(id);notify('Réponse enregistrée.');});});
        detail.append(replyForm);
      }
      if(admin){
        const form=create('form',undefined,'tmv3-form');
        const label=create('label','Votre réponse');const body=create('textarea');body.required=true;body.maxLength=10000;body.rows=4;body.placeholder='Votre réponse au client ou à l’artisan';
        label.append(body);const submit=create('button','Envoyer la réponse','tmv3-button');submit.type='submit';
        form.append(label,submit);
        form.addEventListener('submit',ev=>{ev.preventDefault();if(!form.reportValidity())return;
          run(async()=>{await request('/support/threads/'+encodeURIComponent(id)+'/replies','POST',{body:body.value});
            body.value='';await openThread(id);notify('Réponse enregistrée dans la conversation.');});});detail.append(form);
      }
    }
    async function refresh(){
      const result=await request('/support/threads');
      list.replaceChildren();detail.replaceChildren();
      for(const thread of (result.threads||[])){
        const label='#'+thread.id+' · '+thread.subject+(admin?' · '+thread.user_address:'')+' · '+fmt(thread.updated_at);
        list.append(btn(label,()=>run(()=>openThread(thread.id))));
      }
      notify((result.threads||[]).length+' conversation(s) Support (50 dernières au maximum).');
      if(!(result.threads||[]).length)list.append(create('p','Aucune conversation Support V3.'));
    }
    const top=create('div',undefined,'tmv3-toolbar');top.append(btn('Actualiser',()=>run(refresh)));
    if(!admin){
      const form=create('form',undefined,'tmv3-form');
      const subjectLabel=create('label','Objet');const subject=create('input');subject.maxLength=200;subject.required=true;subjectLabel.append(subject);
      const bodyLabel=create('label','Votre message');const body=create('textarea');body.rows=4;body.maxLength=10000;body.required=true;bodyLabel.append(body);
      const submit=create('button','Envoyer à support@taskly.dz','tmv3-button');submit.type='submit';
      form.append(subjectLabel,bodyLabel,submit);
      form.addEventListener('submit',ev=>{ev.preventDefault();if(!form.reportValidity())return;
        run(async()=>{const created=await request('/support/threads','POST',{to:'support@taskly.dz',subject:subject.value,body:body.value});
          subject.value='';body.value='';await refresh();await openThread(created.threadId);notify('Votre message est enregistré dans Taskly Mail Support.');});});
      top.append(form);
    }
    host.insertBefore(top,info);
    run(refresh);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
