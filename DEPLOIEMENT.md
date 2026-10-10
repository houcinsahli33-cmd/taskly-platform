# Taskly — migration et déploiement

Cette version part de l’archive fournie. Le serveur sert uniquement les fichiers statiques depuis `client/public`. Les pages HTML d’administration sont dans `private/`, servies exclusivement par les routes sécurisées. Le dossier `public/` sert de miroir des ressources pour compatibilité de déploiement. Le logo, les images et les couleurs Taskly sont conservés. Ne pas fusionner des modifications de production sans comparer le manifeste CHANGEMENTS.json.

## 1. Sauvegarde et préproduction
Sauvegarder la base complète, les variables privées Vercel et les dossiers historiques server/private_uploads et client/public/uploads. Tester la restauration. Copier la base dans une préproduction et utiliser des identifiants distincts. Les migrations DDL ne sont pas atomiques ; une interruption peut être reprise, mais un retour arrière exige la sauvegarde.

Installer Node.js 22 ou supérieur, puis `npm ci`. Conserver package-lock.json. Nodemailer passe à 10.1.0 après audit : composition locale testée, envoi SMTP réel à valider.

## 2. Migration
Sur une base existante contenant les tables de database/taskly_db.sql, exécuter `npm run db:migrate`. Alternative : sélectionner explicitement la base cible dans le client SQL puis exécuter database/migration_taskly_integrated.sql. Cette migration vérifie les colonnes via information_schema et crée les tables manquantes. Elle ne contient ni USE imposé, ni DROP, ni réinitialisation des statuts existants. Ne pas réexécuter migration_securite_2027.sql : ancienne migration non idempotente.

Si email_verified était absent, les comptes existants devront confirmer leur adresse par le parcours de connexion. Les artisans sans ancien statut de validation passent en attente ; aucun dossier n’est approuvé automatiquement. Les statuts déjà présents sont conservés.

L’erreur « Impossible de vérifier les autorisations » était cohérente avec l’absence de admin_roles et des tables complémentaires. Les autorisations restent fermées tant que la migration n’est pas appliquée.

Après migration, choisir explicitement un compte admin actif existant : `npm run admin:principal -- adresse-du-compte`. Le script refuse de remplacer un autre principal. Pour une installation neuve, `npm run admin:create -- adresse-du-compte` crée le principal et affiche son mot de passe une seule fois. Exécuter ces commandes depuis un terminal sûr, un seul opérateur à la fois. Aucun rôle principal n’est déduit du premier utilisateur de la base. Inviter les secondaires depuis l’administration.

## 3. Stockage durable
Les nouveaux documents et photos sont des BLOB dans la table TiDB/MySQL stored_files : aucune écriture dans le disque Vercel et aucun nouveau prestataire requis. Limite applicative : 3 Mio par fichier, JPEG/PNG et PDF pour les pièces, JPEG/PNG pour les photos. Vérification de signature et MIME, identifiants aléatoires, noms d’origine jamais utilisés comme chemins. Les documents ne sont accessibles que par une route admin contrôlée et téléchargés en pièce jointe avec no-store ; la route publique filtre prive=0.

Vérifier les quotas de stockage TiDB, les limites de taille des lignes/transactions, max_allowed_packet et les sauvegardes incluant les BLOB. La limite de requête/réponse Vercel est 4,5 MB : https://vercel.com/docs/functions/limitations. Référence TiDB : https://docs.pingcap.com/tidb/stable/tidb-limitations/. Faire un dépôt puis un téléchargement de 3 Mio en préproduction. Les fichiers sont durables mais leur coût augmente la taille de la base ; un stockage objet privé pourra être envisagé si le volume l’exige.

Pour les anciens justificatifs sur disque : remettre le dossier sauvegardé dans server/private_uploads sur la machine de migration puis `npm run documents:import`. Script réexécutable, aucun fichier supprimé. Les anciens documents de plus de 3 Mio doivent être redéposés dans un format réduit ; l’import s’arrête et reste reprenable. Les anciennes photos statiques restent compatibles : les conserver dans client/public/uploads ou les redéposer via le profil. Ne pas inclure les pièces privées dans Git ou le paquet de déploiement.

## 4. Variables serveur
Conserver les valeurs existantes, sans les copier dans le code : DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL=true pour TiDB ; REDIS_URL avec rediss:// pour Upstash ; SESSION_SECRET aléatoire d’au moins 32 caractères ; ADMIN_ENTRY_PATH selon le format existant ; NODE_ENV=production, TRUST_PROXY=1 derrière Vercel ; SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM ; PUBLIC_SITE_URL=https://votre-domaine.

Le verrouillage des comptes et la version de session admin sont relus en base à chaque route protégée. Les artisans en attente peuvent consulter leur dossier et déposer un complément, mais les routes d’activité sur les demandes exigent approuve. Un refus de dossier retire l’accès à cette activité ; le blocage de compte reste disponible dans Utilisateurs et refuse toute connexion. Réactiver un compte ne valide pas automatiquement son dossier.

## 5. Déploiement et recette
Conserver index.js, vercel.json et la configuration Redis existante. Déployer d’abord en préproduction après migration. Exécuter `npm test`, `npm run check`, `npm audit`. Vérifier avec des comptes de test : inscription artisan sans pièce refusée ; inscription avec certificat puis code e-mail ; dossier absent des recherches tant que non approuvé ; téléchargement admin ; approbation/refus/complément ; client bloqué avant connexion et pendant session ; modification de service avec/sans photo ; Mon compte, mot de passe et e-mail admin ; invitation/acceptation/révocation ; principal autorisé et secondaire refusé ; désactivation et réactivation ; utilisateurs, signalements, traitement support et déconnexion.

Les 14 tests locaux utilisent une base simulée pour les routes et autorisations. Ils ne valident pas le SQL sur votre TiDB, la distribution Upstash, SMTP, Vercel ni le rendu dans tous les navigateurs. Ne pas remplacer cette recette par les tests locaux. Le limiteur de tentatives existant reste en mémoire par instance ; les codes ont leurs contrôles SQL, mais une limitation globale via Redis/proxy reste à valider avant une forte charge. Aucun test de 10 000 connexions n’a été exécuté.
