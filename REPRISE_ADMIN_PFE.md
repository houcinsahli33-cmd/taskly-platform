# Taskly — reprise de la refonte de l'administration (10 octobre 2026)

Ce dossier contient le **projet de PFE**, pas une mise en production. L'espace et le formulaire principal de connexion admin ont été conservés.

## Ajouts réalisés dans cette reprise

- `private/admin-dashboard.html` : recherche d'artisans, filtre par état et conteneurs de synthèse.
- `client/public/js/admin-verification.js` : liste lisible et filtrable, compteur de dossiers, examen complet, formulaire explicite de décision, affichage du support et des notifications, historique des décisions.
- `client/public/css/admin-forms.css` : styles responsives du formulaire d'examen et des listes, sans changer la page de connexion.
- `server/routes/adminVerificationRoutes.js` : historique des décisions (`verification_audit`) et identité de l'admin ayant statué, avec `Cache-Control: no-store`. L'API existante reste compatible.
- `tests/admin-review-ui.test.js` : recherche, filtres, protection d'affichage contre l'injection HTML et lecture de l'historique administrateur.

## Fonctions déjà présentes dans l'archive reçue

Validation e-mail par code, artisan non activé bloqué hors de l'espace privé, support authentifié limité et rattaché au compte, examen des justificatifs, activation/refus/complément, notification par e-mail, profils modifiables, suppression par l'utilisateur, nettoyage PFE des comptes ciblés **après prévisualisation**. Leur présence dans les sources ne constitue pas un test d'intégration avec une vraie base.

## Validation effectuée

- `npm run check` : **104 fichiers JS, 0 erreur de syntaxe**.
- `node --test tests/account-access.test.js tests/admin-review-ui.test.js` : **15 tests réussis**.
- `npm test` complet : **non validé ici**, les modules `express`, `multer` et `nodemailer` ne sont pas installés dans l'environnement de vérification. Un `npm ci` a été essayé, mais les dépendances ne sont pas récupérables par cet environnement. Ne pas présenter les 37 tests historiques comme un nouveau succès.
- Aucune écriture sur une base distante, aucun compte supprimé, aucun envoi e-mail réel, aucun déploiement.

## Tester sur votre ordinateur

1. Ouvrir le dossier racine du projet dans VS Code avec Node.js installé.
2. Exécuter `npm ci` (connexion internet nécessaire pour télécharger les modules).
3. Exécuter `npm run check`, puis `npm test`.
4. Configurer le serveur dans un fichier `server/.env` local **non partagé**. Ne publier aucun mot de passe, URL de base ou jeton.
5. Dans une **base de démonstration sauvegardée**, vérifier que les migrations décrites dans `COMPTES_ET_SUPPORT.md` ont été appliquées. Les nouvelles lectures de l'historique utilisent `verification_audit`.
6. Se connecter à l'administration privée, ouvrir **Artisans à vérifier**, rechercher un dossier, le filtrer, cliquer sur **Examiner**, consulter ses pièces et décisions précédentes et tester une décision sur un compte factice.
7. Tester séparément le support public et l'accès limité d'un artisan non validé, puis une connexion autorisée après validation. Tester le changement de profil, les notifications et la suppression **sur des comptes jetables seulement**.

**Important :** les commandes `npm run demo:prepare` et `npm run demo:apply` utilisent la base configurée. `demo:apply` peut supprimer définitivement des comptes. Vérifier la sauvegarde et l'aperçu avant toute utilisation, sans jamais toucher aux administrateurs.

## À vérifier encore

- Les tests fonctionnels complets avec modules installés.
- L'affichage réel sur navigateur desktop et mobile.
- Les migrations, e-mails SMTP, stockage des pièces, sessions et notifications dans une base de démonstration contrôlée.
- Le nettoyage des trois identifiants de comptes de test uniquement après vérification de leurs e-mails et rôles.
