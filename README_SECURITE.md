 > Référence actuelle : README.md et INSTALLATION_FINALE.md. Les instructions historiques ci-dessous restent fournies pour contexte.

> **Note 10/10/2026 :** les instructions historiques ci-dessous ont été adaptées aux routes privées de la version corrigée. La référence principale pour une base existante est `DEPLOIEMENT.md` et `INSTALLATION_FINALE.md`.

# Taskly — PFE artisans-clients · amélioration de sécurité (version de travail)

**Le design d'origine est conservé** : CSS, logo, mise en page et couleurs d'origine. Les nouveaux panneaux réutilisent les classes déjà présentes. Les images du dossier `client/public/uploads` ne sont pas redistribuées dans le ZIP, par protection des données personnelles ; gardez votre ZIP d'origine comme sauvegarde.

## Ce qui a été ajouté / corrigé

- Pages admin privées : entrée configurable dans `ADMIN_ENTRY_PATH` (dans `server/.env`), tableau de bord sur `${ADMIN_ENTRY_PATH}/dashboard`. Les URL historiques `/admin` et `/admin-dashboard.html` répondent 404.
- Authentification administrateur distincte : e-mail, mot de passe bcrypt, puis code à six chiffres envoyé par SMTP ; contrôle des droits côté serveur.
- Inscription client/artisan suivie d'un code e-mail (3 minutes, trois essais au plus) ; limitation simple des tentatives.
- Protection CSRF sur les actions API, régénération de session après connexion, cookie HttpOnly et SameSite, déconnexion correcte.
- Artisans en **attente de vérification** et non visibles publiquement avant l'approbation ; dépôt privé de pièces PDF/JPG/PNG de 3 Mio maximum, consultation via admin, historique des décisions.
- Pool MySQL configurable, index pour les recherches et les statistiques, sessions Redis obligatoires en production.
- Guide de tests et de commits ci-dessous.

## Installation Windows / VS Code

**A. Sauvegarde.** Conserver le dossier/ZIP original. Faire une copie de votre base MySQL (export SQL) avant toute migration. Ne pas travailler directement sur une base de production.

**B. Installation.** Ouvrez ce dossier dans VS Code. Dans le terminal PowerShell, à la RACINE du projet :

```powershell
npm install
npm run check
```

Le fichier `package-lock.json` sera recréé par `npm ci`, car le registre npm était inaccessible pendant la préparation du ZIP. Ne pas utiliser `npm ci` avant d'avoir recréé le lock.

