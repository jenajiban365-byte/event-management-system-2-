/* EventHub shared navigation — single source of truth for desktop + mobile. */

function avatarHtml(user, extraClass = '') {
  const initial = escapeHtml((user?.name || 'U').charAt(0).toUpperCase());
  const avatar = user?.avatarUrl
    ? `<img class="profile-avatar-img" src="${escapeHtml(user.avatarUrl)}" alt="" />`
    : initial;
  return `<span class="profile-avatar ${extraClass}" aria-hidden="true">${avatar}</span>`;
}

function performLogout(redirectTo = '/index.html') {
  Session.clear();
  localStorage.removeItem('eventhub_saved_events');
  window.location.href = redirectTo;
}

function navNotificationLink(href, activePage) {
  return `<a href="${href}" class="${activePage === 'notifications' ? 'active' : ''}">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a>`;
}

function roleLinks(role, activePage, prefix = '') {
  if (role === 'club_head') {
    return [
      `<a href="${prefix}organizer/club-dashboard.html" class="${activePage === 'club-head' ? 'active' : ''}">My Club</a>`,
      `<a href="${prefix}events.html" class="${activePage === 'events' ? 'active' : ''}">Discover</a>`,
      navNotificationLink(`${prefix}notifications.html`, activePage),
      `<a href="${prefix}contact.html" class="${activePage === 'contact' ? 'active' : ''}">Contact</a>`
    ].join('');
  }
  if (role === 'organizer') {
    return [
      `<a href="${prefix}organizer/dashboard.html" class="${activePage === 'organizer' ? 'active' : ''}">Dashboard</a>`,
      `<a href="${prefix}organizer/events.html" class="${activePage === 'organizer-events' ? 'active' : ''}">My Events</a>`,
      `<a href="${prefix}organizer/registrations.html" class="${activePage === 'organizer-registrations' ? 'active' : ''}">Registrations</a>`,
      navNotificationLink(`${prefix}notifications.html`, activePage)
    ].join('');
  }
  if (role === 'admin') {
    return [
      `<a href="${prefix}admin/dashboard.html" class="${activePage === 'admin' ? 'active' : ''}">Dashboard</a>`,
      `<a href="${prefix}admin/events.html" class="${activePage === 'admin-events' ? 'active' : ''}">Events</a>`,
      `<a href="${prefix}admin/clubs.html" class="${activePage === 'admin-clubs' ? 'active' : ''}">Clubs</a>`,
      `<a href="${prefix}admin/users.html" class="${activePage === 'admin-users' ? 'active' : ''}">Users</a>`,
      navNotificationLink(`${prefix}notifications.html`, activePage)
    ].join('');
  }
  return [
    `<a href="${prefix}events.html" class="${activePage === 'events' ? 'active' : ''}">Discover</a>`,
    `<a href="${prefix}clubs.html" class="${activePage === 'clubs' ? 'active' : ''}">Clubs</a>`,
    ...(Session.isLoggedIn() ? [
      `<a href="${prefix}saved-events.html" class="${activePage === 'saved' ? 'active' : ''}">Saved Events</a>`,
      `<a href="${prefix}my-bookings.html" class="${activePage === 'bookings' ? 'active' : ''}">My Bookings</a>`,
      navNotificationLink(`${prefix}notifications.html`, activePage)
    ] : []),
    `<a href="${prefix}contact.html" class="${activePage === 'contact' ? 'active' : ''}">Contact</a>`
  ].join('');
}

