# Corrections du 11 octobre

Base : la dernière archive taskly-platform-main.zip fournie. Aucun commit ni déploiement effectué. Copier les fichiers corrigés dans le dépôt correspondant à cette base ; conserver les variables privées déjà configurées.

## Changements

- Suppression client/artisan : suppression explicite et ordonnée des signalements, avis, demandes, pièces, codes, changements d'e-mail et profils avant le compte. Ne dépend plus des cascades historiques. Mot de passe, confirmation SUPPRIMER, transaction et exclusion des administrateurs conservés.
- Support artisan : un seul gestionnaire de suppression ; rafraîchissement du suivi après message ou dépôt de pièce.
- Support public : le repli SQL conserve le filtre public. Si le schéma ne permet pas cette séparation, la consultation échoue au lieu d'exposer une demande liée au compte. Appliquer la migration complète.
- Comptes PFE : aperçu disponible avant préparation ; ciblage exact des trois identifiants autorisés, partagé avec les tests. Préparation des artisans actifs sélectionnés : approbation et confirmation d'e-mail pour les rendre visibles. Nouveaux comptes après l'instantané exclus.
- Formulaires internes admin : regroupement libellé/champ, alignement sur deux colonnes sur grand écran, empilement mobile, pièces jointes mieux présentées, formulaires cachés respectés. Zone de suppression du profil mieux présentée. Logo et navigation conservés.
- Diagnostic SQL étendu aux invitations, changements d'e-mail, journal admin et codes.

## Base de données et artisans de démonstration

Ces corrections de code ne modifient pas automatiquement la base distante. Après sauvegarde, utiliser les variables locales privées pointant vers la bonne base, puis :

```powershell
npm ci
npm run db:migrate
npm run db:migrate:accounts
npm run db:diagnostic
npm run demo:preview
```

Lire DEPLOIEMENT.md pour les migrations et le stockage durable. Ne pas importer taskly_db.sql par-dessus une base existante.

Si aucun instantané n'a encore été préparé :

```powershell
npm run demo:prepare
npm run demo:preview
```

Vérifier chaque ligne : conserver uniquement les artisans de démonstration voulus, et supprimer uniquement les clients/artisans dont l'identifiant e-mail est houcinsahli33, sahliredha03 ou houcinshl03. Les administrateurs sont exclus. Préparer l'instantané avant de créer de nouveaux comptes de test. L'instantané ne se renouvelle pas automatiquement.

Après vérification et sauvegarde, appliquer cette sélection :

```powershell
npm run demo:apply
```

Si l'instantané a déjà été appliqué mais ses artisans actifs restent invisibles, restaurer seulement ses lignes conserver :

```powershell
node scripts/prepare-pfe-demo.js --restore
```

Cette restauration exige un instantané déjà appliqué, ne supprime aucun compte, ignore les comptes bloqués et vérifie le rôle et l'e-mail enregistrés. Les artisans hors de cet instantané restent soumis à Examiner ; ne pas retirer les filtres de l'annuaire pour les afficher.

## Vérification et limites

52 tests réussis sur 62. Les 10 autres rencontrent EACCES sur les connexions HTTP locales, bloquées par l'environnement : ils restent à exécuter. Contrôle syntaxique de 112 fichiers JavaScript sans erreur. Tests exécutés avec les dépendances locales existantes ; npm ci à vérifier dans le dépôt cible.

La suppression complète sur une vraie base, le rendu navigateur, SMTP, TiDB, Upstash et Vercel restent à vérifier. La cause de la panne distante de suppression n'est pas confirmée sans ses journaux ; la correction supprime la dépendance aux cascades, mais une migration manquante doit aussi être appliquée.

Recette minimale après installation : supprimer un compte client jetable et un artisan jetable avec demandes/pièces, vérifier l'annuaire des comptes conserver, créer un nouvel artisan et vérifier qu'il reste invisible avant examen, tester Mon compte/invitations/services/Examen sur ordinateur et mobile.
