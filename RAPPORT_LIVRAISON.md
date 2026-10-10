# Livraison complète — 11 octobre 2026

## Base conservée

Export du commit bf71a9c du dépôt existant taskly-platform-securise, comparé à la version intégrée. Les différences de fins de ligne ont été ignorées lors de cette comparaison. Les corrections récentes de pagination, Examiner, administration, profils et support sont conservées. Les déplacements des pages privées sont volontaires.

## Corrections intégrées

- Structure : client/public/ et client/private/, sans miroirs racine. Toutes les références actives du serveur et des tests sont mises à jour.
- Ressources publiques : middleware borné au dossier public, refus de traversée/dotfiles/HTML privés, fonctionnement dans un dossier caché ; intégration de client/** dans la fonction Vercel. Accueil et ressources disponibles avant initialisation des sessions.
- Installation : anciennes pages privées restées dans client/public/ sauvegardées, anciens dossiers racine sauvegardés et photos historiques préservées. Le serveur refuse de servir les noms des pages privées même si un ancien fichier a été oublié.
- Suppression : dépendances retirées dans l'ordre, contrôle du mot de passe, confirmation et transaction ; administrateurs exclus. Échec => rollback, aucune réponse de succès trompeuse.
- Profils : une panne de la liste des métiers ne fait plus disparaître le formulaire et la suppression. Champs/formulaires internes alignés et formulaires cachés respectés.
- Photos : remplacement/suppression et fichier durable TiDB liés dans une transaction ; ancienne image publique retirée, rollback si modification du profil impossible. Les anciens fichiers disque restent dans les sauvegardes.
- Support : séparation du suivi public ; suppression des gestionnaires en double ; identité limitée révoquée lorsque le compte ou sa version change. Nouvelle connexion/code requis après une décision ou modification sensible.
- Notifications : une panne SQL après une décision validée ne transforme plus cette décision en erreur affichée ; nouvelle tentative possible. SMTP reste extérieur à la transaction.
- Scripts : diagnostic SQL étendu aux dépendances des suppressions et profils ; connexion libérée et pool fermé en cas d'échec de migration/préparation ; message de migration corrigé pour ne pas inviter à modifier le principal existant.
- Démonstration : aperçu sans instantané, ciblage précis des trois identifiants autorisés et protection des admins, restauration des seuls comptes conserver déjà figés. Aucune activation automatique des inscriptions après l'instantané.
- Développement : npm run dev utilise node --watch, sans dépendance nodemon absente.

## Résultats

- npm test : 76 tests, 76 réussis, zéro échec.
- npm run check : 98 fichiers JavaScript, zéro erreur.
- Ressources HTML locales présentes ; pas d'identifiant HTML dupliqué.
- 104 paquets installés vérifiés : toutes les versions correspondent à package-lock.json. Les dépendances existantes ont été copiées pour tester ; l'installation npm ci depuis le registre n'a pas pu être validée, car le cache hors ligne était incomplet.
- Le script d'installation a été essayé sur un projet fictif : anciens dossiers sauvegardés, photo conservée, variables inchangées ; syntaxe PowerShell validée.

Les tests de routes utilisent les objets HTTP Node et Express sans ouvrir de port TCP. Les règles de session, CSRF et autorisation restent exécutées ; TiDB/SMTP sont simulés. Le déploiement Vercel, Redis/Upstash, l'envoi réel d'e-mails, le rendu navigateur et les suppressions sur une base réelle ne sont pas validés par ces tests. La migration comptes/support a été déclarée réussie par l'utilisateur, mais aucun accès direct à cette base n'a été disponible dans cet environnement.

La suppression de données et la préparation des comptes de démonstration ne sont jamais déclenchées par l'installation ou le démarrage du site. Suivre les instructions après sauvegarde et vérification de la sélection.
