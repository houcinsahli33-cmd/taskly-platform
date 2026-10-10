const {test}=require('node:test');const assert=require('node:assert/strict');
const path=require('node:path');
process.env.SESSION_SECRET='test-only-secret-with-more-than-32-characters';
process.env.ADMIN_ENTRY_PATH='/test-administration-012345678901234567890123456789';
process.env.NODE_ENV='test';
const dbPath=require.resolve('../server/config/db');
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{promise:()=>({query:async(sql)=>{
 if(sql.includes('stored_files'))return [[]];return [[]];
}})}};
test('HTTP : CSRF, pages privées, médias et inscription sans pièce',async()=>{
 const app=require('../server/app')(new (require('express-session').MemoryStore)());
 const request=(url,options)=>require('./helpers/request')(app,url,options);
 {
  assert.equal((await request('/')).status,200);
  assert.equal((await request('/admin-dashboard.html')).status,404);
  assert.equal((await request('/private/admin-dashboard.html')).status,404);
  assert.equal((await request('/client/private/admin-dashboard.html')).status,404);
  assert.equal((await request('/api/admin-verification/artisans')).status,401);
  assert.equal((await request(process.env.ADMIN_ENTRY_PATH+'/dashboard')).status,401);
  assert.equal((await request('/api/admin/users')).status,401);
  assert.equal((await request('/api/account')).status,401);
  assert.equal((await request('/api/artisan-support/context')).status,401);
  assert.equal((await request('/artisan-dashboard.html')).status,401);
  assert.equal((await request('/api/media/'+'a'.repeat(64))).status,404);
  assert.equal((await request('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
  const csrf=await request('/api/auth/csrf');const cookie=csrf.headers.get('set-cookie').split(';')[0];const {csrfToken}=await csrf.json();
  process.env.SMTP_HOST='test';process.env.SMTP_USER='test';process.env.SMTP_PASS='test';process.env.MAIL_FROM='test@example.com';
  const result=await request('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrfToken},body:JSON.stringify({role:'artisan',nom:'Test',prenom:'Test',email:'test@gmail.com',motDePasse:'LongPassword1!',telephone:'0551234567',serviceId:1,ville:'Alger',experience:1})});
  assert.equal(result.status,400);assert.match((await result.json()).message,/diplôme|certificat/i);
  assert.equal((await request('/admin-invitation.html')).status,200);
 }
});
test('Nodemailer : composition locale du message sans SMTP',async()=>{
 const transport=require('nodemailer').createTransport({streamTransport:true,buffer:true});
 const mail=await transport.sendMail({from:'taskly@example.com',to:'test@example.com',subject:'Code Taskly',text:'Code de test : 123456'});
 assert.match(mail.message.toString(),/123456/);
});

test('entrée Vercel : accueil et styles disponibles sans démarrage Redis',async()=>{
 const entry=require('../index');const request=require('./helpers/request');
 assert.equal((await request(entry,'/')).status,200);
 const style=await request(entry,'/css/style.css');assert.equal(style.status,200);assert.match(style.headers.get('content-type'),/text\/css/);
 assert.equal((await request(entry,'/.env')).status,404);
});
