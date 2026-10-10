# Taskly — version complète intégrée

Cette livraison reprend le commit bf71a9c du projet existant et conserve ses correctifs. La structure demandée est client/public/ et client/private/, avec une seule source des fichiers publics. Le logo et le style Taskly restent conservés.

Commencer par INSTALLATION_FINALE.md. Ne pas mélanger cette livraison avec les anciennes archives de correctifs.

Fonctionnalités : profils/photos clients et artisans ; suppression personnelle sécurisée ; confirmation par code e-mail ; accès limité au support pour les artisans en attente ; examen, activation et refus motivé ; notifications avec reprise ; gestion administrative et formulaires internes ; annuaire paginé et préparation contrôlée des comptes de démonstration.

Vérification de cette livraison : 76 tests réussis, 98 fichiers JavaScript sans erreur de syntaxe ; 104 dépendances installées concordent avec le verrouillage. Les routes sont testées dans Express sans socket réseau, avec une base et un SMTP simulés. Ce résultat ne constitue pas une validation des services externes.

Les comptes, la base, les fichiers privés et server/.env ne sont pas fournis ni remplacés par l'archive. Aucun commit, déploiement, nettoyage ou suppression de compte distant n'a été effectué. Le navigateur refuse encore l'accès au site ; la recette réelle sur Vercel, TiDB, SMTP et Upstash reste à faire.
