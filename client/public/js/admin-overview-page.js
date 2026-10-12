/* Tableau de bord réel : aucune statistique illustrative, aucune donnée inventée. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const etat = {statistiques:null, points:null, periode:'7j', generation:0, artisansEnAttente:null};
  const champs = [
    ['Utilisateurs', 'totalUsers', 'Comptes enregistrés', '♧', ''],
    ['Artisans', 'totalArtisans', 'Professionnels inscrits', '▣', ''],
    ['Demandes', 'totalDemandes', 'Demandes publiées', '▤', 'blue'],
    ['Signalements', 'totalSignalements', 'À surveiller', '⚑', 'red']
  ];
  const autres = [
    ['Clients', 'totalClients', '♙'],
    ['Services', 'totalServices', '▧'],
    ['Avis', 'totalAvis', '✓'],
    ['Tickets support', 'totalContactsSupport', '♧']
  ];
  const entier = n => (n !== null && n !== undefined && n !== '' && Number.isSafeInteger(Number(n)) && Number(n) >= 0 ? Number(n) : null);
  const afficherNombre = n => entier(n) === null ? '—' : entier(n).toLocaleString('fr-FR');
  const texte = value => echapperHTML(String(value ?? ''));
  const formatJour = cle => new Intl.DateTimeFormat('fr-FR', {day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${cle}T12:00:00Z`));
  const formatMois = cle => new Intl.DateTimeFormat('fr-FR', {month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(`${cle}-01T12:00:00Z`));
  const abrege = (cle, periode) => periode === '12m' ? formatMois(cle) : formatJour(cle);

  function afficherStats(s) {
    $('admin-stats-grid').setAttribute('aria-busy','false');
    $('admin-stats-grid').innerHTML = champs.map(([label, cle, description, icone, couleur]) => `
      <div class="overview-stat">
        <div class="overview-stat-top"><span>${label}</span><span class="overview-stat-icon ${couleur}" aria-hidden="true">${icone}</span></div>
        <strong>${afficherNombre(s?.[cle])}</strong>
        <small>${s?.[cle] == null ? 'Donnée indisponible' : description}</small>
      </div>`).join('');
    $('overview-secondary-stats').innerHTML = autres.map(([label,cle,icone]) => `<div class="overview-secondary-item"><span><i aria-hidden="true">${icone}</i>${label}</span><strong>${afficherNombre(s?.[cle])}</strong></div>`).join('');
  }

  function afficherPriorites(s) {
    const items = [
      {titre:'Signalements', desc:'Consulter les signalements reçus', nombre:s?.totalSignalements, lien:'reports', symbole:'⚑', couleur:''},
      {titre:'Artisans à vérifier', desc:'Examiner les dossiers de vérification', nombre:etat.artisansEnAttente, lien:'verification', symbole:'◇', couleur:'amber'},
      {titre:'Messages support', desc:'Accéder aux demandes d’assistance', nombre:s?.totalContactsSupport, lien:'contacts', symbole:'♧', couleur:'blue'}
    ];
    $('overview-priorities').innerHTML = items.map(i => `<a class="overview-priority" href="${i.lien}">
      <span class="overview-priority-icon ${i.couleur}" aria-hidden="true">${i.symbole}</span>
      <span class="overview-priority-label"><strong>${i.titre}</strong><small>${i.desc}</small></span>
      <span class="overview-priority-count" aria-label="${i.nombre == null ? 'Nombre indisponible' : afficherNombre(i.nombre)}">${afficherNombre(i.nombre)}</span>
    </a>`).join('');
  }

  function afficherDerniers(list, indisponible) {
    const cible = $('admin-latest-users');
    if (indisponible) {cible.innerHTML='<p class="overview-error">Derniers utilisateurs indisponibles.</p>';return;}
    if (!Array.isArray(list) || !list.length) {cible.innerHTML='<p class="overview-loading">Aucune inscription pour le moment.</p>';return;}
    cible.innerHTML=`<table><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Inscription</th><th>Statut</th></tr></thead><tbody>${list.slice(0,3).map(u => {
      const nom = `${String(u.prenom || '').trim()} ${String(u.nom || '').trim()}`.trim() || 'Utilisateur';
      const initiales = `${(String(u.prenom || '').trim()[0] || String(u.nom || '').trim()[0] || '?')}${String(u.nom || '').trim()[0] || ''}`.toUpperCase();
      const bloque = u.statut_compte === 'bloque';
      const dossier = u.role === 'artisan' ? u.verification_statut : null;
      const statut = bloque ? 'Bloqué'
        : u.role === 'artisan' ? ({en_attente:'Non traité',a_completer:'À compléter',refuse:'Refusé',approuve:'Actif'}[dossier] || 'Non traité')
        : ({actif:'Actif',bloque:'Bloqué'}[u.statut_compte] || String(u.statut_compte || 'Inconnu'));
      const role = {artisan:'Artisan',client:'Client',admin:'Admin'}[u.role] || String(u.role || '—');
      const date = u.created_at ? formatDate(u.created_at) : '—';
      return `<tr><td><span class="overview-person"><span class="overview-avatar" aria-hidden="true">${texte(initiales)}</span>${texte(nom)}</span></td><td>${texte(role)}</td><td>${texte(date)}</td><td><span class="overview-account-status ${bloque?'blocked':''}">${texte(statut)}</span></td></tr>`;
    }).join('')}</tbody></table>`;
  }

  function miniGraphique(points) {
    const cible = $('overview-mini-bars');
    const donnees = points.map(p => (entier(p.artisans) || 0) + (entier(p.clients) || 0));
    const max = Math.max(1, ...donnees);
    cible.innerHTML = donnees.map((n, index) => `<i title="${texte(abrege(points[index].periode,'7j'))} : ${n} inscription${n>1?'s':''}" style="height:${Math.max(0,Math.round(n/max*100))}%;${n===0?'opacity:.25;':''}"></i>`).join('');
    cible.setAttribute('aria-label', `${donnees.reduce((s,v)=>s+v,0)} inscriptions sur les 7 derniers jours`);
  }

  function polyline(points, cle, x, y) {
    return points.map((p,i) => `${x(i).toFixed(2)},${y(p[cle]).toFixed(2)}`).join(' ');
  }

  function afficherGraphique(points, periode) {
    const cible = $('overview-chart');
    if (!Array.isArray(points) || ![7,30,12].includes(points.length)) {
      throw new Error('Série temporelle invalide.');
    }
    const valeurs = points.flatMap(p => [entier(p.artisans),entier(p.clients)]);
    if (valeurs.some(v => v === null)) throw new Error('Le serveur a renvoyé des valeurs invalides.');
    const largeur = 880, hauteur = 245, gauche = 48, droite = 12, haut = 18, bas = 33;
    const w = largeur - gauche - droite, h = hauteur - haut - bas;
    const maximum = Math.max(0,...valeurs);
    const pas = Math.max(1,Math.ceil(maximum / 4));
    const maxY = pas * 4;
    const x = index => gauche + (points.length === 1 ? w/2 : index * w/(points.length-1));
    const y = valeur => haut + h - valeur/maxY*h;
    const segments = [0,1,2,3,4].map(i => `<line class="grid-line" x1="${gauche}" y1="${y(i*pas)}" x2="${largeur-droite}" y2="${y(i*pas)}"/><text class="chart-axis-label" x="${gauche-12}" y="${y(i*pas)+4}" text-anchor="end">${i*pas}</text>`).join('');
    const maxLabels = periode==='30j' ? 6 : 7;
    const etiquettes = points.map((p,i) => ({p,i})).filter(({i}) => i===0 || i===points.length-1 || (i % Math.ceil(points.length/maxLabels)===0));
    const labels = etiquettes.map(({p,i}) => `<text class="chart-axis-label" x="${x(i)}" y="${hauteur-5}" text-anchor="middle">${texte(abrege(p.periode,periode))}</text>`).join('');
    const courbeArtisans = polyline(points,'artisans',x,y);
    const courbeClients = polyline(points,'clients',x,y);
    const aire = `M ${x(0)} ${y(0)} L ${points.map((p,i)=>`${x(i)} ${y(p.artisans)}`).join(' L ')} L ${x(points.length-1)} ${y(0)} Z`;
    const pointsArtisans = points.length <= 12 ? points.map((p,i) => `<circle class="chart-point" cx="${x(i)}" cy="${y(p.artisans)}" r="4"/>`).join('') : '';
    cible.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeur} ${hauteur}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="overview-artisan-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#00ab83" stop-opacity=".18"/><stop offset="1" stop-color="#00ab83" stop-opacity="0"/></linearGradient></defs>
      ${segments}${labels}
      <path d="${aire}" fill="url(#overview-artisan-fill)"/>
      <polyline points="${courbeArtisans}" class="chart-series-artisan"/>
      <polyline points="${courbeClients}" class="chart-series-client"/>
      ${pointsArtisans}
    </svg>`;
    const totalArtisans = points.reduce((total,p)=> total+p.artisans,0);
    const totalClients = points.reduce((total,p)=> total+p.clients,0);
    cible.setAttribute('aria-label', `Inscriptions réelles sur ${points.length} périodes : ${totalArtisans} artisans et ${totalClients} clients`);
    $('overview-chart-status').textContent = maximum === 0 ? 'Aucune nouvelle inscription pendant cette période.' : `${totalArtisans.toLocaleString('fr-FR')} artisan(s) et ${totalClients.toLocaleString('fr-FR')} client(s) sur la période.`;
    $('overview-chart-table').innerHTML = `<table><thead><tr><th>Période</th><th>Artisans</th><th>Clients</th></tr></thead><tbody>${points.map(p=>`<tr><td>${texte(abrege(p.periode,periode))}</td><td>${p.artisans}</td><td>${p.clients}</td></tr>`).join('')}</tbody></table>`;
  }

  async function chargerInscriptions(periode) {
    const generation = ++etat.generation;
    $('overview-chart-status').textContent='';
    $('overview-chart').innerHTML='<p class="overview-loading">Chargement des inscriptions…</p>';
    $('overview-period').disabled = true;
    $('overview-export').disabled = true;
    try {
      const r = await requeteAPI(`/api/admin/stats/inscriptions?periode=${encodeURIComponent(periode)}`);
      if (generation !== etat.generation) return;
      const points = r.points;
      afficherGraphique(points, periode);
      etat.periode = periode;
      etat.points = points;
      if (periode === '7j') {
        if (r.artisansEnAttente !== undefined) etat.artisansEnAttente = entier(r.artisansEnAttente);
        miniGraphique(points);
        afficherPriorites(etat.statistiques);
      }
      $('overview-export').disabled = !etat.statistiques;
    } catch (erreur) {
      if (generation !== etat.generation) return;
      etat.points = null;
      $('overview-chart').innerHTML = `<p class="overview-error">${texte(erreur.message || 'Historique indisponible.')}</p>`;
      $('overview-chart-table').textContent='';
      $('overview-chart-status').textContent='Impossible de charger les inscriptions.';
    } finally {if (generation === etat.generation) $('overview-period').disabled = false;}
  }

  function exporterRapport() {
    if (!etat.statistiques || !etat.points) return;
    const valeurs = [ ['Rapport Taskly — Vue d’ensemble'],['Période',etat.periode],['Date export',new Date().toLocaleString('fr-FR')],[],['Indicateur','Valeur'],
      ...[...champs,...autres].map(([label,cle])=>[label, afficherNombre(etat.statistiques[cle])]),
      ['Artisans à vérifier',afficherNombre(etat.artisansEnAttente)],[],['Période','Artisans inscrits','Clients inscrits'],
      ...etat.points.map(p => [p.periode,p.artisans,p.clients])];
    const csv = '\uFEFF' + valeurs.map(l => l.map(v=>`"${String(v ?? '').replace(/"/g,'""')}"`).join(';')).join('\r\n');
    const fichier = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(fichier);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `taskly-rapport-${etat.periode}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.append(lien);
    lien.click();
    lien.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 1000);
  }

  async function afficherParametresSiAutorises() {
    try {
      const r = await requeteAPI('/api/admin-settings/me');
      $('overview-site-link').hidden = r.compte?.niveau !== 'principal';
    } catch (_) { $('overview-site-link').hidden = true; }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!document.body.classList.contains('admin-overview-page')) return;
    await attendreSession();
    if (window.utilisateurCourant?.role !== 'admin') return;
    const date = new Date();
    $('overview-today').textContent = new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(date);
    $('overview-export').addEventListener('click',exporterRapport);
    $('overview-period').addEventListener('change',e => chargerInscriptions(e.target.value));
    afficherParametresSiAutorises();
    try {
      const data = await requeteAPI('/api/admin/stats');
      etat.statistiques = data.statistiques || {};
      afficherStats(etat.statistiques);
      const indisponibles = new Set(data.modulesIndisponibles || []);
      afficherDerniers(data.derniersUtilisateurs,indisponibles.has('derniersUtilisateurs'));
      afficherPriorites(etat.statistiques);
    } catch (e) {
      afficherStats(null);
      $('admin-latest-users').innerHTML='<p class="overview-error">Impossible de récupérer les derniers utilisateurs.</p>';
      afficherPriorites(null);
    }
    await chargerInscriptions('7j');
  });
})();
