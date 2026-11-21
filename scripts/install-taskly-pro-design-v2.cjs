'use strict';
/** Install a visual-only Taskly design overlay. No call/message JS or backend edits. */
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const pkgFile = path.join(root, 'package.json');
if (!fs.existsSync(pkgFile) || JSON.parse(fs.readFileSync(pkgFile, 'utf8')).name !== 'taskly-platform') {
  throw new Error('Lancez depuis le dossier racine de taskly-platform.');
}
const cssFile = path.join(root, 'client/public/css/taskly-pro-design-v2.css');
if (!fs.existsSync(cssFile)) throw new Error('Fichier CSS V2 absent : extrayez d’abord le ZIP.');
const pages = ['client/private/client/messagerie.html', 'client/private/artisan/messagerie.html'];
const original = new Map();
const changes = new Map();
const tag = '<link rel="stylesheet" data-taskly-pro-design="2" href="/css/taskly-pro-design-v2.css?v=2">';
for (const page of pages) {
  const dest = path.join(root, page);
  if (!fs.existsSync(dest)) throw new Error('Page introuvable : ' + page);
  const html = fs.readFileSync(dest, 'utf8');
  original.set(dest, html);
  if (!html.includes('data-workspace-page="messagerie"')) throw new Error('Page inattendue : ' + page);
  if (!html.includes('/js/taskly-call-premium.js')) throw new Error('Le pack Premium V1 doit etre installe : ' + page);
  if (!html.includes('/css/taskly-call-premium.css')) throw new Error('Feuille de style Premium V1 manquante : ' + page);
  if (html.includes('data-taskly-pro-design="2"')) {
    const occ = html.split('data-taskly-pro-design="2"').length - 1;
    if (occ !== 1) throw new Error('Balise V2 dupliquee : ' + page);
    console.log('Deja installe : ' + page);
    continue;
  }
  if (html.split('</head>').length !== 2) throw new Error('Balise head inattendue : ' + page);
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  changes.set(dest, html.replace('</head>', tag + eol + '</head>'));
}
const written = [];
try {
  for (const [dest, html] of changes) {
    fs.writeFileSync(dest, html, 'utf8');
    written.push(dest);
    console.log('Design V2 applique : ' + path.relative(root, dest));
  }
} catch (err) {
  for (const file of written) fs.writeFileSync(file, original.get(file), 'utf8');
  throw err;
}
console.log('OK : seulement deux pages HTML de messagerie referencees.');
console.log('OK : aucun script d’appels, API, CSS global, logo, header ou sidebar modifie.');
console.log('Publication GitHub : non realisee.');
