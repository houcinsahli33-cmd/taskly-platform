// Règles pures et testables du nettoyage académique Taskly.
// Un compte administrateur n'est jamais candidat, même si son email correspond.
const MOTIFS = ['sahli', 'shl'];
function correspond(email) {
  return typeof email === 'string' && MOTIFS.some(mot => email.toLowerCase().includes(mot));
}
function candidat(user) {
  return Boolean(user && ['client','artisan'].includes(user.role) && correspond(user.email));
}
module.exports = { MOTIFS, correspond, candidat };