function profileMenuHtml(user, prefix = '') {
  const role = user?.role || 'user';
  let items = '';
  if (role === 'club_head') {
    items = `
      <a href="${prefix}organizer/club-dashboard.html" role="menuitem">My Club</a>
      <a href="${prefix}organizer/club-dashboard.html#opportunities" role="menuitem">Club Dashboard</a>
      <a href="${prefix}notifications.html" role="menuitem">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a>
      <a href="${prefix}profile.html" role="menuitem">Profile</a>`;
  } else if (role === 'organizer') {
    items = `
      <a href="${prefix}organizer/dashboard.html" role="menuitem">Organizer Dashboard</a>
      <a href="${prefix}organizer/events.html" role="menuitem">My Events</a>
      <a href="${prefix}organizer/registrations.html" role="menuitem">Registrations</a>
      <a href="${prefix}organizer/check-in.html" role="menuitem">Check-in</a>
      <a href="${prefix}notifications.html" role="menuitem">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a>
      <a href="${prefix}profile.html" role="menuitem">Profile</a>`;
  } else if (role === 'admin') {
    items = `
      <a href="${prefix}admin/dashboard.html" role="menuitem">Admin Dashboard</a>
      <a href="${prefix}admin/events.html" role="menuitem">Events</a>
      <a href="${prefix}admin/clubs.html" role="menuitem">Clubs</a>
      <a href="${prefix}admin/users.html" role="menuitem">Users</a>
      <a href="${prefix}notifications.html" role="menuitem">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a>
      <a href="${prefix}profile.html#settings" role="menuitem">Settings</a>`;
  } else {
    items = `
      <a href="${prefix}my-bookings.html" role="menuitem">My Bookings</a>
      <a href="${prefix}saved-events.html" role="menuitem">Saved Events</a>
      <a href="${prefix}notifications.html" role="menuitem">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a>
      <a href="${prefix}support.html" role="menuitem">My Questions</a>
      <a href="${prefix}clubs.html" role="menuitem">Clubs</a>
      <a href="${prefix}profile.html" role="menuitem">Profile</a>
      <a href="${prefix}profile.html#settings" role="menuitem">Settings</a>`;
  }
  return `
    <div class="profile-menu-head">
      ${avatarHtml(user, 'profile-avatar-lg')}
      <div class="profile-menu-identity"><strong>${escapeHtml(user?.name || 'User')}</strong><span>${escapeHtml(user?.email || '')}</span></div>
    </div>
    <div class="profile-menu-links">${items}</div>
    <button id="logoutBtn" type="button" class="profile-menu-logout" role="menuitem">Sign out</button>`;
}

function mobileMenuHtml(user, links, prefix = '') {
  const loggedIn = Session.isLoggedIn();
  return `
    <div class="mobile-nav-links" id="mobileSiteNavLinks" aria-hidden="true">
      <div class="mobile-nav-primary">${links}</div>
      ${loggedIn ? `
        <div class="mobile-user-card">${avatarHtml(user)}<div><strong>${escapeHtml(user?.name || 'User')}</strong><span>${escapeHtml(user?.email || '')}</span></div></div>
        <div class="mobile-nav-secondary">
          ${profileMenuHtml(user, prefix).replace(/<div class="profile-menu-head">[\s\S]*?<\/div>\s*<div class="profile-menu-links">/, '').replace(/<\/div>\s*<button id="logoutBtn"[\s\S]*?<\/button>\s*$/, '')}
        </div>
        <button id="mobileLogoutBtn" type="button" class="mobile-logout">Sign out</button>
      ` : `
        <div class="mobile-auth-row"><a class="nav-signin" href="${prefix}login.html">Sign in</a><a class="nav-create" href="${prefix}register.html">Create account</a></div>
      `}
    </div>`;
}

// Mobile navigation state is stored on the navbar as .nav-open.
function closeMobileNavbar(navContainer) {
  navContainer?.classList.remove('nav-open');
  const toggle = navContainer?.querySelector('.mobile-nav-toggle');
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
    const icon = toggle.querySelector('.mobile-nav-toggle-icon');
    if (icon) icon.textContent = '☰';
  }
  const panel = navContainer?.querySelector('.mobile-nav-links');
  if (panel) panel.setAttribute('aria-hidden', 'true');
}

function setupMobileNavbar() {
  const navContainer = document.getElementById('navbar');
  if (!navContainer) return;
  const toggle = navContainer.querySelector('.mobile-nav-toggle');
  const panel = navContainer.querySelector('.mobile-nav-links');
  if (toggle && !toggle.dataset.bound) {
    toggle.dataset.bound = '1';
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = navContainer.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      if (panel) panel.setAttribute('aria-hidden', String(!open));
      const icon = toggle.querySelector('.mobile-nav-toggle-icon');
      if (icon) icon.textContent = open ? '✕' : '☰';
    });
  }
  navContainer.querySelectorAll('.mobile-nav-links a').forEach((link) => {
    if (link.dataset.bound) return;
    link.dataset.bound = '1';
    link.addEventListener('click', () => closeMobileNavbar(navContainer));
  });
  if (!navContainer.dataset.outsideBound) {
    navContainer.dataset.outsideBound = '1';
    document.addEventListener('click', (event) => {
      if (!navContainer.contains(event.target)) {
        closeMobileNavbar(navContainer);
        navContainer.querySelector('.nav-profile')?.classList.remove('open');
        navContainer.querySelector('.profile-trigger')?.setAttribute('aria-expanded', 'false');
      }
    });
  }
  const profile = navContainer.querySelector('.nav-profile');
  const profileToggle = navContainer.querySelector('.profile-trigger');
  if (profile && profileToggle && !profileToggle.dataset.bound) {
    profileToggle.dataset.bound = '1';
    profileToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = profile.classList.toggle('open');
      profileToggle.setAttribute('aria-expanded', String(open));
    });
  }
}

