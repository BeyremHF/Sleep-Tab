'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────

const UNGROUPED = -1;

const GROUP_COLORS = {
  grey:   '#6b7280',
  blue:   '#378add',
  red:    '#ef4444',
  yellow: '#eab308',
  green:  '#22c55e',
  pink:   '#ec4899',
  purple: '#a855f7',
  cyan:   '#06b6d4',
  orange: '#f97316',
};

const T = {
  English: {
    search:       'Search tabs…',
    hint:         'Select tabs to act on',
    nSelected:    n => `${n} tab${n !== 1 ? 's' : ''} selected`,
    tabsCount:    n => `${n} tab${n !== 1 ? 's' : ''}`,
    protect:      'Protect',
    sleep:        'Put to sleep',
    selectGroup:  'select group',
    unselectGroup:'unselect group',
    settings:     'Settings',
    language:     'Language',
    apply:        'Apply',
    current:      'current',
    asleep:       'asleep',
    protected:    'protected',
    unprotect:    'unprotect',
    ungrouped:    'Ungrouped',
    noTabs:       'No tabs found',
  },
  Spanish: {
    search:       'Buscar pestañas…',
    hint:         'Selecciona pestañas',
    nSelected:    n => `${n} pestaña${n !== 1 ? 's' : ''} seleccionada${n !== 1 ? 's' : ''}`,
    tabsCount:    n => `${n} pestaña${n !== 1 ? 's' : ''}`,
    protect:      'Proteger',
    sleep:        'Poner a dormir',
    selectGroup:  'seleccionar grupo',
    unselectGroup:'deseleccionar grupo',
    settings:     'Ajustes',
    language:     'Idioma',
    apply:        'Aplicar',
    current:      'actual',
    asleep:       'dormida',
    protected:    'protegida',
    unprotect:    'desproteger',
    ungrouped:    'Sin grupo',
    noTabs:       'No se encontraron pestañas',
  },
  French: {
    search:       'Rechercher…',
    hint:         'Sélectionner des onglets',
    nSelected:    n => `${n} onglet${n !== 1 ? 's' : ''} sélectionné${n !== 1 ? 's' : ''}`,
    tabsCount:    n => `${n} onglet${n !== 1 ? 's' : ''}`,
    protect:      'Protéger',
    sleep:        'Mettre en veille',
    selectGroup:  'sélect. groupe',
    unselectGroup:'désélect. groupe',
    settings:     'Paramètres',
    language:     'Langue',
    apply:        'Appliquer',
    current:      'actif',
    asleep:       'en veille',
    protected:    'protégé',
    unprotect:    'déprotéger',
    ungrouped:    'Sans groupe',
    noTabs:       'Aucun onglet trouvé',
  },
  German: {
    search:       'Tabs suchen…',
    hint:         'Tabs auswählen',
    nSelected:    n => `${n} Tab${n !== 1 ? 's' : ''} ausgewählt`,
    tabsCount:    n => `${n} Tab${n !== 1 ? 's' : ''}`,
    protect:      'Schützen',
    sleep:        'Schlafen legen',
    selectGroup:  'gruppe wählen',
    unselectGroup:'gruppe abwählen',
    settings:     'Einstellungen',
    language:     'Sprache',
    apply:        'Anwenden',
    current:      'aktiv',
    asleep:       'schlafend',
    protected:    'geschützt',
    unprotect:    'entschützen',
    ungrouped:    'Ohne Gruppe',
    noTabs:       'Keine Tabs gefunden',
  },
  Portuguese: {
    search:       'Pesquisar abas…',
    hint:         'Selecionar abas',
    nSelected:    n => `${n} aba${n !== 1 ? 's' : ''} selecionada${n !== 1 ? 's' : ''}`,
    tabsCount:    n => `${n} aba${n !== 1 ? 's' : ''}`,
    protect:      'Proteger',
    sleep:        'Colocar para dormir',
    selectGroup:  'selecionar grupo',
    unselectGroup:'desmarcar grupo',
    settings:     'Configurações',
    language:     'Idioma',
    apply:        'Aplicar',
    current:      'atual',
    asleep:       'dormindo',
    protected:    'protegida',
    unprotect:    'desproteger',
    ungrouped:    'Sem grupo',
    noTabs:       'Nenhuma aba encontrada',
  },
};

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  tabs:             [],     // all tabs in window, sorted by index
  groups:           [],     // all tabGroups in window
  sections:         [],     // processed sections array
  currentTabId:     null,   // active tab id
  windowId:         null,
  selected:         new Set(),
  collapsed:        new Set(),
  activeLang:       'English',
  pendingLang:      'English',
  protectedDomains: new Set(),
  searchQuery:      '',
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function init() {
  // Load persisted settings
  const stored = await chrome.storage.sync.get(['language', 'protectedDomains']);
  state.activeLang  = stored.language || 'English';
  state.pendingLang = state.activeLang;
  state.protectedDomains = new Set(stored.protectedDomains || []);

  // Identify current tab and window
  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.currentTabId = currentTab?.id ?? null;
  state.windowId     = currentTab?.windowId ?? null;

  // Fetch all tabs
  state.tabs = await chrome.tabs.query({ currentWindow: true });
  state.tabs.sort((a, b) => a.index - b.index);

  // Fetch tab groups (may be unavailable)
  try {
    state.groups = await chrome.tabGroups.query({ windowId: state.windowId });
  } catch {
    state.groups = [];
  }

  // Re-apply autoDiscardable:false for protected domains
  await reapplyProtection();

  // Build sections and render
  state.sections = buildSections(state.tabs, state.groups);

  render();
  applyLang(state.activeLang, false); // apply without re-rendering list again
}

