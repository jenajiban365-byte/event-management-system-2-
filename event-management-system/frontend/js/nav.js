function avatarHtml(user, extraClass = '') {
  const initial = escapeHtml((user?.name || 'U').charAt(0).toUpperCase());
  const avatar = user && user.avatarUrl
    ? `<img class="profile-avatar-img" src="${escapeHtml(user.avatarUrl)}" alt="" />`
    : initial;
  return `<span class="profile-avatar ${extraClass}" aria-hidden="true">${avatar}</span>`;
}

function createMobileToggle(user) {
  const avatar = user ? avatarHtml(user, 'mobile-toggle-avatar') : '';
  return `
    <button class="mobile-nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="mobileSiteNavLinks">
      ${avatar}
      <span class="mobile-nav-toggle-icon" aria-hidden="true">☰</span>
    </button>
  `;
}

function closeMobileNavbar(navContainer) {
  navContainer.classList.remove('nav-open');
  const toggle = navContainer.querySelector('.mobile-nav-toggle');
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
    const icon = toggle.querySelector('.mobile-nav-toggle-icon');
    if (icon) icon.textContent = '☰';
  }
}

function setupMobileNavbar() {
  const navContainer = document.getElementById('navbar');
  if (!navContainer) return;

  const toggle = navContainer.querySelector('.mobile-nav-toggle');
  if (toggle && !toggle.dataset.bound) {
    toggle.dataset.bound = '1';
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = navContainer.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
      const icon = toggle.querySelector('.mobile-nav-toggle-icon');
      if (icon) icon.textContent = isOpen ? '✕' : '☰';
    });
  }

  navContainer.querySelectorAll('.mobile-nav-links a').forEach((link) => {
    if (link.dataset.bound) return;
    link.dataset.bound = '1';
    link.addEventListener('click', () => closeMobileNavbar(navContainer));
  });

  if (!navContainer.dataset.profileOutsideBound) {
    navContainer.dataset.profileOutsideBound = '1';
    document.addEventListener('click', (event) => {
      const profile = navContainer.querySelector('.nav-profile');
      if (profile && !profile.contains(event.target)) profile.classList.remove('open');
    });
  }

  const profileToggle = navContainer.querySelector('.profile-trigger');
  if (profileToggle && !profileToggle.dataset.bound) {
    profileToggle.dataset.bound = '1';
    profileToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const profile = navContainer.querySelector('.nav-profile');
      if (profile) profile.classList.toggle('open');
    });
  }
}

function navNotificationLink(href, activePage) {
  return `<a href="${href}" class="${activePage === 'notifications' ? 'active' : ''}">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a>`;
}

function profileMenuHtml(user, prefix = '') {
  const role = user?.role || 'user';
  const base = prefix;
  let items = '';

  if (role === 'club_head') {
    items = `
      <a href="${base}organizer/club-dashboard.html" role="menuitem">My Club</a>
      <a href="${base}organizer/club-dashboard.html#opportunities" role="menuitem">Club Dashboard</a>
      <a href="${base}notifications.html" role="menuitem">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a>
      <a href="${base}profile.html" role="menuitem">Profile</a>
    `;
  } else if (role === 'organizer') {
    items = `
      <a href="${base}organizer/dashboard.html" role="menuitem">Organizer Dashboard</a>
      <a href="${base}organizer/events.html" role="menuitem">My Events</a>
      <a href="${base}organizer/registrations.html" role="menuitem">Registrations</a>
      <a href="${base}organizer/check-in.html" role="menuitem">Check-in</a>
      <a href="${base}notifications.html" role="menuitem">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a>
      <a href="${base}profile.html" role="menuitem">Profile</a>
      <a href="${base}profile.html#settings" role="menuitem">Settings</a>
      <a href="${base}events.html" role="menuitem">View Student Site</a>
    `;
  } else if (role === 'admin') {
    items = `
      <a href="${base}admin/dashboard.html" role="menuitem">Admin Dashboard</a>
      <a href="${base}admin/events.html" role="menuitem">Events</a>
      <a href="${base}admin/clubs.html" role="menuitem">Clubs</a>
      <a href="${base}admin/users.html" role="menuitem">Users</a>
      <a href="${base}notifications.html" role="menuitem">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a>
      <a href="${base}profile.html" role="menuitem">Profile</a>
      <a href="${base}profile.html#settings" role="menuitem">Settings</a>
      <a href="${base}events.html" role="menuitem">View Student Site</a>
    `;
  } else {
    items = `
      <a href="${base}my-bookings.html" role="menuitem">My Bookings</a>
      <a href="${base}saved-events.html" role="menuitem">Saved Events</a>
      <a href="${base}notifications.html" role="menuitem">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a>
      <a href="${base}support.html" role="menuitem">My Questions</a>
      <a href="${base}clubs.html" role="menuitem">Clubs</a>
      <a href="${base}contact.html" role="menuitem">Contact</a>
      <a href="${base}profile.html" role="menuitem">Profile</a>
      <a href="${base}profile.html#settings" role="menuitem">Settings</a>
    `;
  }

  return `
    <div class="profile-menu-head">
      ${avatarHtml(user, 'profile-avatar-lg')}
      <div>
        <strong>${escapeHtml(user?.name || 'User')}</strong>
        <span>${escapeHtml(user?.email || '')}</span>
      </div>
    </div>
    ${items}
    <button id="logoutBtn" type="button" role="menuitem">Sign out</button>
  `;
}

