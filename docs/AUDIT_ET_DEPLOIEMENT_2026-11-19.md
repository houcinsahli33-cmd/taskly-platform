# Taskly — première livraison de corrections (19 novembre 2026)

Cette archive est une **copie de travail candidate pour une préproduction**, pas une version validée en production. L'archive initiale n'a pas été modifiée. Aucun service réel (Vercel, TiDB, Redis, Brevo), aucun compte utilisateur ni aucune donnée distante n'ont été touchés. Aucun test de charge distant n'a été lancé.

## Corrections livrées

- Espace Client : l'iframe ne passe plus en plein écran lors de l'ouverture d'une modale. Le menu et le header restent à leur place. Les éléments voisins sont rendus inertes pendant la modale, puis restaurés (y compris lors d'un changement de rubrique), comme dans le correctif Artisan. Suppression des règles CSS de redimensionnement résiduelles Client/Artisan. Une simulation DOM vérifie ouverture, fermeture et restauration. Contrôle visuel en navigateur encore requis, y compris mobile et toutes les fenêtres. Le système de modales de l'administration est distinct et reste à vérifier.
- Le bouton de confirmation de déconnexion rouge, déjà présent dans le ZIP source, est conservé. Les fonds transparents déjà présents dans les styles partagés sont préservés.
- `auth.js` : aucune requête `/api/site-settings` si aucun élément de la page n'utilise les coordonnées. Pas de suppression des contrôles d'accès, du CSRF, de la durée de session ou des données métier. Les temps de réponse restent à mesurer.
- `server/app.js` : les API ont une politique privée `no-store` par défaut avant le contrôle d'inactivité ; les exceptions publiques explicites (médias, coordonnées du site) sont conservées. ETag automatique Express désactivé pour les réponses dynamiques. Les fichiers statiques continuent d'être servis via sendFile. Le contrôle du secret du cron compare les tailles en octets (évite une exception pour les caractères multioctets).
- Le middleware de fichiers statiques n'intercepte plus les chemins `/api/`. Les autres contrôles de fichiers sont préservés.
- `database/migration_confidentialite_artisan.sql` : migration rejouable des quatre colonnes déjà attendues par le code ; aucune préférence existante écrasée, téléphone et e-mail masqués par défaut pour les nouvelles colonnes. Le paramètre de messagerie n'est pas encore imposé sur l'ensemble des flux. Aucune migration exécutée.

## Taskly Mail : pilote, désactivé par défaut

Ajouts : `server/routes/professionalMailRoutes.js`, `server/services/professionalMailPolicy.js`, `database/migration_taskly_mail_pilot.sql`, pages privées artisan/admin `taskly-mail.html`, `client/public/js/professional-mail-pilot.js`.

La phase pilote permet de demander une adresse, la générer selon le nom et le métier avec unicité SQL, envoyer un code au mail personnel via le SMTP transactionnel existant, confirmer ou annuler depuis le même profil, examiner et traiter la demande côté administration. Le code est haché, 10 minutes de validité, 3 tentatives, contrôle transactionnel, un identifiant distinct par profil, contrôles de rôle et CSRF existants, vérification du métier et de l'adresse personnelle avant décision. L'approbation est enregistrée avec identifiant admin, date et motif de refus. Elle produit uniquement le statut `approved_pending_provider`, jamais une boîte fictive déclarée active. Listing admin paginé (50).

**Décisions provisoires à valider** : confirmation par code saisi dans Taskly plutôt que deux liens directs dans le mail ; suffixe identifiant en cas d'homonymie ; une seule demande par profil pour ce pilote ; annulés/refusés nécessitent une intervention du support avant une nouvelle demande. La réservation est interne à Taskly, pas vérifiée auprès d'un fournisseur externe. L'administration doit toujours examiner les justificatifs dans les rubriques existantes ; ce pilote ne les duplique pas.

Ne pas activer en production : manque encore l'intégration fournisseur (choix, API provisionnement, disponibilité réelle, DNS MX/SPF/DKIM/DMARC, activation sécurisée, suspension et suppression/revocation lors du changement de métier ou de la fermeture du profil, accès IMAP/API, SMTP, réception, envoi, stockage et quotas, pièces jointes, recherche, brouillons, corbeille, notifications, antispam, confidentialité et récupération de compte). Prévoir un journal complet des transitions et des tentatives de provisionnement, des limites distribuées Redis, des tests de concurrence et des tests d'intégration SQL/SMTP. Le service existant `server/services/tasklyMail.js` est la file de notifications transactionnelles, pas un hébergement de boîtes. Aucun domaine réel n'est supposé appartenir à l'utilisateur. L'application mobile est exclue.

