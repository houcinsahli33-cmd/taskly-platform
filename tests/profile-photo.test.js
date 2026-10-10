const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function service(conn){const module={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../server/services/profilePhoto'),'utf8'),{module,require:n=>n==='../config/db'?{promise:()=>({getConnection:async()=>conn})}:n==='./fileStorage'?{enregistrer:async(file,prive,c)=>{assert.equal(c,conn);assert.equal(prive,false);return 'b'.repeat(64);}}:require(n)});return module.exports;}
for(const upload of [false,true])test('photo : '+(upload?'remplacement':'suppression')+' atomique et ancienne image retirée',async()=>{
 const events=[],conn={beginTransaction:async()=>events.push('begin'),commit:async()=>events.push('commit'),rollback:async()=>events.push('rollback'),release:()=>events.push('release'),query:async(sql,args)=>{events.push(sql);if(sql.startsWith('SELECT'))return [[{id:42,photo_profil:'/api/media/'+'a'.repeat(64)}]];if(sql.startsWith('UPDATE'))assert.equal(args[0],upload?'/api/media/'+'b'.repeat(64):null);return [{affectedRows:1}];}};
 const photo=await service(conn).changer(42,upload?{}:null);assert.equal(photo,upload?'/api/media/'+'b'.repeat(64):null);
 assert.ok(events.some(s=>s.startsWith('DELETE FROM stored_files')));assert.equal(events.includes('rollback'),false);assert.deepEqual(events.slice(-2),['commit','release']);
});
test('photo : échec d’UPDATE annule la transaction sans retirer l’ancienne image',async()=>{
 const events=[],conn={beginTransaction:async()=>{},commit:async()=>events.push('commit'),rollback:async()=>events.push('rollback'),release(){},query:async sql=>{if(sql.startsWith('SELECT'))return [[{id:42,photo_profil:'/api/media/'+'a'.repeat(64)}]];if(sql.startsWith('UPDATE'))throw Error('Panne simulée');events.push('delete');}};
 await assert.rejects(service(conn).changer(42,{}));assert.deepEqual(events,['rollback']);
});