function bindThemeToggle() {
  function updateThemeQuickToggle() {
    const selected = document.body?.dataset.theme === 'light' ? 'light' : 'dark';
    const buttons = [document.getElementById('themeQuickToggle'), document.getElementById('themeQuickToggleMobile')];
    buttons.forEach((button) => {
      if (!button) return;
      button.textContent = selected === 'dark' ? '☀️' : '🌙';
      button.title = selected === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
      button.setAttribute('aria-label', button.title);
    });
  }

  const toggleTheme = () => {
    const current = document.body?.dataset.theme === 'light' ? 'light' : 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('eventhub_theme', next);
    applyEventHubTheme(next);
    updateThemeQuickToggle();
  };

  document.getElementById('themeQuickToggle')?.addEventListener('click', toggleTheme);
  document.getElementById('themeQuickToggleMobile')?.addEventListener('click', toggleTheme);
  updateThemeQuickToggle();
}

function performLogout(redirectTo = 'index.html') {
  Session.clear();
  localStorage.removeItem('eventhub_saved_events');
  window.location.href = redirectTo;
}

function renderNavbar(activePage) {
  const navContainer = document.getElementById('navbar');
  if (!navContainer) return;

  const user = Session.getUser();
  const loggedIn = Session.isLoggedIn();
  const role = user?.role || 'user';
  const homePrefix = '';

  let linksHtml = '';
  if (role === 'club_head') {
    linksHtml = [
      `<a href="/organizer/club-dashboard.html" class="${activePage === 'club-head' ? 'active' : ''}">My Club</a>`,
      `<a href="/events.html" class="${activePage === 'events' ? 'active' : ''}">Discover</a>`,
      navNotificationLink('/notifications.html', activePage),
      `<a href="/contact.html" class="${activePage === 'contact' ? 'active' : ''}">Contact</a>`
    ].join('');
  } else if (role === 'organizer') {
    linksHtml = [
      `<a href="organizer/dashboard.html" class="${activePage === 'organizer' ? 'active' : ''}">Organizer Dashboard</a>`,
      `<a href="organizer/events.html" class="${activePage === 'organizer-events' ? 'active' : ''}">My Events</a>`,
      `<a href="organizer/registrations.html" class="${activePage === 'organizer-registrations' ? 'active' : ''}">Registrations</a>`,
      `<a href="organizer/check-in.html" class="${activePage === 'organizer-checkin' ? 'active' : ''}">Check-in</a>`,
      navNotificationLink('notifications.html', activePage)
    ].join('');
  } else if (role === 'admin') {
    linksHtml = [
      `<a href="admin/dashboard.html" class="${activePage === 'admin' ? 'active' : ''}">Admin Dashboard</a>`,
      `<a href="admin/events.html" class="${activePage === 'admin-events' ? 'active' : ''}">Events</a>`,
      `<a href="admin/clubs.html" class="${activePage === 'admin-clubs' ? 'active' : ''}">Clubs</a>`,
      `<a href="admin/users.html" class="${activePage === 'admin-users' ? 'active' : ''}">Users</a>`,
      navNotificationLink('notifications.html', activePage)
    ].join('');
  } else {
    linksHtml = [
      `<a href="events.html" class="${activePage === 'events' ? 'active' : ''}">Discover</a>`,
      `<a href="clubs.html" class="${activePage === 'clubs' ? 'active' : ''}">Clubs</a>`,
      ...(loggedIn ? [
        `<a href="saved-events.html" class="${activePage === 'saved' ? 'active' : ''}">Saved Events</a>`,
        `<a href="my-bookings.html" class="${activePage === 'bookings' ? 'active' : ''}">My Bookings</a>`,
        navNotificationLink('notifications.html', activePage)
      ] : []),
      `<a href="contact.html" class="${activePage === 'contact' ? 'active' : ''}">Contact</a>`
    ].join('');
  }

  const mobileSecondaryHtml = role === 'club_head'
    ? `
        <a href="/organizer/club-dashboard.html">My Club</a>
        <a href="/events.html">Discover</a>
        <a href="/clubs.html">Clubs</a>
        <a href="/notifications.html">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a>
        <a href="/contact.html">Contact</a>
        <a href="/profile.html">Profile</a>
      `
    : role === 'organizer'
    ? `
        <a href="organizer/dashboard.html">Organizer Dashboard</a>
        <a href="organizer/events.html">My Events</a>
        <a href="organizer/registrations.html">Registrations</a>
        <a href="organizer/check-in.html">Check-in</a>
        <a href="notifications.html">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a>
      `
    : role === 'admin'
      ? `
        <a href="admin/dashboard.html">Admin Dashboard</a>
        <a href="admin/events.html">Events</a>
        <a href="admin/clubs.html">Clubs</a>
        <a href="admin/users.html">Users</a>
        <a href="notifications.html">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a>
      `
      : `
        <a href="my-bookings.html">My Bookings</a>
        <a href="saved-events.html">Saved Events</a>
        <a href="notifications.html">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a>
        <a href="support.html">My Questions</a>
        <a href="profile.html">Profile</a>
        <a href="profile.html#settings">Settings</a>
      `;

  const rightHtml = loggedIn
    ? `
      <div class="nav-profile">
        <button class="profile-trigger" type="button" aria-haspopup="true" aria-expanded="false">
          <span class="profile-avatar-wrap">
            ${avatarHtml(user)}
            <span class="nav-notif-dot" data-nav-notif-dot hidden aria-hidden="true"></span>
          </span>
          <span class="profile-name">${escapeHtml((user.name || 'User').split(' ')[0])}</span>
          <span class="profile-chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="profile-menu" role="menu">
          ${profileMenuHtml(user, homePrefix)}
        </div>
      </div>
    `
    : `
      <div class="nav-auth">
        <a class="nav-signin" href="login.html">Sign in</a>
        <a class="nav-create" href="register.html">Create account</a>
      </div>
    `;

  navContainer.innerHTML = `
    <div class="navbar-inner">
      <a class="brand" href="${role === 'admin' ? 'admin/dashboard.html' : role === 'organizer' ? 'organizer/dashboard.html' : role === 'club_head' ? '/organizer/club-dashboard.html' : 'index.html'}"><span class="brand-mark" aria-hidden="true">🎫</span><span class="brand-text">EventHub</span></a>
      <div class="desktop-nav">
        <div class="nav-links" id="desktopSiteNavLinks">${linksHtml}</div>
        <button class="theme-quick-toggle" id="themeQuickToggle" type="button" aria-label="Toggle light and dark theme"></button>
        ${rightHtml}
      </div>
      <button class="theme-quick-toggle mobile-theme-toggle" id="themeQuickToggleMobile" type="button" aria-label="Toggle light and dark theme"></button>
      ${createMobileToggle(loggedIn ? user : null)}
    </div>
    <div class="mobile-nav-links" id="mobileSiteNavLinks">
      ${linksHtml}
      ${loggedIn ? `
        <div class="mobile-user-card">
          ${avatarHtml(user)}
          <div><strong>${escapeHtml(user.name || 'User')}</strong><span>${escapeHtml(user.email || '')}</span></div>
        </div>
        ${mobileSecondaryHtml}
        <button id="mobileLogoutBtn" type="button" class="mobile-logout">Sign out</button>
      ` : `
        <div class="mobile-auth-row">
          <a class="nav-signin" href="login.html">Sign in</a>
          <a class="nav-create" href="register.html">Create account</a>
        </div>
      `}
    </div>
  `;

  const logout = () => performLogout('/index.html');
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  document.getElementById('mobileLogoutBtn')?.addEventListener('click', logout);

  bindThemeToggle();
  setupMobileNavbar();
  if (loggedIn) refreshNotificationBadge();
}

