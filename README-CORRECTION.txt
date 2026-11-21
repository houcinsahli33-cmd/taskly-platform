TASKLY - CORRECTION DE PRESENTATION DES APPELS V3
===================================================
Cette correction vise les problemes visibles dans les captures du 21/11/2026 :
- Fenetre audio/video trop grande par rapport a la zone disponible.
- Barre de defilement interne ; boutons hors ecran.
- Arriere-plan floute sur ordinateur alors que les maquettes valident
  une interface d'appel integree dans la conversation.

Comportement :
- Ordinateur (>1100px, conversation centrale assez grande) : appel non
  modal directement dans la colonne de discussion. Liste et details restent visibles.
- Tablette et telephone : dialogue modal responsive tenant dans l'ecran.
- Appel video : flux distant dans la surface disponible, apercu local dans un coin,
  boutons d'appel toujours accessibles et tiroir Appareils/Conversation flottant.
- Aucune modification du header, logo, navigation principale, moteur LiveKit,
  Krisp, sonnerie, API, comptes, base de donnees ou autorisations.
- Les noms/messages restent reels (pas de contenu fictif des maquettes).

INSTALLATION (dans C:\Users\ahsah\Taskly-V8-Git) :
  Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\taskly-layout-v3.zip" -DestinationPath (Get-Location).Path -Force
  node scripts/install-taskly-call-layout-v3.cjs
  node --test tests/taskly-call-layout-v3.test.cjs
  npm run check
  npm test

RETOUR ARRIERE sans supprimer les fichiers :
  node scripts/rollback-taskly-call-layout-v3.cjs

NE PAS PUBLIER avant un test reel des boutons et du flux video.
