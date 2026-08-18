/* ==========================================================================
   EventHub — Unified Search Experience
   - Turns any plain search <input> into a live-suggestion search box
     (events + clubs, keyboard navigable, recent/trending searches, a
     clear button and an optional voice-search mic).
   - Adds a site-wide Quick Search (⌘K / Ctrl+K, or "/") that works from
     any page, independent of whichever page-specific search box exists.
   This file is self-contained: it injects its own stylesheet link, so no
   other page needs to be touched to pick it up (nav.js loads it once).
   ========================================================================== */

(function () {
  const RECENT_KEY = 'eh_recent_searches';
  const TRENDING = ['Hackathon', 'Dance', 'Workshop', 'Fest', 'Auditorium', 'Coding club'];
  const MAX_RECENT = 5;

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function highlight(text, query) {
    const safe = escapeHtml(text);
    const q = query.trim();
    if (!q) return safe;
    try {
      const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      return safe.replace(re, '<mark>$1</mark>');
    } catch (_) { return safe; }
  }

  function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (_) { return []; }
  }
  function pushRecent(term) {
    const t = term.trim();
    if (!t) return;
    let list = getRecent().filter((x) => x.toLowerCase() !== t.toLowerCase());
    list.unshift(t);
    list = list.slice(0, MAX_RECENT);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (_) {}
  }
  function clearRecent() { try { localStorage.removeItem(RECENT_KEY); } catch (_) {} }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  async function fetchSuggestions(query) {
    const q = query.trim();
    if (!q) return { events: [], clubs: [] };
    const hasApi = typeof Api !== 'undefined';
    const [eventsRes, clubsRes] = await Promise.allSettled([
      hasApi && Api.getEvents ? Api.getEvents(`?search=${encodeURIComponent(q)}&limit=5`) : Promise.resolve({ events: [] }),
      hasApi && Api.getClubs ? Api.getClubs(`?search=${encodeURIComponent(q)}`) : Promise.resolve({ clubs: [] })
    ]);
    const events = eventsRes.status === 'fulfilled' ? (eventsRes.value.events || []).slice(0, 5) : [];
    const clubs = clubsRes.status === 'fulfilled' ? (clubsRes.value.clubs || []).slice(0, 4) : [];
    return { events, clubs };
  }

  function rowsFromResults(results, query) {
    const rows = [];
    results.events.forEach((ev) => rows.push({
      type: 'event',
      icon: '🎟',
      title: ev.title,
      sub: [ev.club && ev.club.name, ev.location].filter(Boolean).join(' · ') || ev.date,
      href: `event-details.html?id=${ev._id || ev.id}`
    }));
    results.clubs.forEach((c) => rows.push({
      type: 'club',
      icon: '🏛',
      logo: c.logoUrl,
      title: c.name,
      sub: c.category || c.department || 'Club',
      href: `club-details.html?id=${c._id || c.id}`
    }));
    return rows;
  }

  /* ---------------- core enhancer ---------------- */

  function enhance(input, opts = {}) {
    if (!input || input.__ehSearchEnhanced) return;
    input.__ehSearchEnhanced = true;

    // Wrap just the input itself in a fresh, self-contained relative
    // container — this deliberately avoids the older, heavily-!important'd
    // .search-wrapper / .hero-search rules (which fight each other across
    // stylesheets) instead of trying to out-specificity them.
    const legacyWrapper = input.closest('.search-wrapper, .hero-search');
    const legacyIcon = legacyWrapper && legacyWrapper.querySelector('.search-icon, .hero-search-icon');
    if (legacyIcon) legacyIcon.style.display = 'none'; // superseded by eh-search-icon below

    const wrapper = document.createElement('span');
    wrapper.className = 'eh-search-enhanced';
    input.replaceWith(wrapper);
    wrapper.appendChild(input);

    const icon = document.createElement('span');
    icon.className = 'eh-search-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '🔍';
    wrapper.appendChild(icon);

    // action buttons (clear + mic)
    const actions = document.createElement('div');
    actions.className = 'eh-search-actions';
    const micSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    actions.innerHTML = `
      ${micSupported ? '<button type="button" class="eh-search-btn eh-search-mic" aria-label="Search by voice" title="Search by voice">🎤</button>' : ''}
      <button type="button" class="eh-search-btn eh-search-clear" aria-label="Clear search" title="Clear">✕</button>`;
    wrapper.appendChild(actions);
    const clearBtn = actions.querySelector('.eh-search-clear');
    const micBtn = actions.querySelector('.eh-search-mic');

    function toggleClear() { clearBtn.classList.toggle('is-visible', !!input.value); }
    toggleClear();

    clearBtn.addEventListener('click', () => {
      input.value = '';
      toggleClear();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      renderPanel('');
    });

    if (micBtn) {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      micBtn.addEventListener('click', () => {
        const rec = new Recognition();
        rec.lang = 'en-US';
        rec.interimResults = false;
        micBtn.classList.add('is-listening');
        rec.onresult = (e) => {
          const text = e.results[0][0].transcript;
          input.value = text;
          toggleClear();
          input.dispatchEvent(new Event('input', { bubbles: true }));
          renderPanel(text);
        };
        rec.onerror = () => micBtn.classList.remove('is-listening');
        rec.onend = () => micBtn.classList.remove('is-listening');
        try { rec.start(); } catch (_) { micBtn.classList.remove('is-listening'); }
      });
    }

    // suggestions panel
    const panel = document.createElement('div');
    panel.className = 'eh-search-panel';
    panel.setAttribute('role', 'listbox');
    document.body.appendChild(panel);

    let activeIndex = -1;
    let currentRows = [];
    let requestId = 0;

    function positionPanel() {
      const r = input.getBoundingClientRect();
      const isMobile = window.innerWidth <= 700;
      if (isMobile) {
        panel.style.left = '12px';
        panel.style.right = '12px';
        panel.style.width = 'auto';
        panel.style.top = Math.round(r.bottom + 8) + 'px';
      } else {
        panel.style.left = Math.round(r.left) + 'px';
        panel.style.width = Math.round(r.width) + 'px';
        panel.style.right = 'auto';
        panel.style.top = Math.round(r.bottom + 8) + 'px';
      }
    }

    function openPanel() { positionPanel(); panel.classList.add('is-open'); }
    function closePanel() { panel.classList.remove('is-open'); activeIndex = -1; }

    function goTo(row) {
      pushRecent(row.type === 'query' ? row.title : input.value.trim() || row.title);
      if (row.type === 'query') {
        input.value = row.title;
        toggleClear();
        closePanel();
        if (typeof opts.onQuerySelect === 'function') opts.onQuerySelect(row.title);
        else if (opts.formEl) opts.formEl.requestSubmit ? opts.formEl.requestSubmit() : opts.formEl.submit();
        return;
      }
      window.location.href = row.href;
    }

    function renderIdleState() {
      const recent = getRecent();
      let html = '';
      if (recent.length) {
        html += `<div class="eh-search-section-label">Recent searches</div>
          <div class="eh-search-chiprow">${recent.map((r) => `<button type="button" class="eh-search-chip" data-q="${escapeHtml(r)}">🕓 ${escapeHtml(r)}</button>`).join('')}
          <button type="button" class="eh-search-chip" data-clear-recent="1">Clear</button></div>`;
      }
      html += `<div class="eh-search-section-label">Trending</div>
        <div class="eh-search-chiprow">${TRENDING.map((t) => `<button type="button" class="eh-search-chip" data-q="${escapeHtml(t)}">🔥 ${escapeHtml(t)}</button>`).join('')}</div>`;
      panel.innerHTML = `<div class="eh-search-scroll">${html}</div>`;
      panel.querySelectorAll('[data-q]').forEach((btn) => btn.addEventListener('click', () => {
        input.value = btn.dataset.q;
        toggleClear();
        pushRecent(btn.dataset.q);
        if (opts.formEl) { closePanel(); opts.formEl.requestSubmit ? opts.formEl.requestSubmit() : opts.formEl.submit(); return; }
        input.focus();
        renderPanel(btn.dataset.q);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }));
      panel.querySelector('[data-clear-recent]')?.addEventListener('click', () => { clearRecent(); renderIdleState(); });
      currentRows = [];
    }

    const doFetch = debounce(async (query) => {
      const myRequest = ++requestId;
      panel.innerHTML = `<div class="eh-search-loading">Searching<span class="eh-dots"><span></span><span></span><span></span></span></div>`;
      openPanel();
      const results = await fetchSuggestions(query);
      if (myRequest !== requestId) return; // a newer keystroke superseded this
      const rows = rowsFromResults(results, query);
      currentRows = rows;
      activeIndex = -1;
      if (!rows.length) {
        panel.innerHTML = `<div class="eh-search-empty">No matches for “${escapeHtml(query)}” yet. Press Enter to search anyway.</div>`;
        return;
      }
      const grouped = { event: 'Events', club: 'Clubs' };
      let html = '<div class="eh-search-scroll">';
      let lastType = null;
      rows.forEach((row, i) => {
        if (row.type !== lastType) { html += `<div class="eh-search-section-label">${grouped[row.type]}</div>`; lastType = row.type; }
        html += `<button type="button" class="eh-search-row" data-idx="${i}" role="option">
          <span class="eh-row-icon">${row.logo ? `<img src="${escapeHtml(row.logo)}" alt="">` : row.icon}</span>
          <span class="eh-row-body"><span class="eh-row-title">${highlight(row.title, query)}</span><span class="eh-row-sub">${escapeHtml(row.sub || '')}</span></span>
          <span class="eh-row-badge type-${row.type}">${row.type}</span>
        </button>`;
      });
      html += `</div><div class="eh-search-footer"><span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span><span><kbd>Enter</kbd> to select</span></div>`;
      panel.innerHTML = html;
      panel.querySelectorAll('.eh-search-row').forEach((el) => {
        el.addEventListener('click', () => goTo(rows[Number(el.dataset.idx)]));
        el.addEventListener('mouseenter', () => setActive(Number(el.dataset.idx)));
      });
    }, 260);

    function setActive(i) {
      const els = panel.querySelectorAll('.eh-search-row');
      els.forEach((el) => el.classList.remove('is-active'));
      if (i >= 0 && els[i]) {
        els[i].classList.add('is-active');
        els[i].scrollIntoView({ block: 'nearest' });
      }
      activeIndex = i;
    }

    function renderPanel(query) {
      if (!query.trim()) { openPanel(); renderIdleState(); return; }
      doFetch(query);
    }

    input.addEventListener('focus', () => renderPanel(input.value));
    input.addEventListener('input', () => { toggleClear(); renderPanel(input.value); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' && currentRows.length) { e.preventDefault(); setActive(Math.min(activeIndex + 1, currentRows.length - 1)); }
      else if (e.key === 'ArrowUp' && currentRows.length) { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
      else if (e.key === 'Enter' && activeIndex >= 0 && currentRows[activeIndex]) { e.preventDefault(); goTo(currentRows[activeIndex]); }
      else if (e.key === 'Enter') { pushRecent(input.value); closePanel(); }
      else if (e.key === 'Escape') { closePanel(); input.blur(); }
    });
    window.addEventListener('resize', () => { if (panel.classList.contains('is-open')) positionPanel(); });
    window.addEventListener('scroll', () => { if (panel.classList.contains('is-open')) positionPanel(); }, true);
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && e.target !== input) closePanel();
    });
  }

  /* ---------------- global Quick Search (⌘K) ---------------- */

  function buildQuickSearch() {
    const backdrop = document.createElement('div');
    backdrop.className = 'eh-qs-backdrop';
    backdrop.style.display = 'none';
    backdrop.innerHTML = `
      <div class="eh-qs-modal" role="dialog" aria-modal="true" aria-label="Quick search">
        <div class="eh-qs-input-row">
          <span class="eh-search-icon" aria-hidden="true">🔍</span>
          <input type="search" id="ehQsInput" placeholder="Search events, clubs, groups…" autocomplete="off" />
          <span class="eh-qs-esc">Esc</span>
        </div>
        <div class="eh-qs-body"></div>
      </div>`;
    document.body.appendChild(backdrop);
    const input = backdrop.querySelector('#ehQsInput');
    const body = backdrop.querySelector('.eh-qs-body');

    function open() {
      backdrop.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      input.value = '';
      input.focus();
      renderIdle();
    }
    function close() {
      backdrop.style.display = 'none';
      document.body.style.overflow = '';
    }
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); backdrop.style.display === 'flex' ? close() : open(); }
      else if (e.key === '/' && !typing && backdrop.style.display !== 'flex') { e.preventDefault(); open(); }
      else if (e.key === 'Escape' && backdrop.style.display === 'flex') { close(); }
    });

    function renderIdle() {
      const recent = getRecent();
      body.innerHTML = `
        ${recent.length ? `<div class="eh-search-section-label">Recent</div><div class="eh-search-chiprow">${recent.map((r) => `<button type="button" class="eh-search-chip" data-q="${escapeHtml(r)}">🕓 ${escapeHtml(r)}</button>`).join('')}</div>` : ''}
        <div class="eh-search-section-label">Jump to</div>
        <a class="eh-search-row" href="events.html"><span class="eh-row-icon">🎟</span><span class="eh-row-body"><span class="eh-row-title">Browse all events</span></span></a>
        <a class="eh-search-row" href="clubs.html"><span class="eh-row-icon">🏛</span><span class="eh-row-body"><span class="eh-row-title">Explore clubs</span></span></a>
        <a class="eh-search-row" href="groups.html"><span class="eh-row-icon">👥</span><span class="eh-row-body"><span class="eh-row-title">Campus groups</span></span></a>
        <div class="eh-search-section-label">Trending</div>
        <div class="eh-search-chiprow">${TRENDING.map((t) => `<button type="button" class="eh-search-chip" data-q="${escapeHtml(t)}">🔥 ${escapeHtml(t)}</button>`).join('')}</div>`;
      body.querySelectorAll('[data-q]').forEach((btn) => btn.addEventListener('click', () => { input.value = btn.dataset.q; runQuery(btn.dataset.q); }));
    }

    const runQuery = debounce(async (q) => {
      if (!q.trim()) { renderIdle(); return; }
      body.innerHTML = `<div class="eh-search-loading">Searching<span class="eh-dots"><span></span><span></span><span></span></span></div>`;
      const results = await fetchSuggestions(q);
      const rows = rowsFromResults(results, q);
      if (!rows.length) { body.innerHTML = `<div class="eh-search-empty">No matches. <a href="events.html?search=${encodeURIComponent(q)}">See full results →</a></div>`; return; }
      body.innerHTML = `<div>${rows.map((r) => `<a class="eh-search-row" href="${r.href}"><span class="eh-row-icon">${r.logo ? `<img src="${escapeHtml(r.logo)}" alt="">` : r.icon}</span><span class="eh-row-body"><span class="eh-row-title">${highlight(r.title, q)}</span><span class="eh-row-sub">${escapeHtml(r.sub || '')}</span></span><span class="eh-row-badge type-${r.type}">${r.type}</span></a>`).join('')}
        <div style="padding:10px 16px"><a href="events.html?search=${encodeURIComponent(q)}">See all results for “${escapeHtml(q)}” →</a></div></div>`;
    }, 260);

    input.addEventListener('input', () => runQuery(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { pushRecent(input.value); window.location.href = `events.html?search=${encodeURIComponent(input.value.trim())}`; }
    });

    return { open };
  }

  function injectNavTrigger(quickSearch) {
    const tryInject = () => {
      const navInner = document.querySelector('.navbar-inner');
      if (!navInner || navInner.querySelector('.eh-qs-trigger')) return;
      const desktopNav = navInner.querySelector('.desktop-nav');
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'eh-qs-trigger';
      trigger.innerHTML = '🔍 <span>Search</span><span class="eh-qs-kbd">⌘K</span>';
      trigger.addEventListener('click', () => quickSearch.open());
      const iconBtn = document.createElement('button');
      iconBtn.type = 'button';
      iconBtn.className = 'eh-qs-icon-btn';
      iconBtn.setAttribute('aria-label', 'Search');
      iconBtn.innerHTML = '🔍';
      iconBtn.addEventListener('click', () => quickSearch.open());
      if (desktopNav) desktopNav.insertBefore(trigger, desktopNav.firstChild);
      navInner.insertBefore(iconBtn, navInner.querySelector('.mobile-nav-toggle') || null);
    };
    tryInject();
    // The navbar is (re)built asynchronously by nav.js — keep watching briefly.
    const obs = new MutationObserver(tryInject);
    const target = document.getElementById('navbar');
    if (target) obs.observe(target, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 8000);
  }

  function boot() {
    const quickSearch = buildQuickSearch();
    injectNavTrigger(quickSearch);
    const hero = document.getElementById('heroSearchInput');
    if (hero) enhance(hero, { formEl: document.getElementById('heroSearchForm') });
    const eventSearch = document.getElementById('eventSearch');
    if (eventSearch) enhance(eventSearch);
    document.querySelectorAll('[data-eh-search]').forEach((el) => enhance(el));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.EHSearch = { enhance };
})();
