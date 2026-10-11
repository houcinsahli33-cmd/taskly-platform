/* Signalements administrateur : données réelles, aucune liste ni action simulée. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const e = value => echapperHTML(value == null ? '' : String(value));
  const statuts = {nouveau:'Nouveau',non_traite:'Non traité',en_cours:'En cours',traite:'Traité'};
  const priorites = {haute:'Haute',moyenne:'Moyenne',basse:'Basse'};
  const demandesStatuts = {en_attente:'En attente',acceptee:'Acceptée',refusee:'Refusée',annulee:'Annulée',terminee:'Terminée'};
  const etat = {page:1,pages:1,limite:6,total:0,statut:'tous',priorite:'toutes',tri:'recent',recherche:'',sequence:0,dossier:null,detailsOuverts:false};
  let rechercheTimer,retourFocus;

  const nom = (obj,prefixe='') => [obj?.[prefixe+'prenom'],obj?.[prefixe+'nom']].filter(Boolean).join(' ')||'Non précisé';
  const initiales = obj => (String(obj?.prenom||'?').charAt(0)+String(obj?.nom||'').charAt(0)).toUpperCase();
  const date = value => value ? formatDate(value) : 'Non renseignée';
  const dateHeure = value => value ? formatDateHeure(value) : 'Non renseignée';
  const valeur = value => value===null||value===undefined||String(value).trim()===''?'Non renseigné':String(value);
  const etiquetteStatut = statut => `<span class="reports-badge ${e(statut)}">${e(statuts[statut]||statut||'Inconnu')}</span>`;
  const nomRole = role => role==='artisan'?'Artisan':role==='client'?'Client':role==='admin'?'Administrateur':'Compte';
  const name = (row,prefix) => [row[prefix+'prenom'],row[prefix+'nom']].filter(Boolean).join(' ')||'Non renseigné';
  const identifiant = n => Number.isSafeInteger(Number(n))&&Number(n)>0 ? Number(n) : null;

  function synchroniserFiltres() {
    document.querySelectorAll('[data-report-status]').forEach(b=>{
      const actif=b.dataset.reportStatus===etat.statut;
      b.classList.toggle('active',actif);
      b.setAttribute('aria-pressed',String(actif));
    });
    document.querySelectorAll('[data-report-counter]').forEach(b=>{
      const actif=b.dataset.reportCounter===etat.statut;
      b.classList.toggle('active',actif);
      b.setAttribute('aria-pressed',String(actif));
    });
  }
  function ligne(s) {
    const id=identifiant(s.id);
    if(!id)return '';
    const classe=e(s.priorite||'moyenne');
    return `<tr>
      <td><div class="reports-incident"><span class="reports-warning-icon" aria-hidden="true">⚠</span><div><strong>${e(s.motif||'Signalement')}</strong><small title="${e(s.description||'')}">${e(s.description||'Aucune description')}</small></div></div></td>
      <td><strong>${e(name(s,'signaleur_'))}</strong><small>${e(nomRole(s.signaleur_role))}</small></td>
      <td><strong>${e(name(s,'signale_'))}</strong><small>${e(nomRole(s.signale_role))}</small></td>
      <td><span class="reports-request">#${e(s.demande_id||'—')}</span></td>
      <td><span class="reports-prio ${classe}">${e(priorites[s.priorite]||'Moyenne')}</span></td>
      <td>${etiquetteStatut(s.statut)}</td>
      <td class="reports-actions"><button type="button" class="reports-examine" data-report-examine="${id}">Examiner</button></td>
    </tr>`;
  }
  function construireTableau(lignes) {
    if (!lignes.length) return '<div class="reports-empty">Aucun signalement pour ces critères. Modifiez vos filtres pour élargir la recherche.</div>';
    return `<table class="reports-table"><thead><tr><th>Signalement</th><th>Signalé par</th><th>Utilisateur signalé</th><th>Demande liée</th><th>Priorité</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${lignes.map(ligne).join('')}</tbody></table>`;
  }
  async function charger() {
    const numero=++etat.sequence;
    const cible=el('reports-table');
    cible.setAttribute('aria-busy','true');
    const params=new URLSearchParams({page:String(etat.page),limite:String(etat.limite),statut:etat.statut,priorite:etat.priorite,tri:etat.tri,recherche:etat.recherche});
    try {
      const data=await requeteAPI(`/api/admin/signalements?${params}`);
      if(numero!==etat.sequence)return;
      const signalements=Array.isArray(data.signalements)?data.signalements:[];
      etat.page=Math.max(1,Number(data.page)||1);
      etat.pages=Math.max(1,Number(data.pages)||1);
      etat.total=Math.max(0,Number(data.total)||0);
      adminSignalements=signalements;
      cible.innerHTML=construireTableau(signalements);
      for(const statut of ['total','nouveau','non_traite','en_cours','traite']){
        const total=Number(data.compteurs?.[statut]);
        el('reports-'+statut).textContent=Number.isFinite(total)?String(total):'—';
      }
      const debut=etat.total?(etat.page-1)*etat.limite+1:0;
      const fin=etat.total?Math.min(etat.total,etat.page*etat.limite):0;
      el('reports-range').textContent=`Affichage de ${debut} à ${fin} sur ${etat.total} signalement${etat.total>1?'s':''}`;
      el('reports-page-label').textContent=`Page ${etat.page} sur ${etat.pages}`;
      el('reports-prev').disabled=etat.page<=1;
      el('reports-next').disabled=etat.page>=etat.pages;
    } catch(err) {
      if(numero!==etat.sequence)return;
      cible.innerHTML=`<div class="reports-error" role="alert">${e(err.message||'Impossible de charger les signalements.')}</div>`;
      el('reports-range').textContent='Données indisponibles';
      el('reports-page-label').textContent='Page —';
      el('reports-prev').disabled=true;
      el('reports-next').disabled=true;
      for(const statut of ['total','nouveau','non_traite','en_cours','traite'])el('reports-'+statut).textContent='—';
    } finally {if(numero===etat.sequence)cible.setAttribute('aria-busy','false');}
  }
  function changerFiltre(champ,valeur) {etat[champ]=valeur;etat.page=1;synchroniserFiltres();charger();}

  function cartePersonne(titre,icone,personne,suspect=false) {
    return `<section class="reports-detail-card"><h3>${icone} &nbsp; ${titre}</h3>
      <div class="reports-person"><span class="reports-avatar ${suspect?'suspect':''}">${e(initiales(personne))}</span><div><strong>${e(nom(personne))}</strong><small>Compte ${e(nomRole(personne.role).toLowerCase())}</small></div></div>
      <p class="reports-email">✉ &nbsp; ${e(personne.email||'Adresse non renseignée')}</p>
      <span class="reports-account-state ${personne.statut_compte==='bloque'?'bloque':''}">Compte ${personne.statut_compte==='bloque'?'bloqué':'actif'}</span>
    </section>`;
  }
  function vueDemande(d) {
    const demande=etat.dossier?.demande;
    const lien=etat.dossier?.correspondance;
    if(!demande)return `<div class="reports-request-check bad" role="alert"><strong>Demande introuvable</strong><p>Impossible de vérifier les personnes ou l'annulation. Ne prenez pas de décision sur un compte sans vérification.</p></div>`;
    const confirmee=lien?.confirme===true;
    const annulee=demande.statut==='annulee';
    return `<section class="reports-request-details" id="reports-request-details" aria-label="Détails complets de la demande">
      <div class="reports-request-check ${confirmee?'good':'bad'}" role="status">
        <strong>${confirmee?'✓ Identités reliées à cette demande':'⚠ Correspondance des identités non confirmée'}</strong>
        <p>${confirmee?'Les identifiants enregistrés montrent que le déclarant et la personne signalée sont les deux parties de cette demande. Cela ne prouve pas le motif du signalement.':'Les identifiants de ce signalement ne correspondent pas aux deux parties de la demande. Vérifiez le dossier avant toute sanction.'}</p>
      </div>
      ${annulee?`<div class="reports-request-check cancelled" role="status"><strong>⚠ Demande annulée ${demande.annulee_par==='client'?'par le client':demande.annulee_par==='artisan'?"par l'artisan":'(auteur non renseigné)'}</strong><p>Annulation : ${e(dateHeure(demande.date_annulation))}. Motif : ${e(valeur(demande.motif_annulation))}. La demande annulée reste consultable pour examiner le signalement.</p></div>`:''}
      <div class="reports-request-facts"><div><span>Statut de la demande</span><strong class="${annulee?'is-cancelled':''}">${e(demandesStatuts[demande.statut]||demande.statut||'Non renseigné')}</strong></div>
      <div><span>Service</span><strong>${e(valeur(demande.service_nom))}</strong></div>
      <div><span>Créée le</span><strong>${e(dateHeure(demande.created_at))}</strong></div>
      <div><span>Date souhaitée</span><strong>${e(date(demande.date_souhaitee))}</strong></div>
      <div><span>Dernier traitement</span><strong>${e(dateHeure(demande.date_traitement))}</strong></div>
      <div><span>Date d'annulation</span><strong>${e(dateHeure(demande.date_annulation))}</strong></div></div>
      <div class="reports-request-parties"><div><span>Client de la demande — #${e(demande.client_user_id)}</span><strong>${e(name(demande,'client_'))}</strong><small>${e(demande.client_email||'Email indisponible')} · ${e(valeur(demande.client_telephone))} · ${e(valeur(demande.client_ville))}</small></div>
      <div><span>Artisan de la demande — #${e(demande.artisan_user_id)}</span><strong>${e(name(demande,'artisan_'))}</strong><small>${e(demande.artisan_email||'Email indisponible')} · ${e(valeur(demande.artisan_telephone))} · ${e(valeur(demande.artisan_ville))}</small></div></div>
      <div class="reports-request-message"><span>Description complète de la demande</span><p>${e(valeur(demande.message))}</p></div>
      <div class="reports-request-message"><span>Adresse d'intervention</span><p>${e(valeur(demande.adresse))}</p></div>
      <div class="reports-request-message"><span>Annulation</span><p>${annulee?e('Par : '+(demande.annulee_par||'non renseigné')+' · Motif : '+valeur(demande.motif_annulation)): 'Aucune annulation enregistrée.'}</p></div>
    </section>`;
  }
  function creerFenetre(data) {
    const s=data.signalement;
    const signalant={prenom:s.signaleur_prenom,nom:s.signaleur_nom,role:s.signaleur_role,email:s.signaleur_email,statut_compte:s.signaleur_statut_compte};
    const cible={prenom:s.signale_prenom,nom:s.signale_nom,role:s.signale_role,email:s.signale_email,statut_compte:s.signale_statut_compte};
    const blocagePossible=s.signale_role==='artisan'&&data.correspondance?.confirme===true;
    const compteDejaBloque=s.signale_statut_compte==='bloque';
    const notificationAutorisee=s.statut==='traite'&&!!s.signaleur_email;
    const notifDestination=s.signaleur_role==='client'?'client':'déclarant';
    const id=identifiant(s.id);
    const justification=`Votre signalement concernant la demande n° ${s.demande_id} a été examiné par notre équipe.`;
    return `<div class="reports-dialog" role="dialog" aria-modal="true" aria-labelledby="reports-dialog-heading" tabindex="-1">
      <header class="reports-dialog-header"><div><h2 id="reports-dialog-heading">Examiner le signalement <span>#SIG-${String(id).padStart(4,'0')}</span></h2><p>Analyse du dossier · réception ${e(dateHeure(s.created_at))}</p></div><div class="reports-dialog-top-actions">${etiquetteStatut(s.statut)}<button type="button" class="reports-dialog-close" data-report-close aria-label="Fermer">×</button></div></header>
      <div class="reports-dialog-content"><div class="reports-dialog-grid"><div class="reports-dialog-left">
        <div class="reports-persons">${cartePersonne(s.signaleur_role==='client'?'CLIENT DÉCLARANT':'DÉCLARANT','♙',signalant)}${cartePersonne(s.signale_role==='artisan'?'ARTISAN SIGNALÉ':'UTILISATEUR SIGNALÉ','♢',cible,true)}</div>
        <section class="reports-detail-card"><h3>▧ &nbsp; DEMANDE ASSOCIÉE</h3><div class="reports-detail-row"><h4>Demande #${e(s.demande_id)}</h4><button type="button" class="reports-request-link" id="reports-show-request" aria-expanded="${etat.detailsOuverts}" aria-controls="reports-full-request">${etat.detailsOuverts?'Masquer les détails':'Voir les détails'} ↗</button></div>
          <p>Vérifiez l'identité du client, l'artisan, le statut et une éventuelle annulation avant de décider.</p>
          <div class="reports-request-mini ${data.demande?.statut==='annulee'?'cancelled':''}">Statut actuel : <strong>${e(demandesStatuts[data.demande?.statut]||'Indisponible')}</strong>${data.demande?.statut==='annulee'?' — demande annulée':''}</div>
          <div id="reports-full-request" ${etat.detailsOuverts?'':'hidden'}>${vueDemande(data)}</div>
        </section>
        <section class="reports-detail-card"><div class="reports-detail-row"><h3>⚑ &nbsp; MOTIF DU SIGNALEMENT</h3><span class="reports-prio ${e(s.priorite)}">${e(priorites[s.priorite]||'Moyenne')}</span></div><h4>${e(s.motif||'Signalement')}</h4><div class="reports-quote">${e(s.description||'Aucune description fournie.')}</div><p>Source : signalement d'un utilisateur · ${e(dateHeure(s.created_at))}</p>
          <label for="reports-detail-priority">Priorité du dossier</label><select id="reports-detail-priority"><option value="basse" ${s.priorite==='basse'?'selected':''}>Basse</option><option value="moyenne" ${s.priorite==='moyenne'?'selected':''}>Moyenne</option><option value="haute" ${s.priorite==='haute'?'selected':''}>Haute</option></select>
        </section>
        <p id="reports-dialog-feedback" class="reports-feedback" role="status"></p>
      </div><div class="reports-dialog-left reports-dialog-right">
        <section class="reports-detail-card"><h3>♢ &nbsp; DÉCISION SUR LE COMPTE</h3><h4>${e(s.signale_role==='artisan'?'Artisan concerné':s.signale_role==='client'?'Client concerné':'Compte protégé')}</h4><p>Un signalement ne bloque jamais automatiquement un compte.</p><div class="reports-account-status-line"><span>Statut du compte</span><strong>${compteDejaBloque?'🔴 Bloqué':'🟢 Actif'}</strong></div>
        ${s.signale_role==='artisan'?`<a class="reports-danger-button reports-danger-link" ${blocagePossible?`href="${e(window.location.pathname.split('/dashboard')[0]+'/dashboard/verification?user='+encodeURIComponent(s.signale_user_id))}"`:'aria-disabled="true"'}>${compteDejaBloque?'Examiner le compte bloqué':'Bloquer le compte artisan'}</a><p class="reports-hint">${blocagePossible?'Le blocage doit être décidé dans le dossier de vérification, avec un motif et une confirmation.':'Vérifiez d’abord la demande et ses participants ; blocage indisponible.'}</p>`:
           s.signale_role==='client'?`<button type="button" class="reports-danger-button" data-report-block="${e(s.signale_user_id)}" ${compteDejaBloque||!data.correspondance?.confirme?'disabled':''}>${compteDejaBloque?'Client déjà bloqué':'Bloquer le compte client'}</button><p class="reports-hint">Une confirmation et un motif seront demandés.</p>`:'<p class="reports-hint">Les comptes administrateurs sont protégés.</p>'}
        </section>
        <section class="reports-detail-card"><h3>✉ &nbsp; NOTIFICATION AU ${s.signaleur_role==='client'?'CLIENT':'DÉCLARANT'}</h3><h4>Informer le ${e(notifDestination)} par e-mail</h4><p>Un message peut être envoyé lorsque le dossier est traité.</p>
        <form id="reports-notify-form" class="reports-notify-form"><label>À : ${e(s.signaleur_email||'Non renseigné')}</label><label for="reports-mail-subject">Objet</label><input id="reports-mail-subject" maxlength="160" required value="Votre signalement a été traité – Taskly"><label for="reports-mail-body">Message</label><textarea id="reports-mail-body" required minlength="10" maxlength="5000">Bonjour,\n\n${e(justification)}\n\nL'équipe Taskly.</textarea><button class="reports-notify-send" type="submit" ${notificationAutorisee?'':'disabled'}>✉ &nbsp; Envoyer l'e-mail</button></form>
        <p class="reports-hint">${notificationAutorisee?'Envoi réel via la messagerie configurée.':'Disponible après avoir marqué le signalement comme traité.'} Historique des envois : ${data.notifications?.length||0} entrée(s).</p>
        </section>
      </div></div></div>
      <footer class="reports-dialog-footer"><small>Décisions enregistrées dans MySQL. L'examen du signalement est indépendant de la demande.</small><div><button type="button" data-report-close>Fermer</button>${s.statut==='traite'?'<button type="button" class="reports-reopen" data-report-status-action="en_cours">Rouvrir le dossier</button>':`<button type="button" data-report-status-action="en_cours" ${s.statut==='en_cours'?'disabled':''}>Mettre en cours</button><button type="button" class="reports-mark-treated" data-report-status-action="traite">✓ Marquer comme traité</button>`}</div></footer>
    </div>`;
  }
  function fermer() {
    const root=el('reports-dialog-root');
    root.hidden=true;root.innerHTML='';document.body.classList.remove('reports-dialog-open');etat.dossier=null;
    retourFocus?.focus?.();
  }
  function feedback(message,erreur=false){const elmt=el('reports-dialog-feedback');if(!elmt)return;elmt.textContent=message;elmt.classList.toggle('error',erreur);}
  function afficherFenetre(data) {
    etat.dossier=data;
    const root=el('reports-dialog-root');
    root.innerHTML=creerFenetre(data);root.hidden=false;document.body.classList.add('reports-dialog-open');
    root.querySelector('.reports-dialog-close')?.focus();
  }
  async function examiner(id) {
    retourFocus=document.activeElement;
    const root=el('reports-dialog-root');
    root.hidden=false;root.innerHTML='<div class="reports-dialog reports-loading" role="status">Chargement du dossier…</div>';
    document.body.classList.add('reports-dialog-open');
    try {etat.detailsOuverts=false;afficherFenetre(await requeteAPI(`/api/admin/signalements/${id}`));}
    catch(err) {root.innerHTML=`<div class="reports-dialog reports-loading"><p role="alert">${e(err.message)}</p><button class="reports-examine" type="button" data-report-close>Fermer</button></div>`;}
  }
  async function modifier(changements) {
    const id=identifiant(etat.dossier?.signalement?.id);
    if(!id)return;
    const root=el('reports-dialog-root');
    root.querySelectorAll('button,select').forEach(b=>b.disabled=true);
    try {
      await requeteAPI(`/api/admin/signalements/${id}`,{method:'PATCH',body:JSON.stringify(changements)});
      const donnees=await requeteAPI(`/api/admin/signalements/${id}`);
      afficherFenetre(donnees);
      feedback('Modification enregistrée.');
      await charger();
    }catch(err){root.querySelectorAll('button,select').forEach(b=>b.disabled=false);feedback(err.message,true);}
  }
  async function notifier(form) {
    const id=identifiant(etat.dossier?.signalement?.id);if(!id)return;
    const bouton=form.querySelector('button[type="submit"]');bouton.disabled=true;
    try {
      const resultat=await requeteAPI(`/api/admin/signalements/${id}/notifier`,{method:'POST',body:JSON.stringify({sujet:el('reports-mail-subject').value.trim(),corps:el('reports-mail-body').value.trim()})});
      etat.dossier=await requeteAPI(`/api/admin/signalements/${id}`);
      feedback(resultat.message||'E-mail envoyé.');
    }catch(err){feedback(err.message,true);} finally{bouton.disabled=false;}
  }
  async function bloquerClient(id) {
    if(!etat.dossier?.correspondance?.confirme)return feedback('Identité non confirmée, blocage indisponible.',true);
    if(!window.confirm('Confirmez-vous le blocage de ce client ? Cette action révoque son accès.'))return;
    const motif=window.prompt('Motif obligatoire du blocage du client (5 à 500 caractères) :');
    if(motif===null)return;
    if(motif.trim().length<5||motif.trim().length>500)return feedback('Motif invalide : 5 à 500 caractères.',true);
    try {
      await requeteAPI(`/api/admin/users/${id}/bloquer`,{method:'PUT',body:JSON.stringify({motifBlocage:motif.trim()})});
      const numero=etat.dossier.signalement.id;
      afficherFenetre(await requeteAPI(`/api/admin/signalements/${numero}`));
      feedback('Compte client bloqué avec motif.');charger();
    }catch(err){feedback(err.message,true);}
  }
  function initialiser() {
    el('reports-year').textContent=`▣  Tableau de suivi · ${new Date().getFullYear()}`;
    document.querySelectorAll('[data-report-status]').forEach(b=>b.addEventListener('click',()=>changerFiltre('statut',b.dataset.reportStatus)));
    document.querySelectorAll('[data-report-counter]').forEach(b=>b.addEventListener('click',()=>changerFiltre('statut',b.dataset.reportCounter)));
    el('reports-priority').addEventListener('change',ev=>changerFiltre('priorite',ev.target.value));
    el('reports-sort').addEventListener('change',ev=>changerFiltre('tri',ev.target.value));
    el('reports-search').addEventListener('input',ev=>{
      clearTimeout(rechercheTimer);etat.sequence++;etat.recherche=ev.target.value.trim();etat.page=1;
      rechercheTimer=setTimeout(charger,300);
    });
    el('reports-prev').addEventListener('click',()=>{if(etat.page>1){etat.page--;charger();}});
    el('reports-next').addEventListener('click',()=>{if(etat.page<etat.pages){etat.page++;charger();}});
    el('reports-table').addEventListener('click',ev=>{const b=ev.target.closest('[data-report-examine]');if(b)examiner(b.dataset.reportExamine);});
    const root=el('reports-dialog-root');
    root.addEventListener('click',ev=>{
      if(ev.target===root || ev.target.closest('[data-report-close]'))return fermer();
      const details=ev.target.closest('#reports-show-request');
      if(details){etat.detailsOuverts=!etat.detailsOuverts;const section=el('reports-full-request');section.hidden=!etat.detailsOuverts;details.setAttribute('aria-expanded',String(etat.detailsOuverts));details.textContent=etat.detailsOuverts?'Masquer les détails ↑':'Voir les détails ↗';return;}
      const status=ev.target.closest('[data-report-status-action]');if(status)return modifier({statut:status.dataset.reportStatusAction});
      const block=ev.target.closest('[data-report-block]');if(block)return bloquerClient(block.dataset.reportBlock);
    });
    root.addEventListener('change',ev=>{if(ev.target.id==='reports-detail-priority')modifier({priorite:ev.target.value});});
    root.addEventListener('submit',ev=>{if(ev.target.id==='reports-notify-form'){ev.preventDefault();notifier(ev.target);}});
    document.addEventListener('keydown',ev=>{
      if(el('reports-dialog-root').hidden)return;
      if(ev.key==='Escape'){ev.preventDefault();fermer();}
      if(ev.key==='Tab'){
        const focusables=Array.from(root.querySelectorAll('button:not([disabled]), a[href]:not([aria-disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])')).filter(x=>x.offsetParent!==null);
        if(!focusables.length)return;
        const first=focusables[0],last=focusables[focusables.length-1];
        if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}
        else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}
      }
    });
    synchroniserFiltres();charger();
  }
  document.addEventListener('DOMContentLoaded', async()=>{
    await attendreSession();
    if(window.utilisateurCourant?.role==='admin' && document.body.dataset.workspacePage==='reports')initialiser();
  });
})();
