# Profils, activation et support — changements après dbc11d8

Les modifications sont dans le dossier VS Code, sans commit automatique ni modification de la base distante.

## Mise à jour de la base
Sauvegarder la base avant toute migration ou suppression. Depuis le terminal du projet, avec server/.env pointant vers la même base TiDB que Vercel : `npm run db:migrate:accounts`. Conserver les variables DB et SMTP existantes. Le script exécute chaque instruction sur une seule connexion et peut être relancé.

La base doit déjà avoir la migration intégrée précédente, notamment users.email_verified, users.admin_session_version et les tables de rôles, justificatifs et historique. La nouvelle migration ajoute les liens support/compte, account_email_changes et account_notifications. Aucun compte n’est automatiquement approuvé par la migration. Alternative : sélectionner la bonne base dans TiDB et exécuter toutes les instructions de database/migration_comptes_support.sql ; l’éditeur peut exécuter seulement la requête courante, vérifier chaque résultat.

## Démonstration PFE et comptes existants
Avant de déployer cette nouvelle version et pendant une pause des inscriptions, exécuter `npm run demo:prepare`. Cela crée un instantané des IDs/e-mails des comptes existants : les artisans actuellement actifs à conserver et les clients/artisans dont la partie avant @ est exactement houcinsahli33, sahliredha03 ou houcinshl03 à supprimer. Les comptes administrateurs sont toujours exclus, même avec ces adresses.

Lire l’aperçu avant suppression. Après sauvegarde et vérification, `npm run demo:apply` applique cet instantané une seule fois. Il approuve uniquement les artisans actifs présents dans l’instantané, sans supprimer les utilisateurs apparus ensuite. Les comptes en statut bloqué restent bloqués. Il ne marque aucun e-mail non confirmé comme confirmé : un artisan non confirmé doit toujours valider son code pour accéder au compte et apparaître publiquement. Les confirmations existantes sont conservées. La suppression des comptes ciblés est définitive et cascade sur leurs demandes/avis/signalements ; les justificatifs privés et demandes liées au support sont supprimés. L’instantané ne contient aucun compte admin.

Les scripts n’ont pas été exécutés sur votre TiDB dans cette tâche. Fournir leurs résultats permet de vérifier les candidats sans divulguer les mots de passe ou les variables privées.

## Comportement
Client : confirmation e-mail puis accès sans validation administrative.
Artisan : confirmation e-mail puis accès professionnel seulement si statut actif ET dossier approuve. Les sessions déjà ouvertes sont également revérifiées. Un compte en attente, à compléter ou bloqué obtient après mot de passe et code e-mail un accès limité de 30 minutes à artisan-pending.html ; cet accès permet seulement les messages support liés au compte, le dépôt d’un justificatif et la suppression de son propre compte après mot de passe/confirmation. Il ne crée pas de session utilisateur complète et ne permet pas d’appeler les API privées.

Les formulaires publics de contact restent séparés. Le suivi public ne lit pas les demandes liées aux comptes. Le dossier administratif affiche les pièces, informations, demandes au support et état des notifications. Activer ouvre l’accès ; bloquer exige un motif d’au moins cinq caractères. Demander un complément garde l’accès professionnel fermé.

La décision et sa notification sont enregistrées dans la même transaction. L’e-mail est envoyé ensuite. En cas d’échec SMTP, la décision est conservée, l’état failed est affiché et l’admin peut utiliser Réessayer. Un message envoyé ne peut pas être renvoyé par ce bouton. Une interruption de fonction laisse un envoi récupérable après cinq minutes ; une panne entre envoi SMTP et confirmation SQL peut exceptionnellement provoquer un doublon lors d’une reprise. La notification n’est jamais nécessaire pour se connecter après activation : mot de passe et code suffisent. Aucun délai obligatoire n’est appliqué.

Profils : nom, prénom, téléphone, commune et adresse client / service, expérience et description artisan sont modifiables ; photo via le formulaire existant avec stockage durable. Le changement de métier artisan impose un nouvel examen et ferme la session. Nouvelle adresse Gmail confirmée par code (10 minutes, trois tentatives, attente d’une minute entre demandes), mot de passe actuel requis. Changer e-mail/mot de passe invalide les sessions du compte. Aucun client/artisan ne peut modifier son rôle ou sa validation via son profil.

Suppression : mot de passe actuel, saisie SUPPRIMER et confirmation dans l’interface ; administrateurs exclus. Le serveur détruit le compte et les données liées en transaction puis ferme la session. Les photos/documents anciens stockés sur disque ne sont pas effacés automatiquement ; nettoyer leurs sauvegardes manuellement si nécessaire.

## Formulaires administrateur
Styles réservés aux formulaires internes : Mon compte, invitations, services, blocage et examen. Le dossier met les justificatifs et le support à gauche, la décision et les notifications à droite, puis empile les colonnes sur mobile. La navigation et la page de connexion admin restent conservées.

## Recette
Exécuter npm test et npm run check. Tests locaux : autorisation des artisans selon leur statut, code e-mail sans session complète pour les comptes non validés, exclusion des admins lors de suppression, fichiers privés, contrôle CSRF et routes HTTP. Base simulée ; SMTP, TiDB, Upstash et déploiement Vercel ne sont pas validés par ces tests.

Avant démonstration : vérifier migration complète, instantané de démo, inscription client, inscription artisan avec pièce, tentative de connexion en attente, support lié et support visiteur distincts, complément, activation/blocage avec motif et e-mail, accès après activation, modification profil/photo, changement d’e-mail et de mot de passe, suppression sur un compte jetable, et refus des API privées avec un accès support. Pour tester l’échec e-mail, utiliser des identifiants SMTP invalides uniquement en préproduction ; vérifier décision conservée et Réessayer après restauration SMTP.
