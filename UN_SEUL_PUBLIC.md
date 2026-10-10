# Architecture finale

Structure : client/public/ pour les fichiers publics ; client/private/ pour les quatre pages des espaces admin, client et artisan. Aucun dossier public/ ni private/ à la racine. Les URL habituelles sont conservées.

Vercel inclut client/** dans la fonction Express ; les fichiers publics sont servis par sendFile depuis une racine strictement bornée. Aucune sortie statique ne publie client/private/. Aucun fichier privé ou variable d'environnement n'est placé dans l'archive. Les images et documents durables restent dans TiDB.

Les corrections des profils, suppression, support et artisans de démonstration des versions précédentes sont incluses. Il ne faut pas superposer d'anciennes archives ensuite.

Installer dans un nouveau dossier pour vérifier cette version sans laisser les anciens dossiers public/ et private/. Conserver vos variables privées dans server/.env, vos fichiers historiques et vos sauvegardes. Les anciens fichiers dans client/public/uploads/ restent à sauvegarder et à importer si nécessaire. Ne jamais inclure les variables ou justificatifs dans Git.

Consulter DEPLOIEMENT.md et CORRECTIONS_11_OCTOBRE.md pour la base de données et les artisans de démonstration. Aucun compte distant, migration ou déploiement n'a été effectué. L'accès au site est bloqué par la préférence du navigateur ; TiDB est inaccessible depuis l'environnement de travail.
