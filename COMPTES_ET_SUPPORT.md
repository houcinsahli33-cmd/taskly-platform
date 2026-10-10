# Profils, activation et support — changements après dbc11d8

Les modifications sont dans le dossier VS Code, sans commit automatique ni modification de la base distante.

## Mise à jour de la base
Sauvegarder la base avant toute migration ou suppression. Depuis le terminal du projet, avec server/.env pointant vers la même base TiDB que Vercel : `npm run db:migrate:accounts`. Conserver les variables DB et SMTP existantes. Le script exécute chaque instruction sur une seule connexion et peut être relancé.

La base doit déjà avoir la migration intégrée précédente, notamment users.email_verified, users.admin_session_version et les tables de rôles, justificatifs et historique. La nouvelle migration ajoute les liens support/compte, account_email_changes et account_notifications. Aucun compte n’est automatiquement approuvé par la migration. Alternative : sélectionner la bonne base dans TiDB et exécuter toutes les instructions de database/migration_comptes_support.sql ; l’éditeur peut exécuter seulement la requête courante, vérifier chaque résultat.

## Démonstration PFE et nettoyage contrôlé des comptes

**Aucune suppression automatique.** La règle demandée concerne uniquement les comptes de rôle `client` ou `artisan` dont l'adresse e-mail contient `sahli` ou `shl`, **en tout endroit et sans distinction de casse**. Les comptes de rôle `admin` sont systématiquement exclus, même s'ils correspondent.

1. `npm run demo:preview` : lecture seule de la base ; affiche les comptes candidats et les administrateurs protégés. Aucun fichier d'instantané, aucune suppression.
2. Après identification des comptes et sauvegarde complète de la base, `npm run demo:prepare` : crée une liste figée dans `.taskly-private/nettoyage-pfe.json` (ignorée par Git) et affiche son empreinte. Vérifier le tableau des candidats ; la liste expire après 24 h.
3. **Uniquement après validation humaine de la liste**, `npm run demo:apply -- --confirm=<empreinte exacte>` applique la suppression sur les seuls IDs/e-mails/rôles figés, avec contrôle de chaque compte sous transaction. Un changement intervenu depuis l'aperçu annule toute l'opération. Les comptes créés après l'instantané sont exclus.

L'opération est irréversible : demandes, avis, signalements, pièces privées et messages liés peuvent être supprimés en cascade. Les administrateurs existants ne sont pas supprimés. Aucun artisan n'est approuvé automatiquement pendant ce nettoyage. **Ne pas appliquer sur une base distante sans sauvegarde vérifiée et contrôle des candidats**.

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
