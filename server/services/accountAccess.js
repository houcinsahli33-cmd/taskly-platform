function autoriserEspace(user,artisan) {
 return Boolean(user && user.email_verified && user.statut_compte==='actif' &&
   (user.role!=='artisan' || artisan?.verification_statut==='approuve'));
}
function messageDossier(artisan,user) {
 if(user?.statut_compte==='bloque' || artisan?.verification_statut==='refuse')return 'Votre compte artisan est bloqué. Vous pouvez contacter le support.';
 if(artisan?.verification_statut==='a_completer')return 'Votre dossier nécessite un complément. Contactez le support ou joignez un nouveau justificatif.';
 return 'Votre compte artisan est en attente de validation administrative. Vous pouvez contacter le support.';
}
module.exports={autoriserEspace,messageDossier};
