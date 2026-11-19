
'use strict';

// =========================================
// TASKLY ASSISTANT - INTELLIGENCE ARTIFICIELLE
// =========================================

// Informations générales autorisées.
// Aucune donnée personnelle ni donnée TiDB.

const THEMES = Object.freeze({

  recherche:
    'Pour trouver un artisan, consulter les profils et filtrer par métier et localisation.',

  demandes:
    'Les utilisateurs connectés peuvent consulter leurs demandes et leur statut dans leur espace personnel.',

  verification:
    'Le code de vérification est valable 3 minutes et permet 3 tentatives. Vérifier le dossier Spam si nécessaire.',

  session:
    'La session expire après 4 heures consécutives d’inactivité. Il faut alors se reconnecter.',

  support:
    'En cas de problème, contacter le support Taskly. Ne jamais communiquer de mot de passe ni de code de vérification.',

  inscription:
    'Pour créer un compte, utiliser le formulaire d’inscription de Taskly.'

});

// LANGUES AUTORISEES

const LANGUES = Object.freeze({
  fr: 'français',
  ar: 'arabe',
  dz: 'darija algérienne'
});

// Seules les 18 combinaisons publiques thème/langue sont mémorisées.
// Aucun identifiant, texte libre ou résultat personnel n'entre dans ce cache.
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();
const enCours = new Map();

// GENERATION SECURISEE DES REPONSES

async function genererReponse(theme, langue = 'fr') {

  // Protection des données personnelles

  if (
    typeof theme !== 'string' ||
    !Object.hasOwn(THEMES, theme) ||
    typeof langue !== 'string' ||
    !Object.hasOwn(LANGUES, langue)
  ) {
    return null;
  }

  const cle = process.env.GROQ_API_KEY;

  if (!cle) return null;

  const key = `${theme}:${langue}`;
  const precedent = cache.get(key);
  if (precedent && precedent.expire > Date.now()) return precedent.texte;
  cache.delete(key);
  if (enCours.has(key)) return enCours.get(key);

  const travail = interrogerGroq(theme, langue, cle).then(texte => {
    if (texte) cache.set(key, { texte, expire: Date.now() + CACHE_TTL });
    return texte;
  }).finally(() => enCours.delete(key));
  enCours.set(key, travail);
  return travail;
}

async function interrogerGroq(theme, langue, cle) {
  try {

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',

        redirect: 'error',

        headers: {
          Authorization: `Bearer ${cle}`,
          'Content-Type': 'application/json'
        },

        signal: AbortSignal.timeout(6000),

        body: JSON.stringify({

          model: 'openai/gpt-oss-20b',

          messages: [

            {
              role: 'system',

              content:
                'Tu es Taskly Assistant. Reformule uniquement le fait fourni en deux ou trois phrases courtes et utiles. N’invente aucune fonctionnalité, donnée ou procédure. Réponds en ' +
                LANGUES[langue] + '.'
            },

            {
              role: 'user',
              content: THEMES[theme]
            }

          ],

          reasoning_effort: 'low',
          max_completion_tokens: 500,
          temperature: 0.3

        })
      }
    );

    if (!response.ok) return null;

    const data = await response.json();

    const texte = data.choices?.[0]?.message?.content;

    return typeof texte === 'string' && texte.trim()
      ? texte.trim().slice(0, 1800)
      : null;

  } catch {

    return null;

  }
}

module.exports = { genererReponse };