**C. Configuration.** Copier `server/.env.example` vers `server/.env`. Reportez **vos paramètres actuels** MySQL, ajoutez une clé aléatoire (génération `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), puis renseignez les paramètres SMTP (serveur réel / boîte de test telle que Mailtrap). Ne mettez JAMAIS `.env` sur GitHub. Pour l'envoi réel, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` et `MAIL_FROM` sont obligatoires. Sans SMTP, les nouvelles inscriptions et la connexion admin sont volontairement refusées ; aucun code de sécurité n'est affiché publiquement.

**D. Base MySQL.** Ne réimportez pas `taskly_db.sql` sur une base existante. Commencez par `npm run db:diagnostic` (lecture seule). Après sauvegarde et validation sur une copie, consultez `DEPLOIEMENT.md` pour les migrations intégrées et comptes/support. Ne lancez pas l’ancienne migration `migration_securite_2027.sql` sur une base déjà migrée.

**E. Compte administrateur (si vous n'en avez pas).** La création admin n'est pas ouverte sur le site public. Après SMTP et migration, depuis la racine :

```powershell
npm run admin:create -- admin@votre-domaine.fr
```

Le script crée un compte admin avec un mot de passe aléatoire **affiché une seule fois** ; sauvegardez-le dans un gestionnaire de mots de passe. Utilisez une adresse dont vous recevez les e-mails. N'utilisez jamais ce script sur une machine partagée ni pour créer des comptes sans autorisation.

**F. Démarrer :**

```powershell
npm start
```

Ouvrir `http://localhost:3000` (site public) ; pour la connexion administrateur, utilisez la valeur secrète déjà configurée dans `ADMIN_ENTRY_PATH`.

### Test guidé dans cet ordre

Les pages HTML admin sont maintenant dans `private/` à la racine ; supprimer `client/private/` après migration seulement dans la nouvelle copie validée.

1. Page d'accueil et services : le design original apparaît ; les ressources CSS sont chargées.
2. Dans une fenêtre privée, `/${ADMIN_ENTRY_PATH}/dashboard` (en utilisant la vraie valeur configurée, sans doubler le `/`) doit refuser la session anonyme. `http://localhost:3000/api/admin/stats` renvoie 401 sans connexion. Les anciennes URL `/admin` et `/admin-dashboard.html` répondent 404.
3. Configurer un SMTP et inscrire un **client de test avec un vrai e-mail accessible**. Aller sur la page de vérification, saisir le code reçu, puis tester connexion/déconnexion. Vérifier l'impossibilité de se connecter avant confirmation.
4. Inscrire un **artisan de test**. Avant validation, il ne doit **pas** apparaître dans la recherche publique. Déposer une pièce d'identité **fictive de test** et un justificatif fictif de qualification via son dashboard. Ne pas utiliser de vrais documents personnels en test.
5. À votre `ADMIN_ENTRY_PATH`, se connecter avec un **compte administrateur existant**. Un code SMTP est envoyé. Depuis le dashboard, onglet « Artisans à vérifier », examiner les documents et approuver/refuser le dossier. L'artisan approuvé apparaît ensuite dans la recherche publique.
6. Tester une session client : `GET /api/admin/stats` doit renvoyer HTTP 403. Tester les tentatives répétées de code invalide et les fichiers non PDF/JPG/PNG.
7. Vérifier `npm run check` et `npm test`, puis conserver un rapport des problèmes avant publication.

## Limites importantes (ne PAS annoncer « prêt pour 10 000 »)

- Le ZIP n'a pas été testé avec votre MySQL ni votre SMTP, ni avec 10 000 utilisateurs. Les tests de charge doivent être réalisés sur un serveur dédié, avec k6/Artillery, en commençant par 100 et 1 000 clients. Exemple **non destructif** : `k6 run scripts/load-test.k6.js`. Le script vérifie la lecture des services, il n'est pas une preuve que le scénario métier est capable de 10 000 sessions.
- Avec `NODE_ENV=production` le serveur REFUSE de démarrer sans `REDIS_URL`, pour éviter le stockage en mémoire des sessions. Il faut aussi HTTPS (reverse proxy de confiance avec `TRUST_PROXY=1`), SMTP, gestion de secrets, supervision, sauvegardes et déploiement sur plusieurs instances dimensionnées par les tests.
- Les protections anti-abus dans cette version utilisent une mémoire locale (non partagée entre plusieurs serveurs). Pour la production multi-instance, remplacer par un limiteur distribué Redis / proxy.
- Les fichiers sensibles doivent être accessibles seulement par les administrateurs habilités, ne pas être indexés, et nécessitent une politique de conservation/suppression, protection antivirus à l'upload, journalisation des accès et conformité aux lois applicables sur la protection des données.
- « Justificatifs examinés » n'est **pas** « diplôme officiellement authentifié ». Prévoir des procédures documentées de vérification des qualifications selon le métier.
- Les requêtes de recherche actuelles et les tableaux admin restent à optimiser/paginer pour de forts volumes ; audit XSS et tests de pénétration sont encore nécessaires.
- Des routes de mutation autres que l'authentification (demandes, avis, support) doivent recevoir une validation métier et des limites d'usage supplémentaires avant déploiement public.

## Commit Git (après tests réussis)

Si le dossier est lié à un dépôt Git :
```powershell
git status
git switch -c securite-verification-artisans
git add -- private/ public/ public/ server/ scripts/ tests/ package.json package-lock.json .gitignore DEPLOIEMENT.md
git status
git diff --cached --stat
git commit -m "feat: verification artisans et acces admin prive"
git push -u origin securite-verification-artisans
```

Avant `git add`, vérifier que **aucun** `.env`, document privé, photo personnelle ou sauvegarde SQL réelle n'est présent. Si `git switch` échoue car ce dossier ZIP n'a pas de `.git`, récupérer/cloner d'abord le dépôt GitHub original, puis y copier les fichiers modifiés ; nous vous guiderons pas à pas.

## Fichiers clés

- `server/app.js` : sessions, routes, fichiers statiques, admin privé, CSRF.
- `server/controllers/authController.js` : inscription, login, confirmation e-mail, session, déconnexion.
- `server/routes/adminAuthRoutes.js` : connexion admin par code.
- `server/routes/verificationRoutes.js` : dossier artisan.
- `server/routes/adminVerificationRoutes.js` : décision et consultation privée des justificatifs.
- `database/migration_securite_2027.sql` : schéma MySQL complémentaire.
- `private/admin-dashboard.html` : dashboard déplacé hors du répertoire public, même design.
