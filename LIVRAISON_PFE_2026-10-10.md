# Taskly — améliorations PFE (10 octobre 2026)

## Objectif académique

Taskly reste un **projet de fin d’études de licence informatique** : démonstration d'une plateforme de mise en relation artisans–clients en Node.js/Express et MySQL. Aucun paiement, abonnement, conversion commerciale, déploiement, suppression de base distante ou refonte graphique globale n'a été effectué. La connexion administrateur privée et le logo ont été conservés.

## Travail réalisé sur les fichiers fournis

1. **Annuaire public** (`server/models/artisanModel.js`, `server/controllers/artisanController.js`, `public/js/artisans.js` et copies `client/public`) : pagination serveur de 12 profils par page, total réel et chargement des pages suivantes. Plus de présentation limitée aux 3/6 premiers profils. Recherche par nom, métier, ville et filtres existants préservés. Seuls les artisans *approuvés, actifs et e-mail confirmé* sont exposés publiquement. La page détail d'un service indique désormais quand il existe plus de 12 artisans et donne un lien vers l'annuaire complet.
2. **Administration des artisans** (`server/routes/adminVerificationRoutes.js`, `public/js/admin-verification.js`, HTML/CSS) : disparition de la limite arbitraire à 200 dossiers ; pagination de 20, recherche par nom/e-mail/métier/ville ; filtres par statut du dossier ou blocage du compte ; compteurs globaux et résultats filtrés.
3. **Examen d'un dossier** : informations du profil, justificatifs (téléchargement privé), demandes au support, notifications, historique des décisions (administrateur, date, décision, motif). Confirmation explicite avant validation, refus ou demande de complément ; motif obligatoire selon la décision. Réessai d'e-mail disponible pour notifications en attente/échec. Export CSV **de la page courante**, avec prévention des formules tableur.
4. **Gestion des utilisateurs** : consultation paginée de tous les clients, artisans et administrateurs ; filtres par rôle, statut du compte et nom/e-mail. Les administrateurs restent protégés contre les actions de blocage déjà présentes.
5. **Statistiques** : ajout au tableau de bord du nombre de dossiers en attente, à compléter, approuvés et de comptes artisans bloqués.
6. **Nettoyage PFE** (`scripts/prepare-pfe-demo.js`, `scripts/pfe-cleanup-rules.js`) : recherche insensible à la casse pour `sahli` et `shl`, strictement limitée aux clients/artisans. Aperçu en lecture seule par défaut ; instantané de candidats dans un dossier ignoré par Git, empreinte exacte, expiration 24 h, transaction, revalidation des identités avant toute suppression. Aucune activation automatique de comptes de démonstration.
7. **Tests** : nouveaux tests de pagination publique, administration paginée, lecture de l'historique et protection des administrateurs dans le nettoyage. Les fichiers JavaScript modifiés passent le contrôle syntaxique.

## Fonctions antérieures conservées, non refaites

L'inscription avec code e-mail et justificatif, la validation d'artisan par l'administrateur, les invitations d'administrateurs, la gestion des services et signalements, les messages au support, les profils, les notifications et les sessions privées existaient déjà dans la base fournie. Ces fonctions doivent être **retestées en conditions réelles** avant une soutenance. La présente livraison ne prouve pas qu'elles ont toutes été validées sur la vraie base MySQL.

## Installation et recette locale

Dans une **copie du projet**, sans écraser le dossier local contenant tes éventuelles modifications Git non enregistrées :

```powershell
npm ci
npm run check
npm test
npm start
```

Préparer séparément l'environnement local `.env` non partagé, les migrations nécessaires et une base de test contenant des artisans aux statuts variés. Vérifier ensuite ces parcours dans un navigateur :

- Annuaire sans filtre puis pages suivantes, tous les artisans approuvés visibles sans doublon ; artisans en attente et bloqués absents.
- Filtres par métier, ville, wilaya et mot-clé ; détail service avec lien vers l'annuaire.
- Espace administrateur privé : statistiques, recherche des 250e et 350e dossiers si ces données existent, boutons Précédent/Suivant, bouton Examiner, téléchargement des pièces, historique.
- Décisions : demande de complément et refus avec motif, confirmation avant envoi, activation avec justificatif ; vérifier les e-mails et l'accès effectif à la session artisan.
- Liste utilisateurs : filtres, blocage/déblocage d'un compte non-admin ; administrateur préservé.
- Support public et support lié à l'artisan non activé ; invitations et gestion des services et signalements.
- Nettoyage : exécuter uniquement `npm run demo:preview` pour commencer et contrôler les comptes. **Ne pas lancer la commande `--apply` sans sauvegarde et validation nominative.**

## Limites de la validation dans cette livraison

- Aucun accès à la base TiDB/MySQL réelle, ni aux e-mails des comptes : **0 suppression exécutée**. Le nettoyage reste en mode aperçu jusqu'à validation.
- Dépendances NPM absentes de l'environnement de préparation ; `npm ci` ne s'est pas achevé. La suite `npm test` complète ne peut donc pas être déclarée réussie. Les nouveaux tests isolés ont été exécutés et passent ; le contrôle de syntaxe aussi.
- Aucun test visuel interactif dans le vrai navigateur, aucun essai avec un serveur SMTP, aucune migration SQL exécutée.
- Objectif d'architecture **10 000 utilisateurs connectés simultanément** : pas de preuve de tenue sous cette charge. Les tests de charge, l'observation du pool MySQL, les sessions Redis, la file de requêtes et le stockage durable devront être testés séparément sur une préproduction dédiée.
- Aucun commit Git ni push vers GitHub : cette archive est une proposition de modifications à intégrer et tester, pas une mise en production.

## Précautions avant intégration Git

Conserver tes modifications locales actuelles dans une sauvegarde ou un commit. Comparer cette archive avec ton dossier de travail, car elle peut correspondre à un état différent de ton dernier commit GitHub. Ne jamais copier ni publier les fichiers `.env` ou `.taskly-private`. Tester avant de créer un commit, puis pousser sans `--force`.
