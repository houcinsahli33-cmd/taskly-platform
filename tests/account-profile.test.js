const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),express=require('express');
function routerFor(conn,role='client',deletion=null){
 const module={exports:{}};const mock={'../config/db':{promise:()=>({...conn,getConnection:async()=>conn})},'../middleware/authMiddleware':{verifierConnexion:(req,res,next)=>next()},'../middleware/securityMiddleware':{limiter:()=>((req,res,next)=>next())},bcrypt:{compare:async p=>p==='correct',hash:async()=> 'new-hash'},'../services/accountDeletion':deletion||{supprimer:async()=>{throw Error('Deletion should not be called in these tests');}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../server/routes/accountRoutes.js'),'utf8'),{module,exports:module.exports,require:n=>n in mock?mock[n]:require(n),Buffer,Date,console,process});return module.exports;
}
async function send(router,url,body,role='client',method='PUT'){
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.session={utilisateur:{id:99,role},save:cb=>cb(),destroy:cb=>cb&&cb()};next();});app.use(router);
 const response=await require('./helpers/request')(app,url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};
}
function fake(query){return {query,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){}};}
test('profil client : ID et rôle du corps ignorés',async()=>{const calls=[],conn=fake(async(sql,args)=>{calls.push([sql,args]);return [[]];});const rep=await send(routerFor(conn),'/',{id:1,role:'admin',nom:'Test',prenom:'Client',telephone:'0551234567',ville:'Alger',adresse:'Rue de test'});assert.equal(rep.status,200);const update=calls.find(([s])=>s.startsWith('UPDATE users'));assert.deepEqual([...update[1]],['Test','Client',99]);assert.equal(calls.some(([s])=>s.includes('SET role')),false);});
test('changement de métier : dossier remis en attente et session fermée',async()=>{const calls=[],conn=fake(async(sql,args)=>{calls.push([sql,args]);if(sql.includes('SELECT id FROM services'))return [[{id:2}]];if(sql.includes('SELECT service_id'))return [[{service_id:1}]];return [[]];});const rep=await send(routerFor(conn),'/',{nom:'Test',prenom:'Artisan',telephone:'0551234567',ville:'Alger',serviceId:2,experience:3,description:'Profession et expérience'},'artisan');assert.equal(rep.status,200);assert.equal(rep.data.deconnexion,true);assert.ok(calls.some(([s])=>s.includes("verification_statut='en_attente'")));assert.ok(calls.some(([s])=>s.includes('admin_session_version=admin_session_version+1')));});
test('profil admin exclu des routes utilisateur',async()=>{let queries=0;const rep=await send(routerFor(fake(async()=>{queries++;return [[]];})),'/',{},'admin');assert.equal(rep.status,403);assert.equal(queries,0);});
test('modification de mot de passe : ancien mot de passe requis',async()=>{let updates=0;const conn=fake(async sql=>{if(sql.startsWith('SELECT'))return [[{id:99,mot_de_passe:'hash',role:'client'}]];updates++;return [{affectedRows:1}];});const rep=await send(routerFor(conn),'/password',{motDePasse:'wrong',nouveauMotDePasse:'NewPassword1!'});assert.equal(rep.status,403);assert.equal(updates,0);});
test('adresse e-mail : code épuisé ne change pas le compte',async()=>{let updates=0;const conn=fake(async sql=>{if(sql.startsWith('SELECT'))return [[{user_id:99,attempts:3}]];updates++;return [{}];});const rep=await send(routerFor(conn),'/email/verify',{code:'123456'},'client','POST');assert.equal(rep.status,400);assert.equal(updates,0);});

test('suppression HTTP : session propre utilisée, transaction validée après suppression',async()=>{
 const events=[],conn=fake(async()=>[[]]);conn.beginTransaction=async()=>events.push('begin');conn.commit=async()=>events.push('commit');
 const deletion={supprimer:async(c,id,password)=>{assert.equal(c,conn);assert.equal(id,99);assert.equal(password,'correct');events.push('delete');}};
 const rep=await send(routerFor(conn,'client',deletion),'/',{id:1,confirmation:'SUPPRIMER',motDePasse:'correct'},'client','DELETE');
 assert.equal(rep.status,200);assert.deepEqual(events,['begin','delete','commit']);
});
test('suppression HTTP : aucune validation de transaction si la suppression échoue',async()=>{
 const events=[],conn=fake(async()=>[[]]);conn.commit=async()=>events.push('commit');conn.rollback=async()=>events.push('rollback');
 const deletion={supprimer:async()=>{throw Object.assign(Error('Mot de passe actuel incorrect.'),{status:403});}};
 const rep=await send(routerFor(conn,'client',deletion),'/',{confirmation:'SUPPRIMER',motDePasse:'wrong'},'client','DELETE');
 assert.equal(rep.status,403);assert.deepEqual(events,['rollback']);
});