`TASKLY_MAIL_PILOT_ENABLED` non défini ou `false` : routes pilote non montées et menu non ajouté.

Pour tester SEULEMENT en environnement isolé, avec base et SMTP de test :
- Appliquer la migration pilote après sauvegarde et vérification du schéma.
- Configurer `TASKLY_MAIL_DOMAIN` avec un domaine de test contrôlé et `TASKLY_MAIL_PILOT_ENABLED=true`.
- Configurer SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM et autres réglages existants via les secrets de préproduction, jamais dans le dépôt. Vérifier le processus d'approbation, le refus, l'annulation, les tentatives invalides, l'expiration, la réémission, le profil 1/2, les autorisations croisées, les homonymes et les requêtes concurrentes. Les notifications de décision restent à ajouter.

## Tests réellement réalisés

Node v22.16.0. `npm run check` : 180 fichiers JavaScript vérifiés, 0 erreur de syntaxe.

Suite `node --test tests/*.test.js` sans services externes :

| | Original | Candidat |
|---|---:|---:|
| Résultats recensés | 246 | 253 |
| Réussites | 231 | 242 |
| Échecs | 15 | 11 |

Les 4 échecs de l'original non liés aux dépendances provenaient de tests devenus obsolètes : mock SQL exigeant un espace simple entre FROM et JOIN ; expressions régulières sensibles aux espaces de mise en forme SQL/JS/CSS et ancien sélecteur CSS de la dernière carte, avant ajout Confidentialité. Les attentes métier (37 artisans, pagination, filtrage, arrondi, suppression rouge) ont été conservées. 7 nouveaux tests : 2 simulations modales Client/Artisan, 2 contrôles statiques cache/paramètres, 3 tests de politique Taskly Mail. Les 11 échecs restants sont dus à l'absence de express, bcrypt, multer ou nodemailer (npm ci --offline a échoué, cache de paquets incomplet). Ce nombre compte les fichiers de tests qui échouent au chargement, pas toutes les assertions d'intégration qu'ils contiennent. Aucun succès n'est revendiqué pour les tests HTTP/SQL/SMTP non exécutés. Voir docs/TESTS_AUDIT.txt.

## Avant toute mise en ligne

1. Garder le dépôt original intact ; créer une branche et un déploiement Preview, avec une base et un Redis de test séparés. Ne pas copier de .env, secrets, données personnelles ou identifiants de production dans le ZIP/commit.
2. Exécuter `npm ci`, `npm run check`, `npm test` et `npm audit` sur une machine pouvant installer les dépendances. Corriger les échecs réels avant de valider. Ne pas utiliser `npm audit fix --force` aveuglément.
3. Sauvegarder la base et tester `npm run db:migrate -- migration_confidentialite_artisan.sql` sur la base de test. Ne jamais lancer automatiquement une migration en production ni écraser la base avec `taskly_db.sql`.
4. Laisser `TASKLY_MAIL_PILOT_ENABLED=false` pour la première validation principale. Tester séparément la migration et la fonctionnalité pilote après configuration de test. Ne jamais déclarer la messagerie active avant une réception/envoi réel.
5. Vérifier les fenêtres Client/Artisan/admin, mobile, retour/avance du navigateur, clavier, fermeture, focus, profil, suppression, déconnexion, mots de passe, inscription et sélection des espaces. Refaire les tests de confidentialité, accès croisés, coordonnées publiques et expiration de session réelle. Vérifier la migration et les comptes existants avec des données de test.
6. Relever les régions Vercel/TiDB/Redis (aucune modification ici). Mesurer TTFB et latence p50/p95/p99, démarrage à froid/chaud, puis instrumenter Node/SQL/Redis sans données personnelles. Mesurer les plans SQL, index, budgets pool et quotas. Les requêtes auth/activity/me continuent de vérifier la sécurité côté serveur. Vérifier également queue notifications, expiration, worker/cron et limites anti-abus multi-instance.
7. Audit complémentaire : analyse dépendances, CSP/XSS, téléversements, sessions et rate limiting global (limiteur local actuel non distribué), accès admin, sauvegardes/restauration, chatbot, messagerie interne. Optimisation ciblée images (environ 5,2 Mio dans le dossier), CSS/JS, requêtes répétées et annuaire SQL, sans changements visuels non validés.
8. Tests de charge UNIQUEMENT sur préproduction dédiée, avec accord explicite, quotas et coûts contrôlés. Définir utilisateurs simultanés, trafic, stockage, SLO, sécurité et capacité de restauration. Un million de comptes enregistrés est un objectif, pas une capacité démontrée.
9. Faire valider le résultat et la stratégie de retour arrière avant fusion/déploiement. Aucune garantie zéro bug. Ne pas déployer ce candidat directement en production avant les vérifications.
