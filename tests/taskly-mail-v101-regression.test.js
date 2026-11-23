'use strict';
const t=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync(require('node:path').join(__dirname,'../server/services/professionalMailInternal.js'),'utf8');
t('V10.1: conversations Support réutilisées, changement d’état SQL sans changement client',()=>{
 a.match(src,/SELECT id FROM taskly_mail_service_threads WHERE service_name='support'/);
 a.match(src,/UPDATE taskly_mail_service_threads SET updated_at=NOW\(\)/);
 a.match(src,/const result = await transaction/);
});
