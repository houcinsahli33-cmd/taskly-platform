# Taskly — budget de performance V8

La V7 reste la référence conservée. Cette V8 est une candidate cumulative de préproduction ; aucune publication automatique. Le budget ci-dessous est un **critère de validation**, pas une mesure obtenue. Les temps historiques viennent d'une navigation observée sur l'ancien site, et ne sont pas des percentiles ; ne pas les présenter comme une comparaison statistique avant/après.

| Opération | API | Ancien relevé | Objectif p95 |
|---|---|---:|---:|
| Activité | POST /api/auth/activity | 2030 ms | 300 ms |
| Authentification | GET /api/auth/me | 1870 ms | 300 ms |
| Demandes Artisan | GET /api/demandes/artisan | 875 ms | 400 ms |
| Paramètres publics | GET /api/site-settings | 453 ms | 200 ms |
| CSRF | GET /api/auth/csrf | 350 ms | 200 ms |

Mesurer sur un environnement autorisé, séparé de la production (base, Redis, secrets, notifications et comptes de démonstration distincts). Aucune mesure sur les comptes réels. Le scénario demande des sessions Artisan approuvées, distinctes, ouvertes normalement. Le script ne crée pas de comptes, ne contourne pas l'authentification et ne désactive aucune protection. L'activité renouvelle les sessions de test : le scénario est volontairement synthétique et plus fréquent qu'une navigation réelle.

## Test des budgets

1. Installer Node 22 et les dépendances sur un environnement de test ; relancer `npm run check` et `npm test`.
2. Vérifier manuellement que le déploiement cible et ses services sont bien isolés. Le script refuse l'hôte de production historique, mais ne peut pas détecter toutes les autres URLs de production ni des identifiants de production réutilisés. Ne jamais les utiliser.
3. Créer localement `.taskly-private/perf-sessions.json` (répertoire déjà exclu de Git). Y placer un tableau JSON de chaînes contenant chacune **uniquement** le cookie `artisans.sid` d'un compte Artisan de test distinct. Exemple fictif : `["artisans.sid=COOKIE_DE_TEST_1"]`. Ne jamais partager ce fichier, ni le publier, ni le copier dans les logs. Supprimer le fichier et fermer les sessions après les essais. Ne pas mettre les cookies sur la ligne de commande. La protection d'accès Vercel peut empêcher ce test ; ne pas la désactiver en production. Le script n'accepte pas de cookie de contournement Vercel.
4. Depuis un terminal Bash, lancer (remplacer le domaine fictif) :

```sh
TASKLY_PERF_TEST=ISOLATED_PREVIEW_ONLY \
TARGET_URL=https://exemple-preview.vercel.app \
PREVIEW_HOST=exemple-preview.vercel.app \
TASKLY_PERF_SESSIONS_FILE=.taskly-private/perf-sessions.json \
TASKLY_PERF_ROUNDS=20 npm run perf:budget
```

Sous PowerShell, définir ces variables avec `$env:NOM='valeur'`, puis `npm run perf:budget`. Pour un serveur local, utiliser `TARGET_URL=http://localhost:3000`, sans `PREVIEW_HOST`.

Le test accepte 1–25 sessions distinctes et 20–60 parcours par session, avec un préchauffage exclu des statistiques. Après préchauffage, les parcours sont séquentiels par session, avec une pause d'une seconde entre parcours. Chaque réponse est lue intégralement, vérifiée (statut et forme attendue), et limitée à 10 secondes. Les redirections ne sont pas suivies. Aucun contenu de réponse ni secret n'est imprimé. Le résultat inclut p50/p95/p99 des réponses réussies, nombres d'erreurs et un code de sortie non nul si une route dépasse son p95 ou si une erreur survient. Le p99 est indicatif sur un faible échantillon : augmenter les échantillons avant toute conclusion. Un seul parcours 204 valide n'est pas une preuve d'absence de bogues. Ce test n'est pas un test d'endurance ni un benchmark de navigateur.

## Correction appliquée et autres mesures

`siteSettings.lirePublic` mutualise les lectures concurrentes des coordonnées publiques et garde la valeur valide 10 secondes par instance Node. Une mise à jour administrative invalide son cache local après commit ; les autres instances peuvent servir l'ancienne valeur pendant la durée restante du TTL (et une lecture antérieure déjà en cours peut encore répondre). Les valeurs privées, jetons CSRF et vérifications de droits ne sont pas mis en cache. Les pannes SQL ne sont pas mémorisées. Aucun changement de région ni de cache global distribué n'a été fait.

Activer `TASKLY_PERF_TIMING=true` en préproduction uniquement pour diagnostiquer les séquences Redis/SQL. Tester à part les démarrages à froid. Vérifier les régions et quotas de Vercel, TiDB, Redis. Comparer les résultats V7 et V8 dans les mêmes conditions, avec des volumes de données réalistes et les mêmes scénarios. Mesurer aussi le navigateur, les erreurs 5xx, les 429, connexions SQL, mémoire, files d'attente et coûts. Ne pas optimiser en supprimant les vérifications d'accès, le CSRF ou les limites anti-abus.

## Capacité évolutive

Aucun système ne peut supporter une concurrence infinie ; distinguer comptes enregistrés, sessions actives, utilisateurs simultanés et requêtes par seconde. Objectif de stockage : 1 000 000 de comptes, ce qui demande des jeux synthétiques, un test de pagination / index / sauvegarde et restauration, et une mesure de stockage. Objectif de concurrence à déterminer à partir de la fréquentation et des limites du fournisseur. Commencer par 1 utilisateur, puis 5, 10 et 25 dans le scénario actuel. Examiner les erreurs et les budgets à chaque palier. Ne pas augmenter automatiquement au-delà de 25 sans accord, capacité et budget vérifiés : ensuite construire dans un environnement isolé des scénarios réalistes à 50, 100, 250, 500, 1000 utilisateurs virtuels, puis davantage si les mesures le justifient. Le script `scripts/load-test.k6.js` existant est un test public distinct, limité à 25 utilisateurs ; ni lui ni le nouveau script ne prouvent ces paliers supérieurs.

Pour poursuivre : vérifier les index et plans d'exécution avec les volumes réalistes ; contrôler les plafonds des pools SQL par instance, l'agrégation des connexions, la saturation Redis et les limites de Vercel ; traiter les notifications en file et surveiller l'arriéré ; paginer les grandes listes avec limites compatibles avec le design ; tester la montée en charge, les pointes, l'endurance et la récupération après panne. Établir des seuils d'alerte et un budget d'infrastructure. Le provisionnement des boîtes Taskly Mail reste désactivé. Aucun changement automatique de plan fournisseur.
