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
    <button class="mobile-nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="siteNavLinks">
      ${avatar}
      <span class="mobile-nav-toggle-icon" aria-hidden="true">☰</span>
    </button>
  `;
}

function setupMobileNavbar() {
  const navContainer = document.getElementById('navbar');
  if (!navContainer) return;

  const toggle = navContainer.querySelector('.mobile-nav-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const isOpen = navContainer.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    const icon = toggle.querySelector('.mobile-nav-toggle-icon');
    if (icon) icon.textContent = isOpen ? '✕' : '☰';
  });

  navContainer.querySelectorAll('.nav-links a').forEach((link) => {
    link.addEventListener('click', () => closeMobileNavbar(navContainer));
  });

  document.addEventListener('click', (event) => {
    const profile = navContainer.querySelector('.nav-profile');
    if (profile && !profile.contains(event.target)) profile.classList.remove('open');
  });

  const profileToggle = navContainer.querySelector('.profile-trigger');
  if (profileToggle) {
    profileToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const profile = navContainer.querySelector('.nav-profile');
      if (profile) profile.classList.toggle('open');
    });
  }
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

function renderNavbar(activePage) {
  const navContainer = document.getElementById('navbar');
  if (!navContainer) return;

  const user = Session.getUser();
  const loggedIn = Session.isLoggedIn();

  const links = [
    { href: 'events.html', label: 'Discover', key: 'events' },
    { href: 'organizer/dashboard.html', label: 'Organizer Hub', key: 'organizer', organizerOnly: true },
    { href: 'saved-events.html', label: 'Saved Events', key: 'saved', authOnly: true },
    { href: 'my-bookings.html', label: 'My Bookings', key: 'bookings', authOnly: true },
    { href: 'notifications.html', label: 'Notifications', key: 'notifications', authOnly: true },
    { href: 'support.html', label: 'My Questions', key: 'support', authOnly: true },
    { href: 'clubs.html', label: 'Clubs', key: 'clubs' },
    { href: 'contact.html', label: 'Contact', key: 'contact' }
  ];

  const linksHtml = links
    .filter((l) => !l.authOnly || loggedIn)
    .map((l) => `<a href="${l.href}" class="${activePage === l.key ? 'active' : ''}">${l.label}</a>`)
    .join('');

  const greeting = loggedIn && user && user.name
    ? `Hi, ${escapeHtml(user.name.split(' ')[0])} 👋`
    : '';

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
          <div class="profile-menu-head">
            ${avatarHtml(user, 'profile-avatar-lg')}
            <div>
              <strong>${escapeHtml(user.name || 'User')}</strong>
              <span>${escapeHtml(user.email || '')}</span>
            </div>
          </div>
          <div class="profile-menu-greeting">${greeting}</div>
          <a href="my-bookings.html" role="menuitem">My Bookings</a>
          <a href="saved-events.html" role="menuitem">Saved Events</a>
          <a href="notifications.html" role="menuitem">Notifications<span class="nav-notif-badge" data-nav-notif-badge hidden>0</span></a>
          <a href="support.html" role="menuitem">My Questions</a>
          ${Session.isOrganizer() ? '<a href="organizer/dashboard.html" role="menuitem">Organizer Dashboard</a>' : ''}
          ${Session.isAdmin() ? '<a href="admin/dashboard.html" role="menuitem">Admin Dashboard</a>' : ''}
          <a href="profile.html" role="menuitem">Profile</a>
          <a href="profile.html#settings" role="menuitem">Settings</a>
          <button id="logoutBtn" type="button" role="menuitem">Sign out</button>
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
      <a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">🎫</span><span class="brand-text">EventHub</span></a>
      <div class="desktop-nav">
        <div class="nav-links" id="siteNavLinks">${linksHtml}</div>
        <button class="theme-quick-toggle" id="themeQuickToggle" type="button" aria-label="Toggle light and dark theme"></button>
        ${rightHtml}
      </div>
      <button class="theme-quick-toggle mobile-theme-toggle" id="themeQuickToggleMobile" type="button" aria-label="Toggle light and dark theme"></button>
      ${createMobileToggle(loggedIn ? user : null)}
    </div>
    <div class="mobile-nav-links" id="siteNavLinks">
      ${linksHtml}
      ${loggedIn ? `
        <div class="mobile-user-card">
          ${avatarHtml(user)}
          <div><strong>${escapeHtml(user.name || 'User')}</strong><span>${escapeHtml(user.email || '')}</span></div>
        </div>
        <a href="my-bookings.html" class="${activePage === 'bookings' ? 'active' : ''}">My Bookings</a>
        <a href="saved-events.html" class="${activePage === 'saved' ? 'active' : ''}">Saved Events</a>
        <a href="profile.html" class="${activePage === 'profile' ? 'active' : ''}">Profile</a>
        <a href="profile.html#settings" class="${activePage === 'settings' ? 'active' : ''}">Settings</a>
        <button id="mobileLogoutBtn" type="button" class="mobile-logout">Sign out</button>
      ` : `
        <div class="mobile-auth-row">
          <a class="nav-signin" href="login.html">Sign in</a>
          <a class="nav-create" href="register.html">Create account</a>
        </div>
      `}
    </div>
  `;

  const logout = () => {
    Session.clear();
    window.location.href = 'index.html';
  };

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
  if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', logout);

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

  setupMobileNavbar();

  if (loggedIn) refreshNotificationBadge();
}

