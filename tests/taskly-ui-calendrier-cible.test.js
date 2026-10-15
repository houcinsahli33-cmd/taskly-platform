'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = f=>fs.readFileSync(path.join(root,f),'utf8');
const dates = require('../server/helpers/requestDate');

test('le calendrier refuse dates passées, impossibles, et accepte la date du jour',()=>{
  assert.deepEqual(dates.verifierDateSouhaitee('2026-05-26','2026-10-15'),{valide:false,raison:'Les dates passées ne sont pas autorisées.'});
  assert.equal(dates.verifierDateSouhaitee('2026-02-30','2026-01-01').valide,false);
  assert.equal(dates.verifierDateSouhaitee('2026-10-15','2026-10-15').valide,true);
  assert.equal(dates.verifierDateSouhaitee('2026-10-16','2026-10-15').valide,true);
  assert.equal(dates.verifierDateSouhaitee('15/10/2026','2026-10-15').valide,false);
  assert.equal(dates.verifierDateSouhaitee(null,'2026-10-15').valide,true);
});

test('la saisie manuelle est impossible dans chaque formulaire actuel de demande',()=>{
  for(const page of ['artisans.html','artisan-profile.html','service.html']){
    const html=read('client/public/'+page);
    assert.match(html,/id="request-date" type="text" readonly inputmode="none"/);
    assert.match(html,/taskly-request-calendar\.js/);
    assert.match(html,/taskly-request-calendar\.css/);
  }
  const js=read('client/public/js/taskly-request-calendar.js');
  assert.match(js,/data-calendar-day/);
  assert.match(js,/booked\.has\(iso\)/);
  assert.match(js,/disabled aria-disabled/);
  assert.match(js,/tasklyRequestDateValide/);
});

test('la date n’est acceptée par le serveur que si elle est valide et non réservée',()=>{
  const controller=read('server/controllers/demandeController.js');
  const model=read('server/models/demandeModel.js');
  assert.match(controller,/verifierDateSouhaitee\(dateSouhaitee\)/);
  assert.match(model,/jourReserveArtisan\(artisanId,dateSouhaitee\)/);
  assert.match(model,/statut IN \('acceptee','attente_confirmation','conteste'\)/);
  assert.match(model,/WHERE artisan_id = \? AND date_souhaitee = \?/);
  const artisanRoutes=read('server/routes/artisanRoutes.js');
  assert.match(artisanRoutes,/dates-indisponibles/);
  assert.match(artisanRoutes,/verifierClient/);
});

test('la nouvelle présentation conserve la modale artisan et ses boutons',()=>{
  const js=read('client/public/js/artisan-dashboard.js');
  assert.match(js,/dialogue\.showModal\(\)/);
  assert.match(js,/class="taskly-detail-grid"/);
  assert.match(js,/data-open-report/);
  assert.match(js,/data-taskly-route/);
  assert.match(js,/Ouvrir l'itinéraire Google Maps/);
  assert.match(js,/message\.scrollHeight > message\.clientHeight/);
  const css=read('client/public/css/taskly-demandes-detail.css');
  assert.match(css,/\.taskly-detail-message\.expanded/);
});

test('le bloc carte conserve l’annuaire et les boutons liste/carte',()=>{
  const html=read('client/public/artisans.html');
  assert.match(html,/id="artisans-grid"/);
  assert.match(html,/data-artisan-view="liste"/);
  assert.match(html,/data-artisan-view="carte"/);
  for(const rayon of ['5','10','25'])assert.match(html,new RegExp('data-map-radius="'+rayon+'"'));
  assert.match(html,/taskly-artisans-map-panel/);
});


test('heure d’Algérie sans décalage vers le jour précédent',()=>{
 const iso=dates.aujourdHuiAlgerie(new Date('2026-10-14T23:30:00Z'));
 assert.equal(iso,'2026-10-15');
});
