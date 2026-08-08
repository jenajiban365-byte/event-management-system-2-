function renderNavbar(activePage) {
  const navContainer = document.getElementById('navbar');
  if (!navContainer) return;

  const user = Session.getUser();
  const loggedIn = Session.isLoggedIn();

  const links = [
    { href: 'events.html', label: 'Upcoming Events', key: 'events' },
    { href: 'my-bookings.html', label: 'My Bookings', key: 'bookings', authOnly: true },
    { href: 'profile.html', label: 'Profile', key: 'profile', authOnly: true }
  ];

  const linksHtml = links
    .filter((l) => !l.authOnly || loggedIn)
    .map((l) => `<a href="${l.href}" class="${activePage === l.key ? 'active' : ''}">${l.label}</a>`)
    .join('');

  const rightHtml = loggedIn
    ? `<span style="padding:8px 6px;color:var(--text-muted);font-size:0.9rem;">Hi, ${escapeHtml(user.name.split(' ')[0])}</span><button id="logoutBtn">Logout</button>`
    : `<a href="login.html">Login</a><a href="register.html">Register</a>`;

  navContainer.innerHTML = `
    <div class="brand"><span>🎫</span> EventHub</div>
    <div class="nav-links">
      ${linksHtml}
      ${rightHtml}
    </div>
  `;

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      Session.clear();
      window.location.href = 'index.html';
    });
  }
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
    <div class="brand"><span>🛠️</span> EventHub Admin</div>
    <div class="nav-links">
      ${linksHtml}
      <a href="../events.html">View Site</a>
      <span style="padding:8px 6px;color:var(--text-muted);font-size:0.9rem;">Hi, ${escapeHtml(user ? user.name.split(' ')[0] : '')}</span>
      <button id="logoutBtn">Logout</button>
    </div>
  `;

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      Session.clear();
      window.location.href = '../login.html';
    });
  }
}
