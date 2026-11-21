'use strict';
/* Run from the root of your local Taskly repository AFTER extracting the bundle.
   Idempotent; edits only message page references and existing notification tone.
   Never touches API, credentials, authentication, LiveKit, or Krisp. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = process.cwd();
const packagePath = path.join(root, 'package.json');
if (!fs.existsSync(packagePath)) throw Error('Lance cette commande depuis le dossier Taskly-V8-Git.');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (pkg.name !== 'taskly-platform') throw Error('Ce projet ne semble pas etre Taskly.');

const files = [
  'client/private/client/messagerie.html',
  'client/private/artisan/messagerie.html',
  'client/public/js/taskly-call-notifications.js'
];
for (const file of [...files, 'client/public/js/taskly-call-premium.js', 'client/public/css/taskly-call-premium.css']) {
  if (!fs.existsSync(path.join(root, file))) throw Error('Fichier introuvable: ' + file);
}
const backups = new Map(files.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
function once(source, target, replacement, label) {
  const occurrences = source.split(target).length - 1;
  if (occurrences !== 1) throw Error(label + ': nombre de reperes incorrect (' + occurrences + ')');
  return source.replace(target, replacement);
}
const changes = new Map();
for (const role of ['client', 'artisan']) {
  const file = `client/private/${role}/messagerie.html`;
  const original = backups.get(file);
  if (original.includes('data-taskly-call-premium="1"')) {
    console.log('Deja installe: ' + role);
    continue;
  }
  assert.match(original, /taskly-call-ui\.js/, 'Moteur appel absent pour ' + role);
  assert.match(original, /taskly-call\.css/, 'Feuille de style appel absente pour ' + role);
  const include = '\n<link rel="stylesheet" data-taskly-call-premium="1" href="/css/taskly-call-premium.css?v=1">' +
    '\n<script defer data-taskly-call-premium="1" src="/js/taskly-call-premium.js?v=1"></script>\n';
  changes.set(file, once(original, '</head>', include + '</head>', 'Balise head ' + role));
}
let notifications = backups.get(files[2]);
if (!notifications.includes('TasklyPhoneRing')) {
  const loader = `
// Premium calling UI + phone-style ring: self-hosted, no external service.
(function loadTasklyPremium() {
    if (document.querySelector('script[data-taskly-premium-loader]')) return;
    const script = document.createElement('script');
    script.setAttribute('data-taskly-premium-loader', '1');
    script.src = '/js/taskly-call-premium.js?v=1';
    document.head.appendChild(script);
})();
`;
  notifications = once(notifications, "'use strict';", "'use strict';" + loader, 'Chargement global');
  notifications = once(notifications, 'function stopRing() {', `function stopRing() {
        window.TasklyPhoneRing?.stop('global');`, 'Arret sonnerie globale');
  notifications = once(notifications, 'function ring() {', `function ring() {
        if (window.TasklyPhoneRing) {
            if (!current || suppressed(current) || document.visibilityState !== 'visible') {
                window.TasklyPhoneRing.stop('global');
                return;
            }
            const call = current;
            const playing = window.TasklyPhoneRing.start('global',
                () => current === call && !suppressed(call) && document.visibilityState === 'visible',
                'incoming');
            get('ring').hidden = playing;
            return;
        }`, 'Sonnerie globale');
  notifications = once(notifications, 'async function unlock() {', `async function unlock() {
        if (window.TasklyPhoneRing) {
            if (!closed) {
                await window.TasklyPhoneRing.unlock();
                ring();
            }
            return;
        }`, 'Deblocage audio');
  changes.set(files[2], notifications);
} else console.log('Sonnerie globale deja installee');

// Refuse to overwrite anything unless every check above passed.
for (const [file, content] of changes) {
  const full = path.join(root, file);
  fs.writeFileSync(full, content, 'utf8');
  console.log('Mis a jour: ' + file);
}
console.log('OK: interface Taskly Premium + sonnerie telephonique installees localement.');
console.log('IMPORTANT: aucun commit ni push effectue.');
