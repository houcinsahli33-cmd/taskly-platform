/* Taskly Mail mobile: true workspace drawer, scoped to the two Mail pages only.
   Does not replace site navigation, login, mailbox or message handlers. */
(function () {
  'use strict';
  function init() {
    if (document.body.dataset.workspacePage !== 'taskly-mail') return;
    const shell = document.querySelector('.dashboard-shell');
    const sidebar = shell && shell.querySelector(':scope > aside.sidebar');
    const content = shell && shell.querySelector(':scope > .dashboard-content.tm-page');
    if (!sidebar || !content || document.getElementById('tm-workspace-mobile-head')) return;

    const media = window.matchMedia('(max-width: 767px)');
    const title = (sidebar.querySelector('.sidebar-title')?.textContent || 'Espace Taskly').trim();
    sidebar.id = sidebar.id || 'tm-workspace-sidebar';

    const head = document.createElement('div');
    head.id = 'tm-workspace-mobile-head';
    head.className = 'tm-workspace-mobile-head';
    const openButton = document.createElement('button');
    openButton.type = 'button';
    openButton.className = 'tm-workspace-menu-toggle';
    openButton.setAttribute('aria-label', 'Ouvrir le menu ' + title);
    openButton.setAttribute('aria-expanded', 'false');
    openButton.setAttribute('aria-controls', sidebar.id);
    openButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    const headTitle = document.createElement('div');
    headTitle.className = 'tm-workspace-mobile-title';
    headTitle.textContent = 'Taskly Mail';
    const headArea = document.createElement('span');
    headArea.className = 'tm-workspace-mobile-area';
    headArea.textContent = title;
    head.append(openButton, headTitle, headArea);
    content.prepend(head);

    const drawerBrand = document.createElement('div');
    drawerBrand.className = 'tm-workspace-drawer-brand';
    const brandImage = document.createElement('img');
    brandImage.src = '/images/logo/taskly-logo.svg';
    brandImage.alt = '';
    brandImage.width = 125;
    brandImage.height = 40;
    const brandLabel = document.createElement('strong');
    brandLabel.textContent = 'taskly';
    brandImage.addEventListener('load', () => { brandLabel.hidden = true; });
    brandImage.addEventListener('error', () => { brandImage.remove(); brandLabel.hidden = false; });
    drawerBrand.append(brandImage, brandLabel);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'tm-workspace-menu-close';
    closeButton.setAttribute('aria-label', 'Fermer le menu Taskly');
    closeButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    sidebar.prepend(drawerBrand, closeButton);

    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'tm-workspace-menu-backdrop';
    backdrop.tabIndex = -1;
    backdrop.setAttribute('aria-label', 'Fermer le menu Taskly');
    document.body.append(backdrop);

    function isOpen() { return document.body.classList.contains('tm-workspace-menu-open'); }
    function sync() {
      const narrow = media.matches;
      if (!narrow) document.body.classList.remove('tm-workspace-menu-open');
      sidebar.inert = narrow && !isOpen();
      openButton.setAttribute('aria-expanded', String(narrow && isOpen()));
      sidebar.setAttribute('aria-hidden', String(narrow && !isOpen()));
    }
    function open() {
      if (!media.matches) return;
      document.body.classList.add('tm-workspace-menu-open');
      sync();
      closeButton.focus();
    }
    function close(restoreFocus) {
      const hadOpen = isOpen();
      document.body.classList.remove('tm-workspace-menu-open');
      sync();
      if (hadOpen && restoreFocus && media.matches) openButton.focus();
    }
    openButton.addEventListener('click', () => isOpen() ? close(true) : open());
    closeButton.addEventListener('click', () => close(true));
    backdrop.addEventListener('click', () => close(true));
    sidebar.addEventListener('click', (event) => {
      if (event.target.closest('a, [data-logout]')) close(false);
    });
    document.addEventListener('keydown', (event) => {
      if (!media.matches || !isOpen()) return;
      if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
      if (event.key !== 'Tab') return;
      const available = Array.from(sidebar.querySelectorAll('button, a, [tabindex]'))
        .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
      if (!available.length) return;
      const first = available[0], last = available[available.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    if (media.addEventListener) media.addEventListener('change', () => close(false));
    else if (media.addListener) media.addListener(() => close(false));
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
