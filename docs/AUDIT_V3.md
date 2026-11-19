# Taskly — V3, préproduction uniquement

Cette version est cumulative (V1 puis V2 puis V3). Aucun service externe, dépôt GitHub, utilisateur réel ni déploiement de production n'a été modifié. Lire également les rapports V1 et V2. Le périmètre est celui de la V3 convenue : chatbot, navigation, recherche, images et tests ciblés. Pas d'application mobile ni de nouvelle fonctionnalité opérationnelle de messagerie professionnelle en V3.

## Corrections et choix

### Chatbot
`server/services/tasklyAssistantAi.js` : audit ciblé de la transmission vers Groq. Les listes de six thèmes et trois langues, le refus des valeurs hors liste, l'absence de données personnelles, l'URL fixe, le refus des redirections, le délai maximal de six secondes et la limite de longueur de réponse sont conservés. La réponse côté navigateur est affectée à `textContent`, pas interprétée comme du HTML. Les routes protégées et leurs limiteurs n'ont pas été assouplis. Ajout d'un cache mémoire par instance de 5 minutes des seules réponses génériques réussies : au maximum 18 clés possibles, séparées par thème/langue ; partage d'une requête Groq en cours pour une même clé ; échec non mémorisé. Aucun stockage de texte libre, identifiant, historique, statistique d'admin ou résultat individuel. Une clé API absente désactive également le cache. Le cache est volontairement local, pas Redis, pour éviter un aller-retour réseau supplémentaire et une persistance de réponses IA. Le délai de cinq minutes est un choix d'optimisation ; pas de mesure de la latence réelle ou d'appel Groq ici. Les réponses peuvent contenir des erreurs malgré les instructions du modèle ; audit complet des réponses et des autorisations admin à poursuivre.

### Navigation et recherche
- `client/public/js/{client,artisan}-navigation-stable.js` : si la rubrique demandée est déjà chargée complètement et que l'URL embarquée correspond exactement à la cible, un nouveau clic sur sa rubrique ne recharge plus le document. On vérifie la présence du contenu attendu ; une navigation vers une autre rubrique ou un cadre inaccessible continue à fonctionner comme avant. Les protections des dialogues V1 restent intactes. Les références aux scripts dans les routes des deux shells changent de version pour audit3. Choix : préserver le formulaire courant en cas de clic répété ; recharger via le navigateur reste possible. Les contrôles d'accès serveur restent inchangés.
- `home.js` : effacer l'ancienne sélection lors d'une nouvelle saisie ; vérifier que le métier sélectionné correspond au texte soumis ; éviter une erreur si une suggestion n'existe plus. Empêche une redirection vers le métier précédemment choisi alors que l'utilisateur en tape un autre.
- `home.js`, `services.js`, `artisans.js` : chargement différé et décodage asynchrone des images de cartes (pas du profil détaillé ni de l'image principale du bandeau). `api.js` : repli d'image de service si l'erreur s'est produite avant l'enregistrement du gestionnaire, sans boucle de repli. `artisans.js` : enlever le gestionnaire d'erreur avant d'assigner l'avatar de repli, pour éviter une boucle si ce dernier échoue aussi. Visualisation navigateur et comportement réseau restent à tester.

### Images
Les dimensions et les chemins des images existantes sont conservés. Choix prudent : ne remplacer une photo JPEG que si la réduction est supérieure à 10 % et la similarité structurelle SSIM multicanal au moins 0,985 (Pillow + scikit-image ; indicateur objectif, pas validation visuelle). Ne pas modifier les PNG en place en cas de perte de pixels ou de métadonnées non prises en charge. Deux images du bandeau ont une variante WebP sans perte, avec comparaison exacte pixel RGBA et PNG original conservé dans `<picture>` pour compatibilité. Les autres ressources n'ont pas été remplacées faute de résultat suffisamment intéressant selon ces critères.

| Ressource | Original (octets) | Désormais transmis (octets) | Réduction | Contrôle |
|---|---:|---:|---:|---|
| hero/home-service.jpg | 206840 | 84056 | 122784 | SSIM 0,987777 ; 740×493 |
| hero/floating/artisan-3 | 220784 | 115386 | 105398 | RGBA identique ; 360×540 |
| hero/floating/artisan-2 | 121659 | 65426 | 56233 | RGBA identique ; 360×540 |

Total de ces trois ressources : 549283 vers 264868 octets, économie de 284415 octets (~51,8 %) si les trois sont téléchargées et le navigateur choisit WebP. Le ZIP contient aussi les PNG de repli ; sa taille peut donc croître. Ce n'est pas une économie mesurée sur toutes les pages ou un temps de chargement garanti. Aucune modification des images téléversées, des documents privés ou de la base.

## Tests réellement effectués
- `npm run check` : 182 fichiers JavaScript contrôlés, aucune erreur.
- `node --test tests/audit-v3.test.js` : 8/8 tests (simulations via VM/fetch, navigation et recherche, fallback, présence/signature WebP). Aucune API externe appelée.
- `npm test` : 258 réussites / 269 résultats, 11 échecs `MODULE_NOT_FOUND` (express, bcrypt, multer, nodemailer), les mêmes catégories que V2. Installation hors ligne non disponible, pas de changement du lockfile. Il est impératif d'exécuter `npm ci`, puis `npm run check`, `npm test` et `npm audit` dans un environnement de test avec dépendances. Les tests de V3 ne remplacent pas les tests E2E, UI ni de charge.
- Pas de nouveau test visuel réel (Chromium était bloqué par l'environnement en V2) ; vérifier les slides et leurs positions, les images de repli, la navigation, les modales et formulaires bureau/mobile. Pas de mesure TTFB après correction, pas de test de Groq/Redis/TiDB/Brevo réels, aucun test de charge sur la production.

## Suite et barrières de mise en production
1. V4 : Taskly Mail web. Le pilote V1 reste désactivé par défaut ; confirmation personnelle et approbation ne signifient pas boîte réelle créée. Choisir fournisseur, domaine et modèle de provisionnement ; compléter activation, récupération, boîte, envoi/réception, pièces jointes, recherche, quotas/antispam, confidentialité. Ne jamais afficher un statut actif sans provisionnement réel confirmé. Pas d'application mobile.
2. Préproduction : branche dédiée, vrais services de TEST et données de test, validation des migrations V1 (notamment colonnes confidentialité indispensables à V2) puis tests d'intégration complets, contrôle des droits et des préférences Client/Artisan1/Artisan2/admin, validation des modales et du logout ; configurations Vercel/TiDB/Redis, régions, `Server-Timing` temporaire, notifications et chatbot, index, audit des dépendances, sauvegardes et restauration.
3. La capacité d'un million de comptes enregistrés, les latences cibles et la fiabilité ne sont pas démontrées. Tests de charge uniquement sur environnement autorisé et isolé ; décision de mise en production après validation et plan de retour arrière.