async function refreshNotificationBadge() {
  if (!Session.isLoggedIn()) return;
  try {
    const { unreadCount } = await Api.getNotifications();
    const count = Number(unreadCount) || 0;
    const hasUnread = count > 0;
    document.querySelectorAll('[data-nav-notif-badge]').forEach((badge) => {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = !hasUnread;
    });
    document.querySelectorAll('[data-nav-notif-dot]').forEach((dot) => {
      dot.hidden = !hasUnread;
    });
  } catch (err) {
  }
}

function startNotificationBadgeRefresh() {
  if (window.__eventHubNotificationRefreshStarted) return;
  window.__eventHubNotificationRefreshStarted = true;
  const refresh = () => refreshNotificationBadge();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  window.addEventListener('focus', refresh);
  window.__eventHubNotificationTimer = setInterval(refresh, 30000);
}

function renderOrganizerNavbar(activePage) {
  const navContainer = document.getElementById('navbar');
  if (!navContainer) return;
  const user = Session.getUser();
  if (!Session.isLoggedIn() || !Session.isOrganizer()) return requireOrganizer();

  const links = [
    `<a href="dashboard.html" class="${activePage === 'dashboard' ? 'active' : ''}">Organizer Dashboard</a>`,
    `<a href="events.html" class="${activePage === 'events' ? 'active' : ''}">My Events</a>`,
    `<a href="registrations.html" class="${activePage === 'registrations' ? 'active' : ''}">Registrations</a>`,
    `<a href="check-in.html" class="${activePage === 'check-in' ? 'active' : ''}">Check-in</a>`,
    navNotificationLink('../notifications.html', activePage)
  ].join('');

  navContainer.innerHTML = `
    <div class="navbar-inner">
      <a class="brand" href="dashboard.html"><span class="brand-mark" aria-hidden="true">🎫</span><span class="brand-text">EventHub</span></a>
      <div class="desktop-nav">
        <div class="nav-links" id="desktopSiteNavLinks">${links}</div>
        <button class="theme-quick-toggle" id="themeQuickToggle" type="button" aria-label="Toggle light and dark theme"></button>
        <div class="nav-profile">
          <button class="profile-trigger" type="button" aria-haspopup="true" aria-expanded="false"><span class="profile-avatar-wrap">${avatarHtml(user)}<span class="nav-notif-dot" data-nav-notif-dot hidden></span></span><span class="profile-name">${escapeHtml((user?.name || 'Organizer').split(' ')[0])}</span><span class="profile-chevron">⌄</span></button>
          <div class="profile-menu" role="menu">
            ${profileMenuHtml(user, '../')}
          </div>
        </div>
      </div>
      <button class="theme-quick-toggle mobile-theme-toggle" id="themeQuickToggleMobile" type="button" aria-label="Toggle light and dark theme"></button>
      ${createMobileToggle(user)}
    </div>
    <div class="mobile-nav-links" id="mobileSiteNavLinks">${links}<a href="../notifications.html">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a><button id="mobileLogoutBtn" type="button" class="mobile-logout">Sign out</button></div>
  `;
  document.getElementById('logoutBtn')?.addEventListener('click', () => performLogout('/index.html'));
  document.getElementById('mobileLogoutBtn')?.addEventListener('click', () => performLogout('/index.html'));
  bindThemeToggle(); setupMobileNavbar(); refreshNotificationBadge();
}

