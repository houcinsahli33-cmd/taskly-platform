// Règles de date de prestation : dates ISO et journée locale algérienne.
function aujourdHuiAlgerie(maintenant = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone:'Africa/Algiers',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(maintenant);
}
function estDateISOValide(texte) {
  if (typeof texte !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texte)) return false;
  const date = new Date(texte + 'T12:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10)===texte;
}
function verifierDateSouhaitee(valeur, aujourdHui=aujourdHuiAlgerie()) {
  if (valeur===undefined || valeur===null || valeur==='') return {valide:true,date:null}; // Le champ reste facultatif.
  if (!estDateISOValide(valeur)) return {valide:false,raison:'Sélectionnez une date valide dans le calendrier.'};
  if (valeur<aujourdHui) return {valide:false,raison:'Les dates passées ne sont pas autorisées.'};
  return {valide:true,date:valeur};
}
module.exports={aujourdHuiAlgerie,estDateISOValide,verifierDateSouhaitee};
