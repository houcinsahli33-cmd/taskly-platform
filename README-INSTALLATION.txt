TASKLY — DESIGN PRO V2 (MESSAGERIE + APPELS)
===========================================
Reprend le style des 4 maquettes professionnelles validees :
- conversation / liste / informations de demande sur ordinateur;
- appel audio avec grand avatar, minuterie et commandes;
- appel video avec grand flux distant + miniature locale;
- appel entrant dans une carte verte et blanche.

PROTECTION DU PROJET :
- Le logo, le header, la barre laterale et le menu principal ne changent pas.
- LiveKit, Krisp, Redis, authentification, API, notifications et messages ne changent pas.
- Ne touche qu'au CSS de la zone messagerie et aux 2 liens CSS dans les pages client/artisan.
- Aucun compte, service, evaluation, badge en ligne ou message fictif n'est ajoute.
- Les photos des maquettes sont des exemples : une photo n'apparait que si Taskly la fournit reellement.
- Les 4 visuels servent de cible; la fidelite au pixel depend des dimensions reelles et du HTML actuel.
- Les commandes d'appel et le nouveau son du pack V1 sont conserves.

PREREQUIS : installer d'abord le precedent pack 'Taskly Call Premium V1'.

INSTALLATION dans C:\Users\ahsah\Taskly-V8-Git :
1. Decompresser le ZIP dans le dossier racine de Taskly.
2. node scripts/install-taskly-pro-design-v2.cjs
3. node --test tests/taskly-pro-design-v2.test.cjs
4. npm run check
5. npm test
6. git diff --check
7. Verifier la messagerie sur ordinateur + sur mobile, puis publier si valide.

RETOUR EN ARRIERE (sans modifier la logique des appels) :
node scripts/rollback-taskly-pro-design-v2.cjs

AUCUN PUSH GITHUB AUTOMATIQUE.
