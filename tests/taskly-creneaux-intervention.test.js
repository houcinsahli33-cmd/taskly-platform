'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normaliserCreneau,verifierFutur,intervalle,conflit,accepter,occupations}=require('../server/helpers/creneauxIntervention');
const slot=(heureDebut,dureeMinutes=30)=>({heureDebut,dureeMinutes});
const code=(c)=>e=>e.code===c;
const jour='2099-11-28';
test('créneau de 30 minutes + marge de déplacement de 30 minutes',()=>{
 assert.deepEqual(normaliserCreneau(slot('10:00')),{debut:600,fin:630,blocage:660});
 assert.equal(normaliserCreneau(undefined),null);
});
test('horaires et durées invalides refusés, y compris passage de minuit',()=>{
 for(const x of [null,{},slot('25:00'),slot('10:01'),slot('10:00',0),slot('10:00','30'),slot('10:00',721),slot('23:30',30)])
  assert.throws(()=>normaliserCreneau(x),code('TASKLY_CRENEAU_INVALIDE'));
});
test('futur contrôlé en heure algérienne',()=>{
 const now=new Date('2026-11-20T17:00:00Z');
 assert.throws(()=>verifierFutur('2026-11-20',1080,now),code('TASKLY_CRENEAU_INVALIDE'));
 assert.throws(()=>verifierFutur('2026-11-19',1200,now),code('TASKLY_CRENEAU_INVALIDE'));
 assert.throws(()=>verifierFutur('2026-02-30',1200,now),code('TASKLY_CRENEAU_INVALIDE'));
 assert.doesNotThrow(()=>verifierFutur('2026-11-20',1095,now));
});
test('chevauchement, marge et frontière sans conflit',()=>{
 const a=normaliserCreneau(slot('10:00'));assert.equal(conflit(a,normaliserCreneau(slot('10:15'))),true);
 assert.equal(conflit(a,normaliserCreneau(slot('10:45'))),true);
 assert.equal(conflit(a,normaliserCreneau(slot('11:00'))),false);
 assert.equal(conflit(a,normaliserCreneau(slot('09:30'))),true);
 assert.equal(conflit(a,null),true);
 assert.equal(intervalle({creneau_debut_minute:600,creneau_fin_minute:null,creneau_blocage_minute:660}),null);
});
function fake(records){
 let tail=Promise.resolve();const queries=[];
 const pool={getConnection:async()=>{
  let unlock,change;
  const free=()=>{if(unlock){unlock();unlock=null;}};
  return {beginTransaction:async()=>{},commit:async()=>{if(change)Object.assign(change.record,change.values);free();},rollback:async()=>{change=null;free();},release:free,
   query:async(sql,p=[])=>{
    queries.push(sql);
    if(sql.startsWith('SELECT VERSION'))return [[{version:'TiDB'}]];
    if(sql==='BEGIN PESSIMISTIC')return [[]];
    if(sql.includes('SELECT id FROM artisans')){const prev=tail;tail=new Promise(r=>unlock=r);await prev;return [[{id:p[0]}]];}
    if(sql.includes('DATE_FORMAT'))return [records.filter(r=>r.id===p[0]&&r.artisan_id===p[1]&&r.statut==='en_attente')];
    if(sql.includes('SELECT creneau_debut_minute'))return [records.filter(r=>r.artisan_id===p[0]&&r.jour===p[1]&&r.id!==p[2]&&(r.statut==='acceptee'||(['attente_confirmation','conteste'].includes(r.statut)&&[r.creneau_debut_minute,r.creneau_fin_minute,r.creneau_blocage_minute].some(v=>v==null))))];
    if(sql.startsWith('UPDATE demandes')){const record=records.find(r=>r.id===p[3]&&r.artisan_id===p[4]&&r.statut==='en_attente');if(!record)return [{affectedRows:0}];change={record,values:{statut:'acceptee',creneau_debut_minute:p[0],creneau_fin_minute:p[1],creneau_blocage_minute:p[2]}};return [{affectedRows:1}];}
    throw Error('SQL inattendu '+sql);
   }};
 }};return {pool,queries};}
const pending=(id,artisan_id=7)=>({id,artisan_id,jour,statut:'en_attente',creneau_debut_minute:null,creneau_fin_minute:null,creneau_blocage_minute:null});
const reserved=(id,statut='acceptee')=>({...pending(id),statut,creneau_debut_minute:600,creneau_fin_minute:630,creneau_blocage_minute:660});
test('deux acceptations simultanées en conflit : une seule réussit (verrou simulé)',async()=>{
 const rows=[pending(1),pending(2)];const {pool,queries}=fake(rows);
 const res=await Promise.allSettled([accepter(pool,1,7,slot('10:00')),accepter(pool,2,7,slot('10:30'))]);
 assert.equal(res.filter(x=>x.status==='fulfilled').length,1);assert.equal(res.find(x=>x.status==='rejected').reason.code,'TASKLY_CRENEAU_OCCUPE');
 assert.equal(rows.filter(r=>r.statut==='acceptee').length,1);assert.ok(queries.includes('BEGIN PESSIMISTIC'));assert.ok(queries.some(q=>q.includes('FROM artisans')&&q.includes('FOR UPDATE')));
});
test('deux interventions compatibles le même jour',async()=>{
 const rows=[reserved(1),pending(2)];const {pool}=fake(rows);await accepter(pool,2,7,slot('11:00'));assert.equal(rows[1].statut,'acceptee');
});
test('ancienne réservation sans horaire : blocage conservateur de la journée',async()=>{
 const rows=[{...pending(1),statut:'acceptee'},pending(2)];const {pool}=fake(rows);await assert.rejects(accepter(pool,2,7,slot('11:00')),code('TASKLY_CRENEAU_OCCUPE'));assert.equal(rows[1].statut,'en_attente');
});
test('acceptation sans horaire ne contourne pas les créneaux déjà réservés',async()=>{
 const rows=[reserved(1),pending(2)];const {pool}=fake(rows);await assert.rejects(accepter(pool,2,7,undefined),code('TASKLY_CRENEAU_OCCUPE'));
});
test('prestation déclarée terminée : créneau libéré sans clore la demande',async()=>{
 const rows=[reserved(1,'attente_confirmation'),pending(2)];const {pool}=fake(rows);await accepter(pool,2,7,slot('10:00'));assert.equal(rows[0].statut,'attente_confirmation');assert.equal(rows[1].statut,'acceptee');
});
test('une demande d’un autre artisan ne peut pas être acceptée',async()=>{
 const rows=[pending(1,8)];const {pool}=fake(rows);assert.equal((await accepter(pool,1,7,slot('10:00'))).affectedRows,0);assert.equal(rows[0].statut,'en_attente');
});