function renderAdminNavbar(activePage) {
  const navContainer = document.getElementById('navbar');
  if (!navContainer) return;
  const user = Session.getUser();
  if (!Session.isLoggedIn() || !Session.isAdmin()) return requireAdmin();

  const links = [
    `<a href="dashboard.html" class="${activePage === 'dashboard' ? 'active' : ''}">Admin Dashboard</a>`,
    `<a href="events.html" class="${activePage === 'events' ? 'active' : ''}">Events</a>`,
    `<a href="clubs.html" class="${activePage === 'clubs' ? 'active' : ''}">Clubs</a>`,
    `<a href="users.html" class="${activePage === 'users' ? 'active' : ''}">Users</a>`,
    navNotificationLink('../notifications.html', activePage)
  ].join('');

  navContainer.innerHTML = `
    <div class="navbar-inner">
      <a class="brand" href="dashboard.html"><span class="brand-mark" aria-hidden="true">🎫</span><span class="brand-text">EventHub</span></a>
      <div class="desktop-nav">
        <div class="nav-links" id="desktopSiteNavLinks">${links}</div>
        <button class="theme-quick-toggle" id="themeQuickToggle" type="button" aria-label="Toggle light and dark theme"></button>
        <div class="nav-profile">
          <button class="profile-trigger" type="button" aria-haspopup="true" aria-expanded="false"><span class="profile-avatar-wrap">${avatarHtml(user)}<span class="nav-notif-dot" data-nav-notif-dot hidden></span></span><span class="profile-name">${escapeHtml((user?.name || 'Admin').split(' ')[0])}</span><span class="profile-chevron">⌄</span></button>
          <div class="profile-menu" role="menu">
            ${profileMenuHtml(user, '../')}
          </div>
        </div>
      </div>
      <button class="theme-quick-toggle mobile-theme-toggle" id="themeQuickToggleMobile" type="button" aria-label="Toggle light and dark theme"></button>
      ${createMobileToggle(user)}
    </div>
    <div class="mobile-nav-links" id="mobileSiteNavLinks">${links}<a href="../notifications.html">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a><button id="mobileLogoutBtn" type="button" class="mobile-logout">Sign out</button></div>
  `;
  document.getElementById('logoutBtn')?.addEventListener('click', () => performLogout('/index.html'));
  document.getElementById('mobileLogoutBtn')?.addEventListener('click', () => performLogout('/index.html'));
  bindThemeToggle(); setupMobileNavbar(); refreshNotificationBadge();
}