test('mot de passe commun : met à jour tous les espaces et exclut les administrateurs',async()=>{
 const calls=[],conn=fake(async(sql,args)=>{calls.push([sql,args]);if(sql.startsWith('SELECT'))return [[{id:99,email:'test@gmail.com',mot_de_passe:'hash',role:'client'}]];return [{affectedRows:3}];});
 const rep=await send(routerFor(conn),'/password',{motDePasse:'correct',nouveauMotDePasse:'NewPassword1!'});
 assert.equal(rep.status,200);assert.equal(rep.data.deconnexion,true);const [sql,args]=calls.find(([s])=>s.startsWith('UPDATE users'));assert.match(sql,/WHERE email=\?/);assert.match(sql,/role IN \('client','artisan'\)/);assert.deepEqual([...args],['new-hash','test@gmail.com','hash']);
});
test('changement de métier refuse le métier déjà utilisé par le second artisan',async()=>{
 const calls=[],conn=fake(async(sql,args)=>{calls.push([sql,args]);if(sql.includes('SELECT id FROM services'))return [[{id:2}]];if(sql.includes('SELECT a.id FROM artisans'))return [[{id:7}]];return [[]];});
 const rep=await send(routerFor(conn),'/',{nom:'Test',prenom:'Artisan',telephone:'0551234567',ville:'Alger',serviceId:2,experience:3,description:'Profession et expérience'},'artisan');assert.equal(rep.status,409);assert.equal(calls.some(([s])=>s.startsWith('UPDATE')),false);
});
test('adresse commune : aucun rattachement à une adresse déjà utilisée',async()=>{
 const crypto=require('node:crypto'),previous=process.env.SESSION_SECRET;process.env.SESSION_SECRET='test-secret-only';const calls=[];
 try{
  const row={user_id:99,nouveau_email:'other@gmail.com',attempts:0,code_hash:crypto.createHmac('sha256',process.env.SESSION_SECRET).update('profile-email:99:other@gmail.com:123456').digest('hex')};
  const conn=fake(async(sql,args)=>{calls.push([sql,args]);if(sql.includes('SELECT * FROM account_email_changes'))return [[row]];if(sql.startsWith('SELECT email FROM users'))return [[{email:'test@gmail.com'}]];if(sql.includes('SELECT id FROM users'))return [[{id:4}]];return [{affectedRows:3}];});
  const rep=await send(routerFor(conn),'/email/verify',{code:'123456'},'client','POST');assert.equal(rep.status,409);assert.equal(calls.some(([s])=>s.startsWith('UPDATE users')),false);
 }finally{if(previous===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=previous;}
});
test('adresse confirmée : tous les espaces du propriétaire changent ensemble',async()=>{
 const crypto=require('node:crypto'),previous=process.env.SESSION_SECRET;process.env.SESSION_SECRET='test-secret-only';const calls=[];
 try{
  const row={user_id:99,nouveau_email:'new@gmail.com',attempts:0,code_hash:crypto.createHmac('sha256',process.env.SESSION_SECRET).update('profile-email:99:new@gmail.com:123456').digest('hex')};
  const conn=fake(async(sql,args)=>{calls.push([sql,args]);if(sql.includes('SELECT * FROM account_email_changes'))return [[row]];if(sql.startsWith('SELECT email FROM users'))return [[{email:'test@gmail.com'}]];if(sql.includes('SELECT id FROM users'))return [[]];return [{affectedRows:3}];});
  const rep=await send(routerFor(conn),'/email/verify',{code:'123456'},'client','POST');assert.equal(rep.status,200);const [sql,args]=calls.find(([s])=>s.startsWith('UPDATE users'));assert.match(sql,/WHERE email=\?/);assert.deepEqual([...args],['new@gmail.com','test@gmail.com']);
 }finally{if(previous===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=previous;}
});
