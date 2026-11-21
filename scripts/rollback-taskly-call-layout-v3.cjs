'use strict';
const fs = require('node:fs');
const path = require('node:path');
for (const role of ['client','artisan']) {
    const file = path.join(process.cwd(), 'client', 'private', role, 'messagerie.html');
    const src = fs.readFileSync(file, 'utf8');
    const updated = src.replace(/^.*data-taskly-call-layout="3".*(?:\r?\n)?/gm, '');
    if (src === updated) console.log('V3 deja retire : ' + role);
    else {
        fs.writeFileSync(file, updated, 'utf8');
        console.log('V3 retire : ' + role);
    }
}
console.log('Les fichiers V3 restent sur disque mais ne sont plus charges.');