// ── Data Processing ───────────────────────────────────────────────────────────

/**
 * Groups tabs into ordered sections preserving the visual tab-strip order.
 * Returns an array of: { type:'group', group, tabs } | { type:'ungrouped', tabs }
 */
function buildSections(tabs, groups) {
  const groupMap = new Map(groups.map(g => [g.id, g]));
  const sections = [];
  let i = 0;

  while (i < tabs.length) {
    const gid = tabs[i].groupId;

    if (!gid || gid === UNGROUPED) {
      // Collect consecutive ungrouped tabs
      const batch = [];
      while (i < tabs.length && (!tabs[i].groupId || tabs[i].groupId === UNGROUPED)) {
        batch.push(tabs[i++]);
      }
      sections.push({ type: 'ungrouped', tabs: batch });
    } else {
      // Collect all tabs belonging to this group
      const batch = [];
      while (i < tabs.length && tabs[i].groupId === gid) {
        batch.push(tabs[i++]);
      }
      sections.push({
        type:  'group',
        group: groupMap.get(gid) || { id: gid, title: '', color: 'grey' },
        tabs:  batch,
      });
    }
  }

  return sections;
}

async function reapplyProtection() {
  if (state.protectedDomains.size === 0) return;
  await Promise.all(
    state.tabs.map(tab => {
      const domain = getDomain(tab);
      if (domain && state.protectedDomains.has(domain) && tab.autoDiscardable !== false) {
        return chrome.tabs.update(tab.id, { autoDiscardable: false }).catch(() => {});
      }
      return Promise.resolve();
    })
  );
}

