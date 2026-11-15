
(() => {
  'use strict';

  if (window.top !== window.self ||
      document.getElementById('taskly-assistant')) return;

  async function init() {
    if (document.getElementById('taskly-assistant')) return;

    const role = document.body.dataset.requireRole;

    const publicPages = /^\/(?:index|artisans|artisan-profile|services|service|about|contact|help)\.html$/;

    if (!['admin','client','artisan'].includes(role) &&
        !publicPages.test(location.pathname) &&
        location.pathname !== '/') return;

    const user = await attendreSession();

    if (role && user?.role !== role) return;

    if (document.getElementById('taskly-assistant')) return;

    const admin = role === 'admin' && user?.role === 'admin';

    const workspace = ['client','artisan'].includes(user?.role)
      ? '/espace/' + user.role : '';

    const support = workspace
      ? workspace + '/support'
      : '/contact.html';

    // ICÔNES SVG

    const paths = {
      bot: '<rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4M2 12v4M22 12v4M9 16h6"/><circle cx="8" cy="12" r=".9" fill="currentColor"/><circle cx="16" cy="12" r=".9" fill="currentColor"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
      list: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/>',
      shield: '<path d="M12 2 3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6l-9-4Z M8 12l3 3 5-6"/>',
      support: '<path d="M3 14v-3a9 9 0 0 1 18 0v3M3 12h4v7H5a2 2 0 0 1-2-2v-5ZM21 12h-4v7h2a2 2 0 0 0 2-2v-5ZM19 19c0 2-3 3-7 3"/>',
      chart: '<path d="M3 3v18h18M7 16v-5M12 16V6M17 16V9"/>',
      users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3M17 4a4 4 0 0 1 0 8M19 14a5 5 0 0 1 3 4v3"/>',
      alert: '<path d="M12 3 2 21h20L12 3Z M12 9v5M12 17h.01"/>',
      next: '<path d="m9 6 6 6-6 6"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>',
      reset: '<path d="M3 10a9 9 0 1 1 2 9M3 4v6h6"/>',
      expand: '<path d="M14 3h7v7M21 3l-7 7M10 21H3v-7M3 21l7-7"/>',
      send: '<path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"/>'
    };

    const icon = name => `
      <svg viewBox="0 0 24 24"
           fill="none"
           stroke="currentColor"
           stroke-width="1.8"
           stroke-linecap="round"
           stroke-linejoin="round"
           aria-hidden="true">
        ${paths[name]}
      </svg>
    `;

    // OPTIONS SELON LE TYPE DE COMPTE

    const topics = admin ? [
      ['chart', 'Statistiques générales', 'Consulter les données de Taskly'],
      ['shield', 'Vérifications', 'Artisans en attente de validation'],
      ['users', 'Utilisateurs', 'Consulter les inscriptions'],
      ['alert', 'Signalements', 'Consulter le nombre de signalements']
    ] : [
      [
        user?.role === 'artisan' ? 'list' : 'search',
        user?.role === 'artisan' ? 'Mon profil artisan' : 'Trouver un artisan',
        user?.role === 'artisan' ? 'Gérer mon profil professionnel' : 'Rechercher un professionnel'
      ],
      ['list', 'Mes demandes', 'Suivre mes prestations'],
      ['shield', 'Compte et sécurité', 'Connexion et vérification'],
      ['support', 'Assistance Taskly', 'Contacter notre équipe']
    ];

    const host = document.createElement('div');
    host.id = 'taskly-assistant';

    const root = host.attachShadow({ mode: 'open' });

    root.innerHTML = `
      <style>

        :host {
          position: fixed;
          right: 24px;
          bottom: 24px;
          z-index: 1000;
          font-family: inherit;
          color: #17352e;
          font-size: 14px;
          line-height: 1.5;
        }

        * {
          box-sizing: border-box;
        }

        [hidden] {
          display: none !important;
        }

        button, input {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        button:disabled {
          cursor: default;
          opacity: .6;
        }

        button:focus-visible,
        input:focus-visible,
        a:focus-visible {
          outline: 3px solid #55b99d;
          outline-offset: 3px;
        }

        svg {
          width: 22px;
          height: 22px;
          display: block;
          flex: none;
        }

        /* BOUTON FLOTTANT */

        .launch {
          display: grid;
          place-items: center;
          margin-left: auto;
          width: 62px;
          height: 62px;
          border: 0;
          border-radius: 50%;
          background: #087e63;
          color: white;
          box-shadow: 0 8px 24px #063b3040;
          transition: transform .18s;
        }

        .launch svg {
          width: 32px;
          height: 32px;
        }

        .launch:hover {
          transform: translateY(-3px);
        }

        /* FENÊTRE PRINCIPALE */

        .panel {
          width: min(390px, calc(100vw - 48px));
          height: min(620px, calc(100dvh - 115px));
          display: flex;
          flex-direction: column;
          margin-bottom: 14px;
          overflow: hidden;
          background: #f7f9f8;
          border: 1px solid #dce7e1;
          border-radius: 22px;
          box-shadow: 0 18px 60px #103b302b;
          animation: appear .18s ease-out;
        }

        .panel.large {
          width: min(620px, calc(100vw - 48px));
          height: min(760px, calc(100dvh - 115px));
        }

        @keyframes appear {
          from {
            opacity: 0;
            transform: translateY(10px);
          }

          to {
            opacity: 1;
            transform: none;
          }
        }

        /* EN-TÊTE */

        header {
          flex: none;
          background: linear-gradient(145deg, #073b30, #0d5544);
          color: white;
          padding: 20px 20px 22px;
        }

        .top {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .avatar {
          display: grid;
          place-items: center;
          flex: none;
          width: 44px;
          height: 44px;
          background: white;
          color: #087e63;
          border-radius: 50%;
        }

        .avatar svg {
          width: 28px;
          height: 28px;
        }

        .brand {
          flex: 1;
          min-width: 0;
        }

        .brand strong {
          display: block;
          font-size: 17px;
          letter-spacing: -.3px;
        }

        .brand small {
          font-size: 11px;
          color: #b9e4d6;
        }

        .dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #7be0b3;
          margin-right: 5px;
        }

        .tool {
          display: grid;
          place-items: center;
          padding: 4px;
          background: transparent;
          border: 0;
          color: white;
          border-radius: 7px;
        }

        .tool svg {
          width: 17px;
          height: 17px;
        }

        .tool:hover {
          background: #ffffff20;
        }

        .welcome {
          padding-top: 20px;
        }

        .welcome h2 {
          font-size: 26px;
          line-height: 1.2;
          margin: 0 0 7px;
          font-weight: 700;
          letter-spacing: -.5px;
          color: white;
        }

        .welcome p {
          margin: 0;
          color: #dbece6;
          font-size: 13px;
        }

        /* CARTES D'ASSISTANCE */

        .content {
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: 16px;
          overscroll-behavior: contain;
        }

        .eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .045em;
          color: #637c72;
          margin: 0 0 12px;
          text-transform: uppercase;
        }

        .topics {
          display: grid;
          gap: 9px;
        }

        .topic {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          text-align: left;
          padding: 12px;
          border: 1px solid #dce7e1;
          background: white;
          border-radius: 14px;
          color: #18362d;
          transition: border-color .15s, background .15s;
        }

        .topic:hover {
          background: #f0faf5;
          border-color: #8bc6b1;
        }

        .tile {
          display: grid;
          place-items: center;
          width: 42px;
          height: 42px;
          flex: none;
          background: #e5f2eb;
          color: #087e63;
          border-radius: 11px;
        }

        .label {
          flex: 1;
          min-width: 0;
        }

        .label strong {
          display: block;
          font-size: 14px;
        }

        .label small {
          display: block;
          color: #667b72;
          font-size: 11.5px;
          margin-top: 2px;
        }

        .chevron {
          color: #72968a;
        }

        .chevron svg {
          width: 17px;
          height: 17px;
        }

        /* CONVERSATION */

        .messages {
          display: flex;
          flex-direction: column;
          gap: 13px;
        }

        .line {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .mini {
          display: grid;
          place-items: center;
          flex: none;
          width: 30px;
          height: 30px;
          background: #e1f1e9;
          color: #087e63;
          border-radius: 50%;
        }

        .mini svg {
          width: 19px;
          height: 19px;
        }

        .bubble {
          max-width: 86%;
          padding: 12px 14px;
          background: #e7f0ea;
          border-radius: 4px 15px 15px 15px;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          font-size: 13px;
        }

        .line.mine {
          justify-content: flex-end;
        }

        .mine .bubble {
          border-radius: 15px 15px 4px 15px;
          background: #087e63;
          color: white;
        }
        

        .bubble a {
          display: block;
          margin-top: 9px;
          font-weight: 700;
          color: #075a44;
        }

        /* ZONE DE SAISIE */

        footer {
          flex: none;
          padding: 10px 14px 12px;
          background: #f7f9f8;
          border-top: 1px solid #e3ebe6;
        }

        .composer {
          display: flex;
          gap: 8px;
          padding: 5px;
          background: white;
          border: 1px solid #d6e5dd;
          border-radius: 14px;
        }

        input {
          flex: 1;
          min-width: 0;
          border: 0;
          padding: 10px;
          background: transparent;
          color: #17352e;
          font-size: 13px;
        }

        .send {
          display: grid;
          place-items: center;
          width: 41px;
          height: 41px;
          border: 0;
          border-radius: 10px;
          background: #087e63;
          color: white;
        }

        .send svg {
          width: 20px;
          height: 20px;
        }

        .credit {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 5px;
          color: #6c8279;
          font-size: 11px;
          margin: 10px 0 0;
        }

        .credit svg {
          width: 14px;
          height: 14px;
          color: #087e63;
        }

        /* VERSION MOBILE */

        @media (max-width: 480px) {
          :host {
            right: 12px;
            bottom: 12px;
          }

          .panel,
          .panel.large {
            width: calc(100vw - 24px);
            height: min(620px, calc(100dvh - 98px));
          }

          header {
            padding: 16px;
          }

          .welcome {
            padding-top: 15px;
          }

          .content {
            padding: 13px;
          }

          .launch {
            width: 56px;
            height: 56px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
            transition: none !important;
          }
        }

      </style>

      <section class="panel"
               aria-label="Taskly Assistant"
               id="panel"
               hidden>

        <header>
          <div class="top">

            <span class="avatar">
              ${icon('bot')}
            </span>

            <div class="brand">
              <strong>Taskly Assistant</strong>

              <small>
                <span class="dot"></span>
                ${admin
                  ? 'Assistant de l’administration'
                  : 'Assistant virtuel'}
              </small>
            </div>

            <button class="tool reset"
                    type="button"
                    title="Nouvelle conversation"
                    aria-label="Nouvelle conversation">
              ${icon('reset')}
            </button>

            <button class="tool expand"
                    type="button"
                    title="Agrandir ou réduire"
                    aria-label="Agrandir ou réduire"
                    aria-pressed="false">
              ${icon('expand')}
            </button>

            <button class="tool close"
                    type="button"
                    aria-label="Fermer">
              ${icon('close')}
            </button>

          </div>

          <div class="welcome">

            <h2>
              ${admin
                ? 'Bonjour, administrateur !'
                : 'Bonjour ! 👋'}
            </h2>

            <p>
              Comment puis-je vous aider aujourd’hui ?
            </p>

          </div>

        </header>

        <div class="content">

          <div class="home">

            <p class="eyebrow">
              Comment puis-je vous aider ?
            </p>

            <div class="topics">

              ${topics.map(([i, t, s]) => `
                <button type="button" class="topic">

                  <span class="tile">
                    ${icon(i)}
                  </span>

                  <span class="label">
                    <strong>${t}</strong>
                    <small>${s}</small>
                  </span>

                  <span class="chevron">
                    ${icon('next')}
                  </span>

                </button>
              `).join('')}

            </div>

          </div>

          <div class="messages"
               role="log"
               aria-live="polite"
               hidden>
          </div>

        </div>

        <footer>

          <form class="composer">

            <input aria-label="Votre question"
                   placeholder="Écrivez votre message…"
                   maxlength="300"
                   required>

            <button type="submit"
                    class="send"
                    aria-label="Envoyer">
              ${icon('send')}
            </button>

          </form>

          <div class="credit">
            ${icon('shield')}
            Taskly · Votre assistant virtuel
          </div>

        </footer>

      </section>

      <button class="launch"
              type="button"
              aria-label="Ouvrir Taskly Assistant"
              aria-controls="panel"
              aria-expanded="false">
        ${icon('bot')}
      </button>
    `;

    document.body.appendChild(host);

    const $ = s => root.querySelector(s);

    const panel = $('.panel');
    const launch = $('.launch');
    const input = $('input');
    const messages = $('.messages');

    let busy = false;
    let generation = 0;
    // Mémoire conversationnelle
    let previousTopic = '';

    function scroll() {
      const area = $('.content');
      area.scrollTop = area.scrollHeight;
    }

    function message(text, mine = false, link) {

      const line = document.createElement('div');

      line.className = 'line' + (mine ? ' mine' : '');

      if (!mine) {
        const mini = document.createElement('span');
        mini.className = 'mini';
        mini.innerHTML = icon('bot');
        line.append(mini);
      }

      const bubble = document.createElement('div');

      bubble.className = 'bubble';
      bubble.textContent = text;

      if (link) {
        const a = document.createElement('a');
        a.href = link[1];
        a.textContent = link[0];
        bubble.append(a);
      }

      line.append(bubble);
      messages.append(line);

      scroll();

      return line;
    }

    const norm = s => s.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const count = v =>
      v !== null &&
      v !== undefined &&
      v !== '' &&
      Number.isSafeInteger(Number(v)) &&
      Number(v) >= 0
        ? Number(v).toLocaleString('fr-FR')
        : 'indisponible';

    // TRAITEMENT DES QUESTIONS

    async function answer(question) {

      const q = norm(question);

// MEMOIRE CONVERSATIONNELLE

if (!admin) {

  const followup = q.trim();

  if (/combien de temps|quelle duree/.test(followup) &&
      !/code|session|inactivite/.test(followup)) {

    if (previousTopic === 'code') {
      return [
        'Votre code de verification est valable pendant 3 minutes.'
      ];
    }

    if (previousTopic === 'session') {
      return [
        'Votre session expire apres 4 heures consecutives d’inactivite.'
      ];
    }
  }

  if (/combien.*(tentative|essai)/.test(followup) &&
      previousTopic === 'code') {

    return [
      'Vous disposez de 3 tentatives de verification.'
    ];
  }

  // Memoriser le sujet actuel

  if (/code|spam|verification/.test(q)) {

    previousTopic = 'code';

  } else if (/session|inactivite|deconnect/.test(q)) {

    previousTopic = 'session';

  } else {

    previousTopic = '';

  }
}

      

      // ASSISTANT ADMINISTRATION

      if (admin) {

        if (/verification|validation|artisan.*attente/.test(q)) {

          const data = await requeteAPI(
            '/api/admin/stats/inscriptions?periode=7j'
          );

          return [
            'Artisans en attente de validation : ' +
            count(data.artisansEnAttente)
          ];
        }

        const fields = [
          ['Clients', 'totalClients', 'client'],
          ['Artisans', 'totalArtisans', 'artisan'],
          ['Utilisateurs', 'totalUsers', 'utilisateur'],
          ['Demandes', 'totalDemandes', 'demande'],
          ['Signalements', 'totalSignalements', 'signalement'],
          ['Messages support', 'totalContactsSupport', 'support']
        ];

        const chosen = fields.filter(
          f => q.includes(f[2])
        );

        if (
          chosen.length ||
          /statistique|nombre|combien|total|inscri/.test(q)
        ) {

          const data = await requeteAPI('/api/admin/stats');

          return [
            (chosen.length ? chosen : fields)
              .map(([label, key]) =>
                label + ' : ' + count(data.statistiques?.[key])
              )
              .join('\n')
          ];
        }

        return [
          'Je peux consulter les statistiques, les vérifications et les compteurs de Taskly. Je ne modifie aucune donnée.'
        ];
      }

      // ASSISTANT CLIENT ET ARTISAN
      
// Expiration de session
if (/session.*expir|deconnecte|inactivite/.test(q)) {
  return [
    'Pour votre sécurité, Taskly ferme votre session après 4 heures consécutives d’inactivité. Vous devez vous reconnecter.',
    ['Se reconnecter', '/login.html']
  ];
}

// Code de vérification expiré ou incorrect
if (/code.*(expir|incorrect|invalide|refus|marche pas)/.test(q)) {
  return [
    'Votre code est valable pendant 3 minutes et vous disposez de 3 tentatives. Demandez un nouveau code si nécessaire.'
  ];
}

// Mot de passe oublié
if (/mot de passe/.test(q) &&
    /oubli|perdu|reinitialis/.test(q)) {
  return [
    'Contactez le support Taskly pour obtenir de l’aide. Ne communiquez jamais votre mot de passe.',
    ['Contacter le support', support]
  ];
}

// Compte bloqué
if (/compte.*(bloqu|suspend|desactiv)/.test(q)) {
  return [
    'Si votre compte est bloqué, contactez le support Taskly afin de connaître la procédure à suivre.',
    ['Contacter le support', support]
  ];
}


      if (/code|spam|verification/.test(q)) {

        return [
          'Vérifiez votre adresse e-mail et le dossier Spam. Le code est valable 3 minutes. Demandez un nouveau code si nécessaire.'
        ];
      }

      if (
        /profil.*artisan/.test(q) &&
        user?.role === 'artisan'
      ) {

        return [
          'Vous pouvez gérer votre profil professionnel depuis votre espace.',
          ['Ouvrir mon profil', workspace + '/profil']
        ];
      }

      if (/aide|support|contact|assistance|administration/.test(q)) {

        return [
          'Notre équipe peut vous aider.',
          ['Contacter le support', support]
        ];
      }

      if (/demande|suivi|suivre|prestation/.test(q)) {

        return [
          'Consultez vos prestations et leurs statuts depuis votre espace.',
          [
            'Mes demandes',
            workspace
              ? workspace + '/demandes'
              : '/login.html'
          ]
        ];
      }

      if (/inscription|inscrire|creer.*compte/.test(q)) {

        return [
          'Créez votre compte Taskly.',
          ['S’inscrire', '/register.html']
        ];
      }

      if (/trouver|chercher|recherch|artisan|plombier|electricien/.test(q)) {

        return [
          'Choisissez le métier et la localisation pour trouver un professionnel.',
          ['Rechercher un artisan', '/artisans.html']
        ];
      }

      if (/compte|securite|connexion|mot de passe|session/.test(q)) {

        return [
          'Vous avez un problème de connexion ou de réception du code ? Décrivez-le sans communiquer votre mot de passe ni votre code.',
          ['Centre d’aide', '/help.html']
        ];
      }

      if (/bonjour|salut|merci/.test(q)) {

        return [
          'Je suis là pour vous aider à utiliser Taskly.'
        ];
      }

      return [
        'Je ne reconnais pas encore cette question. Notre support peut vous aider.',
        ['Contacter le support', support]
      ];
    }

    // ENVOI DES MESSAGES

    async function send(text) {

      const q = text.trim().slice(0, 300);

      if (!q || busy) return;

      const current = ++generation;

      busy = true;
      input.value = '';

      $('.home').hidden = true;
      $('.welcome').hidden = true;
      messages.hidden = false;
      $('.send').disabled = true;

      message(q, true);

     
const pending = message('');

const typing = pending.querySelector('.bubble');

typing.classList.add('typing');

typing.setAttribute(
  'aria-label',
  'Taskly Assistant prépare sa réponse'
);

typing.innerHTML = '<span></span><span></span><span></span>';

await new Promise(resolve => setTimeout(resolve, 800));

if (current !== generation) return;


      try {

        const [reply, link] = await answer(q);

        if (current === generation) {
          pending.remove();
          
message(reply, false, link);

// Suggestions contextuelles
messages.querySelector('.assistant-followups')?.remove();

let suggestions;

if (admin) {

  suggestions = [
    'Statistiques générales',
    'Nombre de clients',
    'Artisans en attente de validation',
    'Nombre de signalements'
  ];

} else if (/connexion|securite|code|compte|session|mot de passe/.test(norm(q))) {

  suggestions = [
    'Je ne reçois pas mon code',
    'Mon code a expiré',
    'Mot de passe oublié'
  ];

} else if (/artisan|recherche|trouver/.test(norm(q))) {

  suggestions = [
    'Comment trouver un artisan ?',
    'Comment suivre ma demande ?',
    'Contacter le support'
  ];

} else {

  suggestions = [
    'Comment suivre ma demande ?',
    'Pourquoi ma session a expiré ?',
    'Contacter le support'
  ];

}

const followups = document.createElement('div');
followups.className = 'topics assistant-followups';

const title = document.createElement('p');
title.className = 'eyebrow';
title.textContent = 'Questions suggérées';

followups.appendChild(title);

suggestions
  .filter(s => norm(s) !== norm(q))
  .forEach(s => {

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'topic';

    button.textContent = s;

    button.addEventListener('click', () => {
      if (busy) return;
      followups.remove();
      send(s);
    });

    followups.appendChild(button);

  });

messages.appendChild(followups);
scroll();

        }

      } catch (e) {

        if (current === generation) {

          pending.remove();

          message(
            e.status === 401 || e.status === 403
              ? 'Session expirée ou accès refusé. Reconnectez-vous.'
              : 'Informations momentanément indisponibles. Réessayez.'
          );
        }

      } finally {

        if (current === generation) {
          busy = false;
          $('.send').disabled = false;
        }
      }
    }

    // NOUVELLE CONVERSATION

    function reset() {
      previousTopic = '';

      generation++;
      busy = false;

      $('.send').disabled = false;

      input.value = '';

      messages.replaceChildren();
      messages.hidden = true;

      $('.home').hidden = false;
      $('.welcome').hidden = false;
      $('.content').scrollTop = 0;
    }

    // OUVERTURE ET FERMETURE

    function toggle(open) {

      panel.hidden = !open;

      launch.setAttribute(
        'aria-expanded',
        String(open)
      );

      launch.setAttribute(
        'aria-label',
        open
          ? 'Fermer Taskly Assistant'
          : 'Ouvrir Taskly Assistant'
      );

      if (open) input.focus();
      else launch.focus();
    }

    root.querySelectorAll('.topic')
      .forEach((b, i) => {
        b.addEventListener('click', () => {
          send(topics[i][1]);
        });
      });

    $('.reset').addEventListener('click', reset);

    $('.close').addEventListener('click', () => {
      toggle(false);
    });

    $('.expand').addEventListener('click', () => {

      $('.expand').setAttribute(
        'aria-pressed',
        String(panel.classList.toggle('large'))
      );
    });

    launch.addEventListener('click', () => {
      toggle(panel.hidden);
    });

    root.addEventListener('keydown', e => {

      if (e.key === 'Escape' && !panel.hidden) {
        toggle(false);
      }
    });

    $('form').addEventListener('submit', e => {
      e.preventDefault();
      send(input.value);
    });
  }

  const start = () => init().catch(e => {
    console.warn('Taskly Assistant indisponible', e);
  });

  if (document.readyState === 'loading') {

    document.addEventListener(
      'DOMContentLoaded',
      start,
      { once: true }
    );

  } else {
    start();
  }

})();
