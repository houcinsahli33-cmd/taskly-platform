(() => {
  'use strict';

  const init = () => {
    const role = document.body.dataset.requireRole;
    if (!['client', 'artisan'].includes(role)) return;

    const shell = document.querySelector('.dashboard-shell');
    const sidebar = shell?.querySelector(':scope > .sidebar');
    if (!shell || !sidebar) return;
    if (shell.querySelector('.taskly-mobile-menu-toggle')) return;



    if (!sidebar.id) sidebar.id = 'taskly-mobile-sidebar';

    const overlay = document.createElement('div');
    overlay.className = 'taskly-mobile-menu-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'taskly-mobile-menu-toggle';
    toggle.setAttribute('aria-controls', sidebar.id);

    shell.append(overlay, toggle);

    const mobile = window.matchMedia('(max-width: 800px)');

    function setOpen(open) {
      const active = mobile.matches && open;
      document.body.classList.toggle(
        'taskly-mobile-menu-open', active
      );

      toggle.textContent = active ? '\u2039' : '\u203a';
      toggle.setAttribute('aria-expanded', String(active));
      toggle.setAttribute(
        'aria-label',
        active ? 'Fermer le menu' : 'Ouvrir le menu'
      );
      toggle.title = active ? 'Fermer le menu' : 'Ouvrir le menu';

      if ('inert' in sidebar) {
        sidebar.inert = mobile.matches && !active;
      }
    }

    setOpen(false);
    document.body.classList.add('taskly-mobile-ready');

    toggle.addEventListener('click', () => {
      const open = document.body.classList.contains(
        'taskly-mobile-menu-open'
      );
      setOpen(!open);
    });

    overlay.addEventListener('click', () => setOpen(false));

    sidebar.addEventListener('click', (event) => {
      if (event.target.closest('a[data-dashboard-link]')) {
        setOpen(false);
    document.body.classList.add('taskly-mobile-ready');
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' &&
          document.body.classList.contains(
            'taskly-mobile-menu-open'
          )) {
        setOpen(false);
    document.body.classList.add('taskly-mobile-ready');
        toggle.focus();
      }
    });

    mobile.addEventListener('change', () => setOpen(false));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {
      once: true
    });
  } else {
    init();
  }
})();