async function refreshTabs() {
  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.currentTabId = currentTab?.id ?? null;
  state.windowId     = currentTab?.windowId ?? null;

  state.tabs = await chrome.tabs.query({ currentWindow: true });
  state.tabs.sort((a, b) => a.index - b.index);

  try {
    state.groups = await chrome.tabGroups.query({ windowId: state.windowId });
  } catch {
    state.groups = [];
  }

  state.sections = buildSections(state.tabs, state.groups);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function t() { return T[state.activeLang]; }

function getDomain(tab) {
  try { return new URL(tab.url).hostname; } catch { return ''; }
}

function isProtected(tab) {
  const domain = getDomain(tab);
  return (domain && state.protectedDomains.has(domain)) || tab.autoDiscardable === false;
}

function getSelectableTabs() {
  return state.tabs.filter(tab => tab.id !== state.currentTabId);
}

function isGroupFullySelected(tabs) {
  const selectable = tabs.filter(tab => tab.id !== state.currentTabId);
  return selectable.length > 0 && selectable.every(tab => state.selected.has(tab.id));
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  renderTabList();
  updateFooter();
  updateSelectToggle();
  updateTabCount();
}

function updateTabCount() {
  const tr = t();
  document.getElementById('tabCount').textContent = tr.tabsCount(state.tabs.length);
}

function renderTabList() {
  const container = document.getElementById('tabList');
  const tr = t();
  const q  = state.searchQuery.toLowerCase();

  container.innerHTML = '';
  let firstSection = true;

  for (const section of state.sections) {
    // Filter tabs by search query
    const filtered = q
      ? section.tabs.filter(tab =>
          (tab.title  || '').toLowerCase().includes(q) ||
          (tab.url    || '').toLowerCase().includes(q))
      : section.tabs;

    if (filtered.length === 0) continue;

    if (!firstSection) container.appendChild(createDivider());
    firstSection = false;

    if (section.type === 'group') {
      container.appendChild(createGroupHeader(section.group, filtered, tr));
    } else {
      container.appendChild(createUngroupedHeader(filtered, tr));
    }

    const body = createGroupBody(section.type === 'group' ? section.group.id : 'ungrouped');
    filtered.forEach(tab => body.appendChild(createTabRow(tab, tr)));
    container.appendChild(body);
  }

  if (container.children.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = tr.noTabs;
    container.appendChild(empty);
  }
}

// ── DOM Builders ──────────────────────────────────────────────────────────────

function createGroupHeader(group, tabs, tr) {
  const groupId     = group.id;
  const isCollapsed = state.collapsed.has(groupId);
  const color       = GROUP_COLORS[group.color] || GROUP_COLORS.grey;
  const selectableTabs = tabs.filter(tab => tab.id !== state.currentTabId);
  const allSelected = isGroupFullySelected(tabs);

  const el = document.createElement('div');
  el.className = 'group-header';

  // Arrow
  const arrow = document.createElement('div');
  arrow.className = `arrow${isCollapsed ? ' collapsed' : ''}`;
  arrow.dataset.groupArrow = groupId;
  arrow.innerHTML = `<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" width="10" height="10"><polyline points="2,3 5,7 8,3"/></svg>`;

  // Dot
  const dot = document.createElement('div');
  dot.className = 'group-dot';
  dot.style.background = color;

  // Name
  const name = document.createElement('span');
  name.className = 'group-name';
  name.textContent = group.title || '';

  // Action button
  const btn = document.createElement('button');
  btn.className = 'group-action-btn';
  btn.textContent = allSelected ? tr.unselectGroup : tr.selectGroup;
  btn.dataset.groupBtn = groupId;

  el.appendChild(arrow);
  el.appendChild(dot);
  el.appendChild(name);
  el.appendChild(btn);

  el.addEventListener('click', e => {
    if (e.target.closest('.group-action-btn')) return;
    toggleGroupCollapse(groupId);
  });

  btn.addEventListener('click', e => {
    e.stopPropagation();
    toggleGroupSelection(selectableTabs);
  });

  return el;
}

function createUngroupedHeader(tabs, tr) {
  const isCollapsed = state.collapsed.has('ungrouped');
  const selectableTabs = tabs.filter(tab => tab.id !== state.currentTabId);
  const allSelected = isGroupFullySelected(tabs);

  const el = document.createElement('div');
  el.className = 'group-header';

  // Arrow
  const arrow = document.createElement('div');
  arrow.className = `arrow${isCollapsed ? ' collapsed' : ''}`;
  arrow.dataset.groupArrow = 'ungrouped';
  arrow.innerHTML = `<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" width="10" height="10"><polyline points="2,3 5,7 8,3"/></svg>`;

  // Name (no dot for ungrouped)
  const name = document.createElement('span');
  name.className = 'group-name';
  name.style.marginLeft = '2px';
  name.textContent = tr.ungrouped;

  // Action button
  const btn = document.createElement('button');
  btn.className = 'group-action-btn';
  btn.textContent = allSelected ? tr.unselectGroup : tr.selectGroup;
  btn.dataset.groupBtn = 'ungrouped';

  el.appendChild(arrow);
  el.appendChild(name);
  el.appendChild(btn);

  el.addEventListener('click', e => {
    if (e.target.closest('.group-action-btn')) return;
    toggleGroupCollapse('ungrouped');
  });

  btn.addEventListener('click', e => {
    e.stopPropagation();
    toggleGroupSelection(selectableTabs);
  });

  return el;
}

function createGroupBody(groupId) {
  const el = document.createElement('div');
  el.className = 'group-body';
  el.dataset.groupBody = groupId;

  // If already collapsed, start closed
  if (state.collapsed.has(groupId)) {
    el.style.maxHeight = '0px';
  }

  return el;
}

function createTabRow(tab, tr) {
  const isCurrent  = tab.id === state.currentTabId;
  const isSelected = state.selected.has(tab.id);
  const tabProtected = isProtected(tab);
  const tabAsleep  = tab.discarded;

  const el = document.createElement('div');
  el.className = `tab-row${isCurrent ? ' is-current' : ''}${isSelected ? ' selected' : ''}`;
  el.dataset.tabId = tab.id;

  // Checkbox
  const check = document.createElement('div');
  check.className = 'tab-check';

  // Favicon
  const favicon = createFavicon(tab);

  // Title
  const title = document.createElement('span');
  title.className = 'tab-title';
  title.textContent = tab.title || tab.url || 'Untitled';

  // Badges
  const badges = document.createElement('div');
  badges.className = 'tab-badges';

  if (isCurrent) {
    badges.appendChild(createBadge('current', tr.current));
  } else if (tabProtected) {
    const badge = createBadge('protected', tr.protected);
    badge.dataset.label = tr.protected;
    // On hover show "unprotect" text via CSS data-label trick
    badge.addEventListener('mouseenter', () => { badge.dataset.label = tr.unprotect; });
    badge.addEventListener('mouseleave', () => { badge.dataset.label = tr.protected;  });
    badge.addEventListener('click', e => {
      e.stopPropagation();
      unprotectTab(tab);
    });
    badges.appendChild(badge);
  } else if (tabAsleep) {
    badges.appendChild(createBadge('asleep', tr.asleep));
  }

  el.appendChild(check);
  el.appendChild(favicon);
  el.appendChild(title);
  el.appendChild(badges);

  if (!isCurrent) {
    el.addEventListener('click', () => toggleTabSelection(tab.id));
  }

  return el;
}

function createFavicon(tab) {
  const div    = document.createElement('div');
  div.className = 'favicon';
  const letter = ((tab.title || tab.url || '?')[0] || '?').toUpperCase();

  const url = tab.favIconUrl || '';
  if (url && (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('data:'))) {
    const img = document.createElement('img');
    img.className = 'favicon-img';
    img.alt = '';
    img.src = url;
    img.addEventListener('error', () => {
      // Fallback to letter on broken favicon
      img.remove();
      div.textContent = letter;
    });
    div.appendChild(img);
  } else {
    div.textContent = letter;
  }

  return div;
}

function createBadge(type, text) {
  const span = document.createElement('span');
  span.className = `badge badge-${type}`;
  if (type === 'protected') {
    span.dataset.label = text;
    // Text is rendered via CSS ::after content: attr(data-label)
  } else {
    span.textContent = text;
  }
  return span;
}

function createDivider() {
  const el = document.createElement('div');
  el.className = 'divider';
  return el;
}

// ── Selection ─────────────────────────────────────────────────────────────────

function toggleTabSelection(tabId) {
  if (state.selected.has(tabId)) {
    state.selected.delete(tabId);
  } else {
    state.selected.add(tabId);
  }
  syncSelectionClasses();
  syncGroupBtns();
  updateFooter();
  updateSelectToggle();
}

function toggleGroupSelection(tabs) {
  if (isGroupFullySelected(tabs)) {
    tabs.forEach(tab => state.selected.delete(tab.id));
  } else {
    tabs.forEach(tab => state.selected.add(tab.id));
  }
  syncSelectionClasses();
  syncGroupBtns();
  updateFooter();
  updateSelectToggle();
}

function handleSelectToggle() {
  const selectable = getSelectableTabs();
  if (state.selected.size === 0) {
    selectable.forEach(tab => state.selected.add(tab.id));
  } else {
    state.selected.clear();
  }
  syncSelectionClasses();
  syncGroupBtns();
  updateFooter();
  updateSelectToggle();
}

/** Re-applies .selected class without re-rendering the whole list */
function syncSelectionClasses() {
  document.querySelectorAll('.tab-row[data-tab-id]').forEach(row => {
    const id = parseInt(row.dataset.tabId, 10);
    row.classList.toggle('selected', state.selected.has(id));
  });
}

/** Updates all visible group action button texts */
function syncGroupBtns() {
  const tr = t();
  document.querySelectorAll('.group-action-btn[data-group-btn]').forEach(btn => {
    const key = btn.dataset.groupBtn;
    let tabs = [];

    for (const section of state.sections) {
      if (section.type === 'group' && String(section.group.id) === key) {
        tabs = section.tabs; break;
      }
      if (section.type === 'ungrouped' && key === 'ungrouped') {
        tabs = section.tabs; break;
      }
    }

    btn.textContent = isGroupFullySelected(tabs) ? tr.unselectGroup : tr.selectGroup;
  });
}

// ── Collapse / Expand ─────────────────────────────────────────────────────────

function toggleGroupCollapse(groupId) {
  const body  = document.querySelector(`[data-group-body="${groupId}"]`);
  const arrow = document.querySelector(`[data-group-arrow="${groupId}"]`);
  if (!body) return;

  if (state.collapsed.has(groupId)) {
    state.collapsed.delete(groupId);
    body.style.maxHeight = body.scrollHeight + 'px';
    // Remove explicit maxHeight after transition so it can grow if tabs change
    setTimeout(() => {
      if (!state.collapsed.has(groupId)) body.style.maxHeight = 'none';
    }, 220);
    arrow?.classList.remove('collapsed');
  } else {
    state.collapsed.add(groupId);
    // Explicitly set current height first so transition has a start value
    body.style.maxHeight = body.scrollHeight + 'px';
    requestAnimationFrame(() => { body.style.maxHeight = '0px'; });
    arrow?.classList.add('collapsed');
  }
}

// ── Sleep & Protect ───────────────────────────────────────────────────────────

async function sleepSelected() {
  if (state.selected.size === 0) return;

  const toSleep = [...state.selected].filter(id => {
    const found = state.tabs.find(t => t.id === id);
    // Skip if not found, is current, or already asleep
    return found && found.id !== state.currentTabId && !found.discarded;
  });

  if (toSleep.length === 0) return;

  await Promise.all(
    toSleep.map(id => chrome.tabs.discard(id).catch(() => {}))
  );

  await refreshTabs();
  state.selected.clear();
  render();
}

async function protectSelected() {
  if (state.selected.size === 0) return;

  await Promise.all(
    [...state.selected].map(async id => {
      const found = state.tabs.find(t => t.id === id);
      if (!found) return;
      const domain = getDomain(found);
      if (domain) state.protectedDomains.add(domain);
      await chrome.tabs.update(id, { autoDiscardable: false }).catch(() => {});
    })
  );

  await chrome.storage.sync.set({ protectedDomains: [...state.protectedDomains] });
  await refreshTabs();
  state.selected.clear();
  render();
}

async function unprotectTab(tab) {
  const domain = getDomain(tab);
  if (domain) {
    state.protectedDomains.delete(domain);
    await chrome.storage.sync.set({ protectedDomains: [...state.protectedDomains] });
  }
  await chrome.tabs.update(tab.id, { autoDiscardable: true }).catch(() => {});
  await refreshTabs();
  render();
}

// ── Footer ────────────────────────────────────────────────────────────────────

function updateFooter() {
  const tr  = t();
  const n   = state.selected.size;
  document.getElementById('footerInfo').textContent = n === 0 ? tr.hint : tr.nSelected(n);
  document.getElementById('sleepBtn').className   = `btn btn-primary${n === 0 ? ' btn-disabled' : ''}`;
  document.getElementById('protectBtn').className = `btn${n === 0 ? ' btn-disabled' : ''}`;
}

function updateSelectToggle() {
  const selectable = getSelectableTabs();
  const n     = state.selected.size;
  const total = selectable.length;
  const el    = document.getElementById('selectToggle');
  if (n === 0)           el.className = 'select-toggle';
  else if (n >= total)   el.className = 'select-toggle all';
  else                   el.className = 'select-toggle some';
}

// ── Search ────────────────────────────────────────────────────────────────────

function setupSearch() {
  const wrapper = document.getElementById('searchWrapper');
  const input   = document.getElementById('searchInput');
  let hovering  = false;

  wrapper.addEventListener('mouseenter', () => {
    hovering = true;
    wrapper.classList.add('expanded');
    setTimeout(() => input.focus(), 230);
  });

  wrapper.addEventListener('mouseleave', () => {
    hovering = false;
    if (!input.matches(':focus')) collapseSearch();
  });

  input.addEventListener('blur', () => {
    if (!hovering) collapseSearch();
  });

  // Collapse search when clicking outside the wrapper
  document.getElementById('mainView').addEventListener('mousedown', e => {
    if (!wrapper.contains(e.target)) input.blur();
  });

  input.addEventListener('input', () => {
    state.searchQuery = input.value;
    renderTabList();
  });
}

function collapseSearch() {
  const wrapper = document.getElementById('searchWrapper');
  const input   = document.getElementById('searchInput');
  wrapper.classList.remove('expanded');
  input.value       = '';
  state.searchQuery = '';
  renderTabList();
}

// ── Settings ──────────────────────────────────────────────────────────────────

function openSettings() {
  const shell        = document.getElementById('shell');
  const slider       = document.getElementById('slider');
  const mainView     = document.getElementById('mainView');
  const settingsView = document.getElementById('settingsView');

  const fromH = mainView.offsetHeight;
  const toH   = settingsView.offsetHeight;

  shell.style.height = fromH + 'px';
  slider.classList.add('at-settings');

  requestAnimationFrame(() => requestAnimationFrame(() => {
    shell.style.height = toH + 'px';
    // Do NOT clear height here — clearing it causes shell to snap back to
    // max(mainHeight, settingsHeight), producing the empty-space glitch.
    // Height stays explicit until closeSettings() returns to main view.
  }));

  // Sync language radio buttons to current active lang
  state.pendingLang = state.activeLang;
  document.querySelectorAll('.lang-option').forEach(el => {
    el.classList.toggle('active', el.dataset.lang === state.activeLang);
  });
}

function closeSettings() {
  const shell        = document.getElementById('shell');
  const slider       = document.getElementById('slider');
  const mainView     = document.getElementById('mainView');
  const settingsView = document.getElementById('settingsView');

  // Use the current explicit height as the start point (set by openSettings)
  const fromH = parseFloat(shell.style.height) || settingsView.offsetHeight;
  const toH   = mainView.offsetHeight;

  shell.style.height = fromH + 'px';
  slider.classList.remove('at-settings');

  requestAnimationFrame(() => requestAnimationFrame(() => {
    shell.style.height = toH + 'px';
  }));

  // Safe to clear here — main view natural height matches what we animated to
  setTimeout(() => { shell.style.height = ''; }, 270);
}

async function applySettings() {
  state.activeLang = state.pendingLang;
  await chrome.storage.sync.set({ language: state.activeLang });
  applyLang(state.activeLang, true);
  closeSettings();
}

function selectLang(el) {
  document.querySelectorAll('.lang-option').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  state.pendingLang = el.dataset.lang;
}

/**
 * Updates all static UI text to the given language.
 * @param {string} lang
 * @param {boolean} rerender - whether to also re-render the tab list (for badge text updates)
 */
function applyLang(lang, rerender = true) {
  const tr = T[lang];
  document.getElementById('searchInput').placeholder = tr.search;
  document.getElementById('protectBtn').textContent  = tr.protect;
  document.getElementById('sleepBtn').textContent    = tr.sleep;
  document.getElementById('settingsTitle').textContent = tr.settings;
  document.getElementById('langLabel').textContent   = tr.language;
  document.getElementById('applyBtn').textContent    = tr.apply;
  updateTabCount(); // re-renders tab count in the active language

  if (rerender) {
    renderTabList();
    updateFooter();
  }
}

// ── Event Wiring ──────────────────────────────────────────────────────────────
// (Script is at end of <body>, so DOM is ready when this runs.)

function wireEvents() {
  document.getElementById('selectToggle').addEventListener('click', handleSelectToggle);
  document.getElementById('sleepBtn').addEventListener('click', sleepSelected);
  document.getElementById('protectBtn').addEventListener('click', protectSelected);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('backBtn').addEventListener('click', closeSettings);
  document.getElementById('applyBtn').addEventListener('click', applySettings);

  document.querySelectorAll('.lang-option').forEach(el => {
    el.addEventListener('click', () => selectLang(el));
  });

  setupSearch();
}

// ── Start ─────────────────────────────────────────────────────────────────────
// wireEvents() is called synchronously first — DOM is ready since script is
// at end of <body>. init() is async and runs data fetching in the background.

wireEvents();
init();