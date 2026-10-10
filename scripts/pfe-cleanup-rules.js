// Ciblage exact autorisé ; aucun administrateur ne peut être sélectionné.
const MOTIFS=['houcinsahli33','sahliredha03','houcinshl03'];
function correspond(email){return typeof email==='string' && MOTIFS.includes(email.trim().toLowerCase().split('@')[0]);}
function candidat(user){return Boolean(user && ['client','artisan'].includes(user.role) && correspond(user.email));}
module.exports={MOTIFS,correspond,candidat};
