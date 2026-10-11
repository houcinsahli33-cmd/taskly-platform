/* Catalogue Taskly : les données et les modifications passent par les API existantes. */
(() => {
  'use strict';
  const TAILLE_PAGE = 3;
  const el = id => document.getElementById(id);
  const formatNombre = n => Number.isFinite(Number(n)) ? Number(n) : 0;
  const filtrerEtTrier = (services, recherche, tri) => {
    const terme = String(recherche || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const resultat = (Array.isArray(services) ? services : []).filter(service =>
      [service.nom, service.description].some(texte => String(texte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(terme))
    );
    if (tri === 'az') resultat.sort((a,b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'));
    if (tri === 'za') resultat.sort((a,b) => String(b.nom || '').localeCompare(String(a.nom || ''), 'fr'));
    if (tri === 'artisans') resultat.sort((a,b) => formatNombre(b.total_artisans)-formatNombre(a.total_artisans) || String(a.nom||'').localeCompare(String(b.nom||''),'fr'));
    if (tri === 'demandes') resultat.sort((a,b) => formatNombre(b.total_demandes)-formatNombre(a.total_demandes) || String(a.nom||'').localeCompare(String(b.nom||''),'fr'));
    return resultat;
  };
  const validerPhoto = fichier => {
    if (!fichier) return '';
    if (!['image/jpeg','image/png'].includes(fichier.type)) return 'Choisissez un fichier JPEG ou PNG.';
    if (fichier.size > 3 * 1024 * 1024) return 'La photo ne doit pas dépasser 3 Mo.';
    return '';
  };
  // Ne jamais afficher comme src une URL externe ou un schéma injecté depuis la base.
  const cheminImage = service => {
    const chemin = service?.image;
    if (typeof chemin === 'string' && /^\/(?:api\/media\/|images\/services\/)[\w./-]+$/.test(chemin) && !chemin.includes('..') && !chemin.endsWith('.svg')) return chemin;
    return imageServiceFallback(service?.nom);
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = {filtrerEtTrier, validerPhoto, cheminImage};
  if (typeof document === 'undefined') return;

  const state = {services:[], page:1, recherche:'', tri:'actuel', edition:null, suppression:null, enCours:false, derniereOuverture:null};
  const creer = (tag, classe, texte) => {
    const node = document.createElement(tag);
    if (classe) node.className = classe;
    if (texte !== undefined) node.textContent = String(texte);
    return node;
  };
  const informer = (message, erreur=false) => {
    const cible = el('services-feedback');
    cible.textContent = message;
    cible.classList.toggle('error', erreur);
  };
  const erreurDialogue = (id, message) => {
    const cible=el(id);cible.textContent=message;cible.hidden=!message;
  };
  const estIdentifiant = id => Number.isSafeInteger(Number(id)) && Number(id) > 0;
  const cartes = () => {
    const trouves = filtrerEtTrier(state.services, state.recherche, state.tri);
    const pages = Math.max(1, Math.ceil(trouves.length / TAILLE_PAGE));
    state.page = Math.max(1, Math.min(state.page, pages));
    const debut = (state.page-1)*TAILLE_PAGE;
    const visibles = trouves.slice(debut, debut+TAILLE_PAGE);
    const cible = el('services-grid');
    cible.replaceChildren();
    if (!visibles.length) {
      const vide=creer('div','services-empty');
      vide.append(creer('strong','',state.services.length ? 'Aucun service ne correspond à cette recherche.' : 'Aucun service au catalogue.'),creer('p','',state.services.length ? 'Modifiez la recherche pour afficher d’autres prestations.' : 'Cliquez sur Ajouter un service pour créer la première prestation.'));
      cible.append(vide);
    }
    visibles.forEach(service=>{
      const carte=creer('article','services-card');
      const photo=creer('img','services-card-image');
      photo.src=cheminImage(service);
      photo.alt=`Illustration du service ${service.nom || ''}`;
      photo.loading='lazy';
      photo.onerror=()=>{photo.onerror=null;photo.src=imageServiceFallback(service.nom);};
      const corps=creer('div','services-card-body');
      const titre=creer('h3','',service.nom||'Service sans nom');
      const description=creer('p','services-card-description',service.description||'Aucune description.');
      const boutons=creer('div','services-card-buttons');
      const edit=creer('button','services-edit','Modifier');
      edit.type='button';edit.dataset.serviceEdit=String(service.id);
      edit.setAttribute('aria-label',`Modifier le service ${service.nom}`);
      const del=creer('button','services-remove','Supprimer');
      del.type='button';del.dataset.serviceRemove=String(service.id);
      del.setAttribute('aria-label',`Supprimer le service ${service.nom}`);
      boutons.append(edit,del);corps.append(titre,description,boutons);carte.append(photo,corps);cible.append(carte);
    });
    const nombre = state.services.length;
    el('services-total').textContent = `${nombre} service${nombre!==1?'s':''} au catalogue`;
    el('services-visible-count').textContent = `${visibles.length} service${visibles.length!==1?'s':''} affiché${visibles.length!==1?'s':''}`;
    el('services-range').textContent = trouves.length ? `Affichage de ${debut+1} à ${debut+visibles.length} sur ${trouves.length} service${trouves.length!==1?'s':''}` : 'Aucun résultat';
    el('services-page').textContent=`Page ${state.page} sur ${pages}`;
    el('services-prev').disabled=state.page===1;
    el('services-next').disabled=state.page>=pages;
    cible.setAttribute('aria-busy','false');
  };
  async function charger() {
    el('services-grid').setAttribute('aria-busy','true');
    try {
      const resultat=await requeteAPI('/api/services',{cache:'no-store'});
      if (!Array.isArray(resultat.services)) throw Error('Réponse du catalogue invalide.');
      state.services=resultat.services;
      informer('');
      cartes();
    } catch (error) {
      el('services-grid').setAttribute('aria-busy','false');
      informer(`Impossible de charger le catalogue : ${error.message}`,true);
      el('services-grid').replaceChildren(creer('p','services-empty','Les services sont momentanément indisponibles.'));
      el('services-total').textContent='Services indisponibles';
      el('services-visible-count').textContent='—';
      el('services-range').textContent='—';
      el('services-prev').disabled=true;el('services-next').disabled=true;
    }
  }
  function afficherDialog(id, bouton) {
    state.derniereOuverture=bouton||document.activeElement;
    el(id).showModal();
  }
  function fermerDialog(id) {
    el(id).close();
    state.derniereOuverture?.focus?.();
  }
  function ouvrirEdition(service, bouton) {
    if (state.enCours) return;
    state.edition=service||null;
    const form=el('services-editor-form');form.reset();
    el('services-editor-heading').textContent=service?'Modifier un service':'Ajouter un service';
    el('services-edit-id').value=service?String(service.id):'';
    el('services-edit-name').value=service?.nom||'';
    el('services-edit-description').value=service?.description||'';
    el('services-photo-hint').textContent=service?'JPEG ou PNG · 3 Mo maximum. Sans nouvelle photo, l’image actuelle reste en place.':'JPEG ou PNG · 3 Mo maximum. Une image par défaut sera utilisée si aucune photo n’est fournie.';
    erreurDialogue('services-edit-error','');
    el('services-save').textContent=service?'Enregistrer les modifications':'Ajouter le service';
    afficherDialog('services-editor-dialog',bouton);
    el('services-edit-name').focus();
  }
  function ouvrirSuppression(service, bouton) {
    if(state.enCours)return;
    state.suppression=service;
    el('services-delete-name').textContent=`Voulez-vous vraiment supprimer « ${service.nom} » du catalogue Taskly ?`;
    erreurDialogue('services-delete-error','');
    afficherDialog('services-delete-dialog',bouton);
  }
  async function enregistrer(event) {
    event.preventDefault();
    if(state.enCours)return;
    const nom=el('services-edit-name').value.trim();
    const description=el('services-edit-description').value.trim();
    const photo=el('services-edit-photo').files[0];
    const erreurPhoto=validerPhoto(photo);
    if (!nom || nom.length>255 || !description || description.length>10000 || erreurPhoto) {
      erreurDialogue('services-edit-error',erreurPhoto||'Renseignez un nom et une description valides.');return;
    }
    const service=state.edition;
    if(service && !estIdentifiant(service.id)){erreurDialogue('services-edit-error','Identifiant du service invalide.');return;}
    const donnees=new FormData();
    donnees.append('nom',nom);donnees.append('description',description);
    if(photo) donnees.append('photo',photo);
    state.enCours=true;
    const bouton=el('services-save');bouton.disabled=true;
    erreurDialogue('services-edit-error','');
    try {
      await requeteAPI(service?`/api/admin/services/${service.id}`:'/api/admin/services',{method:service?'PUT':'POST',body:donnees});
      fermerDialog('services-editor-dialog');
      state.page=1;
      await charger();
      informer(service?'Service modifié avec succès.':'Service ajouté avec succès.');
    } catch(error) {erreurDialogue('services-edit-error',error.message||'Impossible d’enregistrer le service.');}
    finally{state.enCours=false;bouton.disabled=false;}
  }
  async function supprimer() {
    const service=state.suppression;
    if(state.enCours || !service || !estIdentifiant(service.id))return;
    state.enCours=true;
    const bouton=el('services-confirm-delete');bouton.disabled=true;
    erreurDialogue('services-delete-error','');
    try {
      await requeteAPI(`/api/admin/services/${service.id}`,{method:'DELETE'});
      fermerDialog('services-delete-dialog');
      state.suppression=null;
      await charger();
      informer('Service supprimé avec succès.');
    } catch(error){erreurDialogue('services-delete-error',error.message||'Suppression impossible.');}
    finally{state.enCours=false;bouton.disabled=false;}
  }
  async function initialiser() {
    await attendreSession();
    if(!window.utilisateurCourant || window.utilisateurCourant.role!=='admin')return;
    el('services-search').addEventListener('input',event=>{state.recherche=event.target.value;state.page=1;cartes();});
    el('services-sort').addEventListener('change',event=>{state.tri=event.target.value;state.page=1;cartes();});
    el('services-prev').addEventListener('click',()=>{if(state.page>1){state.page--;cartes();}});
    el('services-next').addEventListener('click',()=>{state.page++;cartes();});
    el('services-add').addEventListener('click',event=>ouvrirEdition(null,event.currentTarget));
    el('services-grid').addEventListener('click',event=>{
      const edit=event.target.closest('[data-service-edit]');
      const remove=event.target.closest('[data-service-remove]');
      if(!edit&&!remove)return;
      const id=(edit||remove).dataset[edit?'serviceEdit':'serviceRemove'];
      const service=state.services.find(item=>String(item.id)===id);
      if(!service)return;
      if(edit)ouvrirEdition(service,edit);else ouvrirSuppression(service,remove);
    });
    document.querySelectorAll('[data-service-dialog-close]').forEach(b=>b.addEventListener('click',()=>{if(!state.enCours)fermerDialog(b.dataset.serviceDialogClose);}));
    el('services-editor-form').addEventListener('submit',enregistrer);
    el('services-confirm-delete').addEventListener('click',supprimer);
    for(const id of ['services-editor-dialog','services-delete-dialog']) {
      el(id).addEventListener('cancel',event=>{if(state.enCours)event.preventDefault();});
      el(id).addEventListener('click',event=>{if(event.target===el(id) && !state.enCours)fermerDialog(id);});
    }
    await charger();
  }
  document.addEventListener('DOMContentLoaded',initialiser);
})();
