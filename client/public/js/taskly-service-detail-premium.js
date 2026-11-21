/* Taskly : présentation de la seule page Détail d'un service.
   Le catalogue, la connexion, les demandes, le header et le footer restent inchangés. */
(() => {
  'use strict';

  const detail = document.getElementById('service-detail');
  const grid = document.getElementById('service-artisans');
  if (!detail || !grid) return;

  const svg = (paths, className = '') => {
    const span = document.createElement('span');
    span.className = `tsd-svg ${className}`.trim();
    // Ces SVG sont des constantes internes, jamais du contenu issu de l'API.
    span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
    return span;
  };

  const paths = {
    back: '<path d="m15 18-6-6 6-6"/><path d="M9 12h12"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    snow: '<path d="M12 2v20M3.34 7l17.32 10M3.34 17 20.66 7"/><path d="m8.5 4 3.5 3.5L15.5 4M8.5 20l3.5-3.5 3.5 3.5M3 10l4.8-1.4 1.3-4.8M21 14l-4.8 1.4-1.3 4.8"/>',
    truck: '<rect x="2" y="6" width="12" height="11" rx="1"/><path d="M14 9h4l4 5v3h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    tool: '<path d="M14 6a5 5 0 0 0-6 6L3 17a3 3 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4Z"/>',
    zap: '<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
    person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    addUser: '<circle cx="10" cy="7" r="4"/><path d="M2 21v-2a8 8 0 0 1 12-7M19 13v8m-4-4h8"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    star: '<path d="m12 3 2.9 6 6.6.9-4.8 4.7 1.1 6.6-5.8-3.1-5.8 3.1 1.1-6.6-4.8-4.7 6.6-.9L12 3Z"/>',
    chat: '<path d="M21 11a8 8 0 0 1-8 8H4l2-5a8 8 0 1 1 15-3Z"/>',
    document: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    right: '<path d="M5 12h14m-6-6 6 6-6 6"/>'
  };

  function element(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function serviceSymbol(name) {
    const n = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (n.includes('carrel')) return paths.layers;
    if (n.includes('climatis')) return paths.snow;
    if (n.includes('demenag') || n.includes('transport')) return paths.truck;
    if (n.includes('electric')) return paths.zap;
    return paths.tool;
  }

  function enhanceDetail() {
    if (detail.querySelector('.tsd-layout')) return;
    const original = detail.querySelector('.service-detail-hero');
    if (!original) return;
    const name = original.querySelector('h1')?.textContent?.trim();
    const description = original.querySelector('.lead')?.textContent?.trim();
    const image = original.querySelector('img');
    if (!name || !image) return;
    const badges = Array.from(original.querySelectorAll('.service-stats .badge'));

    const layout = element('div', 'tsd-layout');
    const back = element('a', 'tsd-back', 'Retour aux services');
    back.href = '/services.html';
    back.prepend(svg(paths.back));
    layout.append(back);

    const hero = element('section', 'tsd-hero');
    hero.setAttribute('aria-label', `Présentation du service ${name}`);
    const media = element('div', 'tsd-hero-media');
    // Conserve l'image de service fournie par le code existant et son gestionnaire d'erreur.
    const photo = image.cloneNode(true);
    photo.className = 'tsd-hero-photo';
    photo.decoding = 'async';
    media.append(photo);
    hero.append(media);

    const body = element('div', 'tsd-hero-body');
    const emblem = element('div', 'tsd-emblem');
    emblem.append(svg(serviceSymbol(name)));
    body.append(emblem);
    const info = element('div', 'tsd-hero-copy');
    info.append(element('span', 'tsd-eyebrow', 'Service Taskly'));
    info.append(element('h1', '', name));
    if (description) {
      const lead = element('p', 'tsd-lead', description);
      lead.prepend(svg(serviceSymbol(name)));
      info.append(lead);
    }
    const stats = element('div', 'tsd-hero-stats');
    badges.forEach((badge, index) => {
      const pill = element('span', 'tsd-stat', badge.textContent.trim());
      pill.prepend(svg([paths.person, paths.calendar, paths.star, paths.chat][index] || paths.layers));
      stats.append(pill);
    });
    info.append(stats);
    body.append(info);
    hero.append(body);
    layout.append(hero);

    const cards = element('div', 'tsd-info-grid');
    const descriptionCard = element('section', 'tsd-info-card tsd-description');
    const dHeading = element('h2', 'tsd-card-heading', 'Description du service');
    dHeading.prepend(svg(paths.document));
    descriptionCard.append(dHeading);
    descriptionCard.append(element('p', 'tsd-description-text', description || 'Aucune description supplémentaire disponible pour ce service.'));
    cards.append(descriptionCard);

    const registerCard = element('section', 'tsd-info-card tsd-registration');
    const rHeading = element('h2', 'tsd-card-heading', 'Créer un compte artisan');
    rHeading.prepend(svg(paths.addUser));
    registerCard.append(rHeading);
    // Route d'inscription artisan existante, vérifiée dans become-artisan.html.
    const register = element('a', 'tsd-register-button', 'Créer un compte artisan');
    register.href = '/become-artisan.html';
    register.prepend(svg(paths.addUser));
    registerCard.append(register);
    cards.append(registerCard);
    layout.append(cards);

    // Un seul remplacement dans la page Détail. Le JS qui charge l'API reste intact.
    detail.replaceChildren(layout);
    document.body.setAttribute('data-taskly-service-detail-premium', '1');
    detail.dataset.tsdServiceId = new URLSearchParams(location.search).get('id') || '';
    decorateArtisans();
  }

  let headingDone = false;
  function decorateArtisans() {
    if (!document.body.hasAttribute('data-taskly-service-detail-premium')) return;
    const section = grid.closest('section');
    if (!section) return;
    section.classList.add('tsd-artisans-section');
    const heading = section.querySelector('.section-heading');
    if (!heading) return;
    heading.classList.add('tsd-artisans-heading');
    const title = heading.querySelector('h2');
    const count = grid.querySelectorAll(':scope > .artisan-card').length;
    if (title) title.textContent = `Artisans disponibles (${count})`;
    if (!headingDone) {
      const link = element('a', 'tsd-view-all', 'Voir tous les artisans');
      const id = new URLSearchParams(location.search).get('id');
      link.href = id ? `/artisans.html?serviceId=${encodeURIComponent(id)}` : '/artisans.html';
      link.append(svg(paths.right));
      heading.append(link);
      headingDone = true;
    }
  }

  // Observe seulement les deux zones déjà utilisées par les scripts existants.
  const detailObserver = new MutationObserver(() => enhanceDetail());
  const artisansObserver = new MutationObserver(() => decorateArtisans());
  detailObserver.observe(detail, { childList: true });
  artisansObserver.observe(grid, { childList: true });
  enhanceDetail();
})();