// Fetches the real unread notification count from the backend and updates
// every badge element in the header (nav link badge x2 for desktop/mobile,
// plus the small dot on the avatar). Never shows a count when there are
// zero unread notifications — badges stay hidden until there's a real number.
async function refreshNotificationBadge() {
  try {
    const { unreadCount } = await Api.getNotifications();
    const badges = document.querySelectorAll('[data-nav-notif-badge]');
    const dots = document.querySelectorAll('[data-nav-notif-dot]');
    const hasUnread = Number(unreadCount) > 0;

    badges.forEach((badge) => {
      if (hasUnread) {
        badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    });
    dots.forEach((dot) => { dot.hidden = !hasUnread; });
  } catch (err) {
    // Non-critical — if this fails (e.g. offline), just leave badges hidden rather than erroring the page
  }
}

function renderOrganizerNavbar(activePage) {
  const navContainer = document.getElementById('navbar');
  if (!navContainer) return;

  const user = Session.getUser();

  const links = [
    { href: 'dashboard.html', label: 'Organizer Hub', key: 'dashboard' },
    { href: 'events.html', label: 'Events', key: 'events' },
    { href: 'registrations.html', label: 'Registrations', key: 'registrations' },
    { href: 'check-in.html', label: 'Check-in', key: 'check-in' },
    { href: '../notifications.html', label: 'Notifications', key: 'notifications', badge: true }
  ];

  const linksHtml = links
    .map((l) => `<a href="${l.href}" class="${activePage === l.key ? 'active' : ''}">${l.label}${l.badge ? '<span class="nav-notif-badge" data-nav-notif-badge hidden>0</span>' : ''}</a>`)
    .join('');

  navContainer.innerHTML = `
    <div class="navbar-inner">
      <a class="brand" href="dashboard.html"><span class="brand-mark" aria-hidden="true">🎪</span> EventHub Organizer</a>
      <div class="desktop-nav">
        <div class="nav-links" id="siteNavLinks">${linksHtml}</div>
        <a class="nav-admin-site" href="../events.html">View Site</a>
        <div class="nav-profile">
          <button class="profile-trigger" type="button">${avatarHtml(user || { name: 'O' })}<span class="profile-name">${escapeHtml(user ? user.name.split(' ')[0] : 'Organizer')}</span><span class="profile-chevron">⌄</span></button>
          <div class="profile-menu">
            <div class="profile-menu-head">${avatarHtml(user || { name: 'O' }, 'profile-avatar-lg')}<div><strong>${escapeHtml(user?.name || 'Organizer')}</strong><span>${escapeHtml(user?.email || '')}</span></div></div>
            <a href="../events.html">View Site</a>
            <a href="../profile.html">Profile</a>
            <button id="logoutBtn" type="button">Sign out</button>
          </div>
        </div>
      </div>
      ${createMobileToggle(user || { name: 'O' })}
    </div>
    <div class="mobile-nav-links" id="siteNavLinks">
      ${linksHtml}
      <a href="../events.html">View Site</a>
      <div class="mobile-user-card">${avatarHtml(user || { name: 'O' })}<div><strong>${escapeHtml(user?.name || 'Organizer')}</strong><span>${escapeHtml(user?.email || '')}</span></div></div>
      <button id="mobileLogoutBtn" type="button" class="mobile-logout">Sign out</button>
    </div>
  `;

  const logout = () => {
    Session.clear();
    window.location.href = '../index.html';
  };
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
  if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', logout);

  setupMobileNavbar();
  refreshNotificationBadge();
}

function renderOrganizerNavbar(activePage) {
  const navContainer = document.getElementById('navbar');
  if (!navContainer) return;

  const user = Session.getUser();

  const links = [
    { href: 'dashboard.html', label: 'Organizer Hub', key: 'dashboard' },
    { href: 'events.html', label: 'Events', key: 'events' },
    { href: 'registrations.html', label: 'Registrations', key: 'registrations' },
    { href: 'check-in.html', label: 'Check-in', key: 'check-in' }
  ];

  const linksHtml = links
    .map((l) => `<a href="${l.href}" class="${activePage === l.key ? 'active' : ''}">${l.label}</a>`)
    .join('');

  navContainer.innerHTML = `
    <div class="navbar-inner">
      <a class="brand" href="dashboard.html"><span class="brand-mark" aria-hidden="true">🎪</span> EventHub Organizer</a>
      <div class="desktop-nav">
        <div class="nav-links" id="siteNavLinks">${linksHtml}</div>
        <a class="nav-admin-site" href="../events.html">View Site</a>
        <div class="nav-profile">
          <button class="profile-trigger" type="button">${avatarHtml(user || { name: 'O' })}<span class="profile-name">${escapeHtml(user ? user.name.split(' ')[0] : 'Organizer')}</span><span class="profile-chevron">⌄</span></button>
          <div class="profile-menu">
            <div class="profile-menu-head">${avatarHtml(user || { name: 'O' }, 'profile-avatar-lg')}<div><strong>${escapeHtml(user?.name || 'Organizer')}</strong><span>${escapeHtml(user?.email || '')}</span></div></div>
            <a href="../events.html">View Site</a>
            <a href="../profile.html">Profile</a>
            <button id="logoutBtn" type="button">Sign out</button>
          </div>
        </div>
      </div>
      ${createMobileToggle(user || { name: 'O' })}
    </div>
    <div class="mobile-nav-links" id="siteNavLinks">
      ${linksHtml}
      <a href="../events.html">View Site</a>
      <div class="mobile-user-card">${avatarHtml(user || { name: 'O' })}<div><strong>${escapeHtml(user?.name || 'Organizer')}</strong><span>${escapeHtml(user?.email || '')}</span></div></div>
      <button id="mobileLogoutBtn" type="button" class="mobile-logout">Sign out</button>
    </div>
  `;

  const logout = () => {
    Session.clear();
    window.location.href = '../index.html';
  };
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
  if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', logout);

  setupMobileNavbar();
}

function renderAdminNavbar(activePage) {
  const navContainer = document.getElementById('navbar');
  if (!navContainer) return;

  const user = Session.getUser();

  const links = [
    { href: 'dashboard.html', label: 'Dashboard', key: 'dashboard' },
    { href: 'events.html', label: 'Events', key: 'events' },
    { href: 'categories.html', label: 'Categories', key: 'categories' },
    { href: 'bookings.html', label: 'Bookings', key: 'bookings' },
    { href: 'users.html', label: 'Users', key: 'users' },
    { href: 'clubs.html', label: 'Clubs', key: 'clubs' },
    { href: 'support.html', label: 'Support Inbox', key: 'support' },
    { href: '../notifications.html', label: 'Notifications', key: 'notifications', badge: true }
  ];

  const linksHtml = links
    .map((l) => `<a href="${l.href}" class="${activePage === l.key ? 'active' : ''}">${l.label}${l.badge ? '<span class="nav-notif-badge" data-nav-notif-badge hidden>0</span>' : ''}</a>`)
    .join('');

  navContainer.innerHTML = `
    <div class="navbar-inner">
      <a class="brand" href="dashboard.html"><span class="brand-mark" aria-hidden="true">🛠️</span> EventHub Admin</a>
      <div class="desktop-nav">
        <div class="nav-links" id="siteNavLinks">${linksHtml}</div>
        <a class="nav-admin-site" href="../events.html">View Site</a>
        <div class="nav-profile">
          <button class="profile-trigger" type="button">${avatarHtml(user || {name:'A'})}<span class="profile-name">${escapeHtml(user ? user.name.split(' ')[0] : 'Admin')}</span><span class="profile-chevron">⌄</span></button>
          <div class="profile-menu">
            <div class="profile-menu-head">${avatarHtml(user || {name:'A'}, 'profile-avatar-lg')}<div><strong>${escapeHtml(user?.name || 'Admin')}</strong><span>${escapeHtml(user?.email || '')}</span></div></div>
            <a href="../events.html">View Site</a>
            <button id="logoutBtn" type="button">Logout</button>
          </div>
        </div>
      </div>
      ${createMobileToggle(user || { name: 'A' })}
    </div>
    <div class="mobile-nav-links" id="siteNavLinks">
      ${linksHtml}
      <a href="../events.html">View Site</a>
      <div class="mobile-user-card">${avatarHtml(user || {name:'A'})}<div><strong>${escapeHtml(user?.name || 'Admin')}</strong><span>${escapeHtml(user?.email || '')}</span></div></div>
      <button id="mobileLogoutBtn" type="button" class="mobile-logout">Logout</button>
    </div>
  `;

  const logout = () => {
    Session.clear();
    window.location.href = '../login.html';
  };
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
  if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', logout);

  setupMobileNavbar();
  refreshNotificationBadge();
}