function renderClubHeadNavbar(activePage) {
  const navContainer = document.getElementById('navbar');
  if (!navContainer) return;
  const user = Session.getUser();
  if (!Session.isLoggedIn() || user.role !== 'club_head') return requireAuth();

  const links = [
    `<a href="club-dashboard.html" class="${activePage === 'dashboard' ? 'active' : ''}">My Club</a>`,
    `<a href="../events.html" class="${activePage === 'events' ? 'active' : ''}">Discover</a>`,
    navNotificationLink('../notifications.html', activePage)
  ].join('');

  navContainer.innerHTML = `
    <div class="navbar-inner">
      <a class="brand" href="club-dashboard.html"><span class="brand-mark" aria-hidden="true">🎫</span><span class="brand-text">EventHub</span></a>
      <div class="desktop-nav">
        <div class="nav-links" id="desktopSiteNavLinks">${links}</div>
        <button class="theme-quick-toggle" id="themeQuickToggle" type="button" aria-label="Toggle light and dark theme"></button>
        <div class="nav-profile">
          <button class="profile-trigger" type="button" aria-haspopup="true" aria-expanded="false"><span class="profile-avatar-wrap">${avatarHtml(user)}<span class="nav-notif-dot" data-nav-notif-dot hidden></span></span><span class="profile-name">${escapeHtml((user?.name || 'Club Head').split(' ')[0])}</span><span class="profile-chevron">⌄</span></button>
          <div class="profile-menu" role="menu">
            ${profileMenuHtml(user, '../')}
          </div>
        </div>
      </div>
      <button class="theme-quick-toggle mobile-theme-toggle" id="themeQuickToggleMobile" type="button" aria-label="Toggle light and dark theme"></button>
      ${createMobileToggle(user)}
    </div>
    <div class="mobile-nav-links" id="mobileSiteNavLinks">${links}<a href="../notifications.html">Notifications <span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a><button id="mobileLogoutBtn" type="button" class="mobile-logout">Sign out</button></div>
  `;
  document.getElementById('logoutBtn')?.addEventListener('click', () => performLogout('/index.html'));
  document.getElementById('mobileLogoutBtn')?.addEventListener('click', () => performLogout('/index.html'));
  bindThemeToggle(); setupMobileNavbar(); refreshNotificationBadge();
}

startNotificationBadgeRefresh();