function buildNavbar({ activePage, role = 'user', prefix = '', home = 'index.html' }) {
  const navContainer = document.getElementById('navbar');
  if (!navContainer) return;
  const loggedIn = Session.isLoggedIn();
  const user = Session.getUser();
  const safeRole = loggedIn ? (user?.role || role || 'user') : 'user';
  const links = roleLinks(safeRole, activePage, prefix);
  const right = loggedIn ? `
    <div class="nav-profile">
      <button class="profile-trigger" type="button" aria-haspopup="true" aria-expanded="false">
        <span class="profile-avatar-wrap">${avatarHtml(user)}<span class="nav-notif-dot" data-nav-notif-dot hidden></span></span>
        <span class="profile-name">${escapeHtml((user?.name || 'User').split(' ')[0])}</span>
        <span class="profile-chevron" aria-hidden="true">⌄</span>
      </button>
      <div class="profile-menu" role="menu">${profileMenuHtml(user, prefix)}</div>
    </div>` : `
    <div class="nav-auth"><a class="nav-signin" href="${prefix}login.html">Sign in</a><a class="nav-create" href="${prefix}register.html">Create account</a></div>`;

  navContainer.innerHTML = `
    <div class="navbar-inner">
      <a class="brand" href="${prefix}${home}"><span class="brand-mark" aria-hidden="true">🎫</span><span class="brand-text">EventHub</span></a>
      <div class="desktop-nav"><div class="nav-links" id="desktopSiteNavLinks">${links}</div>${right}</div>
      <button class="mobile-nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="mobileSiteNavLinks"><span class="mobile-nav-toggle-icon">☰</span></button>
    </div>
    ${mobileMenuHtml(user, links, prefix)}`;

  document.getElementById('logoutBtn')?.addEventListener('click', () => performLogout('/index.html'));
  document.getElementById('mobileLogoutBtn')?.addEventListener('click', () => performLogout('/index.html'));
  setupMobileNavbar();
  if (loggedIn) refreshNotificationBadge();
}

function renderNavbar(activePage) {
  const user = Session.getUser();
  const role = user?.role || 'user';
  document.body?.classList.add('eh-page-' + String(activePage || 'page').replace(/[^a-z0-9_-]/gi, '-'));
  if (role === 'admin') return buildNavbar({ activePage, role, prefix: '', home: 'admin/dashboard.html' });
  if (role === 'organizer') return buildNavbar({ activePage, role, prefix: '', home: 'organizer/dashboard.html' });
  if (role === 'club_head') return buildNavbar({ activePage, role, prefix: '', home: 'organizer/club-dashboard.html' });
  return buildNavbar({ activePage, role: 'user', prefix: '', home: 'index.html' });
}

function renderOrganizerNavbar(activePage) {
  if (!Session.isLoggedIn() || !Session.isOrganizer()) return requireOrganizer();
  buildNavbar({ activePage: `organizer-${activePage}`, role: 'organizer', prefix: '../', home: 'dashboard.html' });
}

function renderAdminNavbar(activePage) {
  if (!Session.isLoggedIn() || !Session.isAdmin()) return requireAdmin();
  buildNavbar({ activePage: `admin-${activePage}`, role: 'admin', prefix: '../', home: 'dashboard.html' });
}

function renderClubHeadNavbar(activePage) {
  const user = Session.getUser();
  if (!Session.isLoggedIn() || user?.role !== 'club_head') return requireAuth();
  buildNavbar({ activePage: 'club-head', role: 'club_head', prefix: '../', home: 'club-dashboard.html' });
}

async function refreshNotificationBadge() {
  if (!Session.isLoggedIn()) return;
  try {
    const result = await Api.getNotifications();
    const count = Number(result?.unreadCount) || 0;
    document.querySelectorAll('[data-nav-notif-badge]').forEach((badge) => {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = count <= 0;
    });
    document.querySelectorAll('[data-nav-notif-dot]').forEach((dot) => { dot.hidden = count <= 0; });
  } catch (_) {}
}

function startNotificationBadgeRefresh() {
  if (window.__eventHubNotificationRefreshStarted) return;
  window.__eventHubNotificationRefreshStarted = true;
  const refresh = () => refreshNotificationBadge();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('focus', refresh);
  window.__eventHubNotificationTimer = setInterval(refresh, 30000);
}

startNotificationBadgeRefresh();
