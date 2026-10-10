# Version finale avec architecture client

Utiliser cette archive complète à la place des anciennes archives de correctifs. Elle contient toutes les corrections précédentes ainsi que la nouvelle organisation :

```
client/
  public/    pages publiques, styles, scripts, images
  private/   pages admin, client et artisan, servies après contrôle d'accès
server/      routes, protections et services
```

## Application dans le dépôt existant

Sauvegarder le projet et la base. Décompresser l'archive, puis copier le contenu du dossier taskly-platform-main dans le dépôt existant. Les variables privées et les données ne sont pas fournies dans l'archive : garder server/.env et les fichiers historiques déjà présents. Vérifier les modifications locales avant d'écraser des fichiers.

Depuis la racine du dépôt :

```powershell
powershell -NoProfile -File .\scripts\finaliser-architecture.ps1
npm ci
npm run check
npm test
git diff --stat
```

Le premier script retire les anciens public/ et private/ de la racine en les déplaçant dans une sauvegarde .taskly-private/ exclue de Git et de Vercel. Il conserve les anciennes photos uploads/ ; s'il trouve un conflit de photos, il s'arrête sans déplacer les originaux. Il ne crée pas de commit, ne touche pas à server/.env et n'exécute aucune requête SQL.

## Données, artisans de test et Vercel

Les comptes de démonstration ne peuvent pas être rétablis simplement par un commit de code : suivre CORRECTIONS_11_OCTOBRE.md après sauvegarde, contrôle du diagnostic et de l'instantané. Ne pas retirer les filtres d'approbation pour afficher les nouvelles inscriptions en attente.

Vercel : racine du dépôt comme Root Directory, aucun override Build Command ou Output Directory. vercel.json conserve Express et inclut client/** dans la fonction. Le middleware publicFiles sert client/public/ via sendFile, car Express.static seul n'est pas pris en charge par l'intégration Express Vercel. Les HTML privés ne sont pas des fichiers statiques publiés. Conserver les variables Vercel/TiDB/Upstash/SMTP.

Références : https://vercel.com/docs/frameworks/backend/express et https://vercel.com/docs/project-configuration/vercel-json#functions.

## Contrôles effectués

76 tests réussis sur 76, sans port réseau ; 98 fichiers JavaScript sans erreur de syntaxe. Les règles des routes, des sessions, du CSRF et des transactions sont testées avec une base simulée. Les 104 dépendances utilisées correspondent aux versions verrouillées. Voir RAPPORT_LIVRAISON.md.

Le rendu réel, le déploiement Vercel et les opérations sur TiDB/SMTP/Upstash restent à valider. L'accès au domaine est toujours refusé par une préférence du navigateur ; la connexion TiDB échoue dans l'environnement de travail. Aucun déploiement ni modification de comptes distants réalisé.
