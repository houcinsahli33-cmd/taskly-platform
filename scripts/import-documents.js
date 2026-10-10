require('dotenv').config({path:require('path').join(__dirname,'../server/.env')});
const pool=require('../server/config/db'),fs=require('fs/promises'),path=require('path');
(async()=>{try{const db=pool.promise();const [docs]=await db.query('SELECT stored_name,media_type FROM artisan_documents');let count=0;
for(const doc of docs){if(!/^[a-f0-9]{64}$/.test(doc.stored_name))throw Error('Identifiant de document invalide.');
const [existing]=await db.query('SELECT id FROM stored_files WHERE id=?',[doc.stored_name]);if(existing.length)continue;
const buffer=await fs.readFile(path.join(__dirname,'../server/private_uploads',doc.stored_name));
if(buffer.length>3*1024*1024 || !require('../middleware/documentUpload').formatValide(buffer,doc.media_type))throw Error('Document ancien invalide ou supérieur à 3 Mo : import interrompu.');
await db.query('INSERT INTO stored_files(id,media_type,prive,contenu) VALUES (?,?,1,?)',[doc.stored_name,doc.media_type,buffer]);count++;}
console.log(count+' document(s) importé(s). Aucun fichier local supprimé.');}finally{await pool.promise().end();}})().catch(e=>{console.error('Import interrompu :',e.code||e.message);process.exitCode=1;});
