'use strict';
/* Install only the visual Taskly call-layout V3 assets and references.
 * Requires Premium V1 and Design V2. Does NOT modify any calling/network code. */
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const packageFile = path.join(root, 'package.json');
if (!fs.existsSync(packageFile) || JSON.parse(fs.readFileSync(packageFile, 'utf8')).name !== 'taskly-platform') {
    throw Error('Ouvrez PowerShell dans la racine du projet taskly-platform.');
}
for (const file of [
    'client/public/css/taskly-call-layout-v3.css',
    'client/public/js/taskly-call-layout-v3.js',
    'client/public/css/taskly-pro-design-v2.css',
    'client/public/js/taskly-call-premium.js'
]) {
    if (!fs.existsSync(path.join(root, file))) throw Error('Fichier manquant : ' + file);
}
const pages = [
    'client/private/client/messagerie.html',
    'client/private/artisan/messagerie.html'
];
const additions = [
    '<link rel="stylesheet" data-taskly-call-layout="3" href="/css/taskly-call-layout-v3.css?v=3">',
    '<script defer data-taskly-call-layout="3" src="/js/taskly-call-layout-v3.js?v=3"></script>'
].join('\n');
const changes = [];
for (const file of pages) {
    const full = path.join(root, file);
    const html = fs.readFileSync(full, 'utf8');
    if (!html.includes('data-workspace-page="messagerie"') ||
        !html.includes('data-taskly-pro-design="2"') ||
        !html.includes('taskly-call-premium.js') ||
        !html.includes('taskly-call-ui.js')) {
        throw Error('Structure Taskly inattendue : ' + file);
    }
    const count = html.split('data-taskly-call-layout="3"').length - 1;
    if (count === 2) {
        console.log('Deja installe : ' + file);
        continue;
    }
    if (count !== 0) throw Error('Installation V3 partielle : ' + file);
    if (html.split('</head>').length !== 2) throw Error('Balise </head> ambigue : ' + file);
    const eol = html.includes('\r\n') ? '\r\n' : '\n';
    changes.push([full, html, html.replace('</head>', additions.replace(/\n/g, eol) + eol + '</head>')]);
}
const written = [];
try {
    for (const [full, before, after] of changes) {
        fs.writeFileSync(full, after, 'utf8');
        written.push([full, before]);
        console.log('V3 installe : ' + path.relative(root, full));
    }
} catch (error) {
    for (const [full, before] of written) fs.writeFileSync(full, before, 'utf8');
    throw error;
}
console.log('OK : appels integres a la conversation sur ordinateur, dialog compact sur mobile.');
console.log('Aucun changement API, LiveKit, Krisp, sonnerie, header, sidebar ou session.');
console.log('Aucune publication GitHub effectuee.');
