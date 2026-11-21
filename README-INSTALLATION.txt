TASKLY — INTERFACES D'APPEL PREMIUM + SONNERIE TELEPHONIQUE
==========================================================
Lot v1 — destiné au projet Taskly Node.js sur Windows.

ELEMENTS INCLUS
- Style messagerie responsive (sans changer logo/header/sidebar).
- Fenetre audio et video rafraichie, avec le moteur existant.
- Fenetre d'appel entrant centree et mieux visible.
- Duree d'appel, etat de connexion, aperçu de la conversation.
- Plein ecran, choix des appareils si LiveKit/navigateur le permet.
- Sonnerie analogue a deux tons plus audible + bouton de test.
- Le moteur LiveKit, Krisp, Redis et les APIs restent inchanges.

LIMITES HONNETES
- Un navigateur web ne peut pas forcer le volume du telephone ou
  passer outre les politiques de lecture automatique ; cliquer sur
  la cloche dans la messagerie active/teste la sonnerie.
- La sonnerie ne peut pas fonctionner si le navigateur/onglet est ferme.
  Les appels en arriere-plan exigeraient une implementation PWA/push
  specifique, qui n'est pas incluse.
- L'indicateur presente l'etat d'appel, PAS une mesure non verifiee du debit.
- La consultation de conversation pendant l'appel est en lecture seule ;
  aucun faux bouton d'envoi de messages n'a ete ajoute.
- Les tests locaux sont indispensables, suivi d'un test avec deux comptes.

INSTALLER DANS LE PROJET
1. Extraire l'archive taskly-call-premium.zip dans le dossier
   C:\Users\ahsah\Taskly-V8-Git (en conservant les sous-dossiers).
2. Ouvrir PowerShell dans le dossier du projet.
3. node scripts/install-taskly-call-premium.cjs
4. node --test tests/taskly-call-premium.test.cjs
5. npm run check
6. npm test
7. git diff --check
8. Afficher et verifier git diff et git status avant de publier sur main.

ATTENTION : aucune publication GitHub ni Vercel n'est realisee par le
paquet. Pour la production, publier uniquement apres tests locaux et
validation des parcours client/artisan.
