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
    { href: 'events.html', label: 'Events', key: 'events' },
    { href: 'my-bookings.html', label: 'My Bookings', key: 'bookings', authOnly: true },
    { href: 'contact.html', label: 'Contact', key: 'contact' }
  ];

  const linksHtml = links
    .filter((l) => !l.authOnly || loggedIn)
    .map((l) => `<a href="${l.href}" class="${activePage === l.key ? 'active' : ''}">${l.label}</a>`)
    .join('');

  const rightHtml = loggedIn
    ? `
      <div class="nav-profile">
        <button class="profile-trigger" type="button" aria-haspopup="true" aria-expanded="false">
          ${avatarHtml(user)}
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
          <a href="profile.html" role="menuitem">Profile</a>
          <a href="my-bookings.html" role="menuitem">My Bookings</a>
          <button id="logoutBtn" type="button" role="menuitem">Logout</button>
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
      <a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">🎫</span> EventHub</a>
      <div class="desktop-nav">
        <div class="nav-links" id="siteNavLinks">${linksHtml}</div>
        ${rightHtml}
      </div>
      ${createMobileToggle(loggedIn ? user : null)}
    </div>
    <div class="mobile-nav-links" id="siteNavLinks">
      ${linksHtml}
      ${loggedIn ? `
        <a href="profile.html" class="${activePage === 'profile' ? 'active' : ''}">Profile</a>
        <div class="mobile-user-card">
          ${avatarHtml(user)}
          <div><strong>${escapeHtml(user.name || 'User')}</strong><span>${escapeHtml(user.email || '')}</span></div>
        </div>
        <button id="mobileLogoutBtn" type="button" class="mobile-logout">Logout</button>
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
    { href: 'users.html', label: 'Users', key: 'users' }
  ];

  const linksHtml = links
    .map((l) => `<a href="${l.href}" class="${activePage === l.key ? 'active' : ''}">${l.label}</a>`)
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
}
