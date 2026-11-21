'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const pages = ['client/private/client/messagerie.html','client/private/artisan/messagerie.html'];
for (const name of pages) {
  const p = path.join(root,name);
  const html = fs.readFileSync(p,'utf8');
  const updated = html.replace(/^[ \t]*<link rel="stylesheet" data-taskly-pro-design="2" href="\/css\/taskly-pro-design-v2\.css\?v=2">\r?\n?/m,'');
  if (updated !== html) {
    fs.writeFileSync(p,updated,'utf8');
    console.log('V2 retiree de : '+name);
  }
}
console.log('Le CSS V1 et les fonctions existantes sont inchanges.');
