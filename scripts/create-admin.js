// Script local réservé à une personne ayant accès au terminal et à MySQL.
// Usage : npm run admin:create -- admin@example.com
require('dotenv').config({path:require('path').join(__dirname,'../server/.env')});
const crypto=require('crypto');const bcrypt=require('bcrypt');
const pool=require('../server/config/db');
(async()=>{
 const email=String(process.argv[2]||'').trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Fournir une adresse email administrateur valide.');
 const db=pool.promise();
 const [existants]=await db.query('SELECT id FROM users WHERE email=?',[email]);
 if(existants.length)throw new Error('Cet email est deja utilise. Aucun compte cree.');
 const password=crypto.randomBytes(24).toString('base64url');
 const hash=await bcrypt.hash(password,12);
 await db.query("INSERT INTO users(nom,prenom,email,mot_de_passe,role,email_verified) VALUES ('Administration','Principale',?,?,'admin',1)",[email,hash]);
 console.log('\nCompte administrateur cree. Conservez ce mot de passe dans un gestionnaire :');
 console.log(password);
 console.log('Le mot de passe ci-dessus est affiche UNE seule fois. L acces admin requiert aussi un code recu par email.\n');
 process.exit(0);
})().catch(e=>{console.error(e.message);process.exit(1);});
