/* Taskly Services : presentation des filtres V2 uniquement.
   Cette couche pilote les SELECT existants et declenche leurs events change.
   Aucun appel API, aucune modification du catalogue ou des cartes. */
(() => {
  "use strict";
  const page = document.body;
  if (!page || page.dataset.active !== "services") return;
  const svg = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const icons = {
    pin: svg('<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>'),
    // Four-leaf category pictogram requested by the user.
    category: svg('<path d="M10.9 10.9C6.2 10.5 4.1 8.3 4.3 5.9c.1-1.7 1.7-2.5 3.1-1.6 2 1.2 2.8 3.7 3.5 6.6ZM13.1 10.9c.4-4.7 2.6-6.8 5-6.6 1.7.1 2.5 1.7 1.6 3.1-1.2 2-3.7 2.8-6.6 3.5ZM13.1 13.1c4.7.4 6.8 2.6 6.6 5-.1 1.7-1.7 2.5-3.1 1.6-2-1.2-2.8-3.7-3.5-6.6ZM10.9 13.1c-.4 4.7-2.6 6.8-5 6.6-1.7-.1-2.5-1.7-1.6-3.1 1.2-2 3.7-2.8 6.6-3.5Z"/>'),
    sort: svg('<path d="m7 4-4 4 4 4M3 8h13M17 20l4-4-4-4M21 16H8"/>'),
    chevron: svg('<path d="m6 9 6 6 6-6"/>'),
    search: svg('<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>'),
    reset: svg('<path d="M3 11a9 9 0 1 1 2.2 6M3 4v7h7"/>')
  };
  const normalize = str => String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const states = [];
  let openState = null;
  const choices = [
    {id:"services-wilaya", title:"Sélectionner une wilaya", hint:"Rechercher une wilaya…", icon:"pin", searchable:true},
    {id:"services-category", title:"Sélectionner une catégorie", hint:"Rechercher une catégorie…", icon:"category", searchable:true},
    {id:"services-sort", title:"Trier les services", hint:"", icon:"sort", searchable:false}
  ];
  const search = document.getElementById("service-search");
  const info = document.getElementById("services-filter-info");
  const toolbar = document.querySelector(".taskly-search-v1-bottom");
  if (!toolbar || !info || !search || choices.some(c => !document.getElementById(c.id))) return;
  function makeButton(className, label, svgIcon) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = className;
    if (svgIcon) el.innerHTML = svgIcon;
    el.setAttribute("aria-label", label);
    return el;
  }
  function closeMenu(state, returnFocus = false) {
    if (!state || state.panel.hidden) return;
    state.panel.hidden = true;
    state.wrap.classList.remove("taskly-v2-open");
    state.trigger.setAttribute("aria-expanded", "false");
    if (openState === state) openState = null;
    if (returnFocus) state.trigger.focus();
  }
  function closeAll(except = null) {
    for (const s of states) if (s !== except) closeMenu(s);
  }
  function renderOptions(state) {
    state.options.replaceChildren();
    const text = normalize(state.filter?.value);
    const entries = [...state.select.options].filter(o => !o.disabled && (!text || normalize(o.textContent).includes(text)));
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "taskly-v2-empty";
      empty.textContent = "Aucun résultat";
      state.options.appendChild(empty);
      return;
    }
    for (const option of entries) {
      const btn = makeButton("taskly-v2-option", option.textContent, icons[state.config.icon]);
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", String(state.select.value === option.value));
      btn.dataset.value = option.value;
      const label = document.createElement("span");
      label.className = "taskly-v2-option-label";
      label.textContent = state.config.id === "services-wilaya" && !option.value ? "Toutes les wilayas" : option.textContent;
      btn.appendChild(label);
      if (state.select.value === option.value) {
        const check = document.createElement("span");
        check.className = "taskly-v2-check";
        check.textContent = "✓";
        check.setAttribute("aria-hidden", "true");
        btn.appendChild(check);
      }
      btn.addEventListener("click", () => choose(state, option.value));
      state.options.appendChild(btn);
    }
  }
  function updateTrigger(state) {
    const current = state.select.selectedOptions[0];
    state.value.textContent = state.config.id === "services-wilaya" && !state.select.value ? "Toutes les wilayas" : current?.textContent || state.select.options[0]?.textContent || "Choisir";
  }
  function choose(state, value) {
    state.select.value = value;
    updateTrigger(state);
    closeMenu(state, true);
    state.select.dispatchEvent(new Event("change", {bubbles: true}));
    renderSummary();
  }
  function openMenu(state) {
    if (!state.panel.hidden) {closeMenu(state);return;}
    closeAll(state);
    openState = state;
    state.panel.hidden = false;
    state.wrap.classList.add("taskly-v2-open");
    state.trigger.setAttribute("aria-expanded", "true");
    if (state.filter) state.filter.value = "";
    renderOptions(state);
    (state.filter || state.options.querySelector("button"))?.focus();
  }
  function enhance(config) {
    const select = document.getElementById(config.id);
    const original = select.closest(".taskly-search-v1-select");
    if (!original || original.classList.contains("taskly-v2-control")) return;
    // The original label is retained visually in the source. At runtime we
    // replace it with a DIV so a nested button remains valid HTML.
    let wrap = original;
    if (original.tagName === "LABEL") {
      wrap = document.createElement("div");
      wrap.className = original.className;
      while (original.firstChild) wrap.appendChild(original.firstChild);
      original.replaceWith(wrap);
    }
    wrap.classList.add("taskly-v2-control");
    if (config.id === "services-sort") wrap.classList.add("taskly-v2-sort");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    const trigger = makeButton("taskly-v2-trigger", select.getAttribute("aria-label") || config.title, icons[config.icon]);
    const value = document.createElement("span");
    value.className = "taskly-v2-value";
    trigger.append(value);
    trigger.insertAdjacentHTML("beforeend", `<span class="taskly-v2-caret">${icons.chevron}</span>`);
    const panel = document.createElement("div");
    panel.className = "taskly-v2-menu";
    panel.hidden = true;
    const panelId = `taskly-v2-panel-${config.id}`;
    panel.id = panelId;
    trigger.setAttribute("aria-controls", panelId);
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    const head = document.createElement("div");
    head.className = "taskly-v2-menu-head";
    const heading = document.createElement("span");
    heading.textContent = config.title;
    const close = makeButton("taskly-v2-menu-close", "Fermer le menu");
    close.textContent = "×";
    close.addEventListener("click", () => closeMenu(state, true));
    head.append(heading, close);
    panel.append(head);
    let filter = null;
    if (config.searchable) {
      const searchBox = document.createElement("div");
      searchBox.className = "taskly-v2-searchbox";
      searchBox.innerHTML = icons.search;
      filter = document.createElement("input");
      filter.type = "search";
      filter.placeholder = config.hint;
      filter.setAttribute("aria-label", config.hint);
      searchBox.append(filter);
      panel.append(searchBox);
    }
    const options = document.createElement("div");
    options.className = "taskly-v2-options";
    options.setAttribute("role", "listbox");
    options.setAttribute("aria-label", config.title);
    panel.append(options);
    wrap.append(trigger, panel);
    const state = {config,wrap,select,trigger,value,panel,filter,options};
    states.push(state);
    updateTrigger(state);
    trigger.addEventListener("click", () => openMenu(state));
    if (filter) filter.addEventListener("input", () => renderOptions(state));
    // Preserve the native SELECT as the one source of truth for all existing filters.
    select.addEventListener("change", () => {updateTrigger(state);renderSummary();});
    const mo = new MutationObserver(() => {updateTrigger(state); if (!state.panel.hidden) renderOptions(state);});
    mo.observe(select, {childList:true,subtree:true,characterData:true});
    panel.addEventListener("keydown", event => {
      if (event.key === "Escape") {event.preventDefault();closeMenu(state,true);return;}
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const buttons = [...options.querySelectorAll("button")];
        if (!buttons.length) return;
        event.preventDefault();
        const current = buttons.indexOf(document.activeElement);
        const next = event.key === "ArrowDown" ? Math.min(current+1,buttons.length-1) : Math.max(current-1,0);
        buttons[next < 0 ? 0 : next].focus();
      }
      if (event.key === "Enter" && event.target === filter) {
        const first = options.querySelector("button");
        if (first) {event.preventDefault();first.click();}
      }
    });
  }
  function anyFilters() {
    return Boolean(search.value.trim() || document.getElementById("services-wilaya").value || document.getElementById("services-category").value || document.getElementById("services-sort").value !== "pertinence" || document.querySelector('[data-service-filter][aria-pressed="true"]'));
  }
  function reset() {
    closeAll();
    search.value = "";
    for (const state of states) {
      state.select.value = state.config.id === "services-sort" ? "pertinence" : "";
      updateTrigger(state);
    }
    // Un seul changement "sort" suffit : le contrôleur de filtres existant
    // restaure le tri et désactive aussi Populaires / Mieux notés.
    document.getElementById("services-sort").dispatchEvent(new Event("change", {bubbles:true}));
    renderSummary();
  }
  const resetTop = makeButton("taskly-v2-reset", "Réinitialiser les filtres", icons.reset);
  resetTop.append(document.createTextNode("Réinitialiser"));
  resetTop.addEventListener("click", reset);
  toolbar.appendChild(resetTop);
  const summary = document.createElement("div");
  summary.className = "taskly-v2-summary";
  summary.hidden = true;
  summary.setAttribute("aria-label", "Filtres sélectionnés");
  info.insertAdjacentElement("afterend",summary);
  function renderSummary() {
    summary.replaceChildren();
    const active = anyFilters();
    summary.hidden = !active;
    if (!active) return;
    const count = document.createElement("span");
    count.className = "taskly-v2-count";
    count.textContent = info.textContent || "Résultats filtrés";
    summary.append(count);
    function chip(text,clear) {
      const b = makeButton("taskly-v2-chip",`Retirer : ${text}`);
      b.textContent = `${text} ×`;
      b.addEventListener("click",clear);
      summary.append(b);
    }
    if (search.value.trim()) chip(`Recherche : ${search.value.trim()}`,()=>{search.value="";search.dispatchEvent(new Event("input",{bubbles:true}));renderSummary();});
    for(const state of states){
      if (!state.select.value || state.config.id === "services-sort" && state.select.value === "pertinence") continue;
      chip(state.select.selectedOptions[0]?.textContent || state.select.value,()=>choose(state,state.config.id === "services-sort" ? "pertinence" : ""));
    }
    const mode = document.querySelector('[data-service-filter][aria-pressed="true"]');
    if (mode) chip(mode.textContent.trim(),()=>mode.click());
    const resetBottom = makeButton("taskly-v2-reset", "Réinitialiser les filtres", icons.reset);
    resetBottom.append(document.createTextNode("Réinitialiser les filtres"));
    resetBottom.addEventListener("click",reset);
    summary.append(resetBottom);
  }
  choices.forEach(enhance);
  // The parent LABEL for the sorting group cannot contain interactive buttons.
  const sortGroup = document.querySelector(".taskly-search-v1-sort-group");
  if (sortGroup?.tagName === "LABEL") {
    const div = document.createElement("div");
    div.className = sortGroup.className;
    while(sortGroup.firstChild) div.append(sortGroup.firstChild);
    sortGroup.replaceWith(div);
  }
  document.addEventListener("pointerdown", ev => {if (openState && !openState.wrap.contains(ev.target)) closeMenu(openState);});
  document.addEventListener("keydown", ev => {if (ev.key === "Escape" && openState) closeMenu(openState,true);});
  search.addEventListener("input",renderSummary);
  document.querySelectorAll("[data-service-filter]").forEach(btn => btn.addEventListener("click",renderSummary));
  const observer = new MutationObserver(renderSummary);
  observer.observe(info,{childList:true,characterData:true,subtree:true});
  renderSummary();
})();
