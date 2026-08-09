// ---------- Configuration ----------
// The frontend is served by the same Express server, so relative /api paths work.
// If you serve the frontend separately, change API_BASE to e.g. 'http://localhost:5000/api'
const API_BASE = '/api';

// ---------- Session helpers ----------
const Session = {
  getToken() {
    return localStorage.getItem('ems_token');
  },
  getUser() {
    const raw = localStorage.getItem('ems_user');
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, user) {
    localStorage.setItem('ems_token', token);
    localStorage.setItem('ems_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('ems_token');
    localStorage.removeItem('ems_user');
  },
  isLoggedIn() {
    return !!Session.getToken();
  },
  isAdmin() {
    const user = Session.getUser();
    return !!user && user.role === 'admin';
  }
};

// ---------- Fetch wrapper ----------
async function apiRequest(path, { method = 'GET', body = null, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && Session.getToken()) {
    headers['Authorization'] = `Bearer ${Session.getToken()}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }

  if (!res.ok) {
    const message = (data && data.message) || `Request failed with status ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return data;
}

const Api = {
  // Auth
  register: (payload) => apiRequest('/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => apiRequest('/auth/login', { method: 'POST', body: payload, auth: false }),
  googleLogin: (credential) => apiRequest('/auth/google', { method: 'POST', body: { credential }, auth: false }),
  me: () => apiRequest('/auth/me'),
  getPublicConfig: () => apiRequest('/config', { auth: false }),

  // Events
  getEvents: (query = '') => apiRequest(`/events${query}`, { auth: false }),
  getAllEventsAdmin: () => apiRequest('/events/all'),
  getEvent: (id) => apiRequest(`/events/${id}`, { auth: false }),
  createEvent: (payload) => apiRequest('/events', { method: 'POST', body: payload }),
  updateEvent: (id, payload) => apiRequest(`/events/${id}`, { method: 'PUT', body: payload }),
  deleteEvent: (id) => apiRequest(`/events/${id}`, { method: 'DELETE' }),

  // Categories
  getCategories: () => apiRequest('/categories', { auth: false }),
  createCategory: (payload) => apiRequest('/categories', { method: 'POST', body: payload }),
  updateCategory: (id, payload) => apiRequest(`/categories/${id}`, { method: 'PUT', body: payload }),
  deleteCategory: (id) => apiRequest(`/categories/${id}`, { method: 'DELETE' }),

  // Bookings
  createBooking: (eventId) => apiRequest('/bookings', { method: 'POST', body: { eventId } }),
  getMyBookings: () => apiRequest('/bookings/my'),
  cancelBooking: (id) => apiRequest(`/bookings/${id}/cancel`, { method: 'PUT' }),
  getAllBookings: () => apiRequest('/bookings'),
  updateBookingStatus: (id, status) => apiRequest(`/bookings/${id}/status`, { method: 'PUT', body: { status } }),

  // Users / profile
  getProfile: () => apiRequest('/users/me'),
  updateProfile: (payload) => apiRequest('/users/me', { method: 'PUT', body: payload }),
  getAllUsers: () => apiRequest('/users'),
  updateUser: (id, payload) => apiRequest(`/users/${id}`, { method: 'PUT', body: payload }),
  deleteUser: (id) => apiRequest(`/users/${id}`, { method: 'DELETE' }),

  // Admin dashboard
  getDashboard: () => apiRequest('/admin/dashboard')
};

// ---------- Small UI helpers ----------
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function showAlert(containerEl, message, type = 'error') {
  if (!containerEl) return;
  containerEl.innerHTML = `<div class="alert alert-${type === 'error' ? 'error' : type}">${escapeHtml(message)}</div>`;
}

function clearAlert(containerEl) {
  if (containerEl) containerEl.innerHTML = '';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

// Requests a smaller, web-appropriate size from Unsplash's CDN instead of the
// full original photo (which can be several MB). This is the #1 fix for
// scroll jank/black-flash on mobile when many event photos are on screen —
// decoding several full-resolution images at once is heavy on phone GPUs.
// Falls through unchanged for any non-Unsplash image URL.
function optimizedImageUrl(url, width = 700) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname === 'images.unsplash.com') {
      u.searchParams.set('auto', 'format');
      u.searchParams.set('fit', 'crop');
      u.searchParams.set('w', String(width));
      u.searchParams.set('q', '70');
      return u.toString();
    }
  } catch (e) {
    // Not a valid absolute URL — just return it as-is
  }
  return url;
}

function eventShareUrl(eventId) {
  const url = new URL('event-details.html', window.location.href);
  url.searchParams.set('id', eventId);
  return url.href;
}

function calendarText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function calendarDate(date, time = '00:00') {
  const [year, month, day] = String(date).split('-').map(Number);
  const [hours, minutes] = String(time).split(':').map(Number);
  const local = new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0);
  const pad = (part) => String(part).padStart(2, '0');
  return `${local.getUTCFullYear()}${pad(local.getUTCMonth() + 1)}${pad(local.getUTCDate())}T${pad(local.getUTCHours())}${pad(local.getUTCMinutes())}00`;
}

function downloadCalendarEvent(event) {
  const start = calendarDate(event.date, event.time);
  const endDate = new Date(`${event.date}T${event.time || '00:00'}:00`);
  endDate.setHours(endDate.getHours() + 2);
  const pad = (part) => String(part).padStart(2, '0');
  const end = `${endDate.getUTCFullYear()}${pad(endDate.getUTCMonth() + 1)}${pad(endDate.getUTCDate())}T${pad(endDate.getUTCHours())}${pad(endDate.getUTCMinutes())}00`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EventHub//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:eventhub-${event.id}@eventhub`,
    `DTSTAMP:${calendarDate(new Date().toISOString().slice(0, 10), new Date().toTimeString().slice(0, 5))}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${calendarText(event.title)}`,
    `DESCRIPTION:${calendarText(event.description)}`,
    `LOCATION:${calendarText(event.location)}`,
    `URL:${eventShareUrl(event.id)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${String(event.title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event'}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function shareEvent(event) {
  const shareData = {
    title: event.title,
    text: `Join me at ${event.title} on ${formatDate(event.date)}.`,
    url: eventShareUrl(event.id)
  };
  if (navigator.share) {
    await navigator.share(shareData);
    return 'shared';
  }
  await navigator.clipboard.writeText(shareData.url);
  return 'copied';
}

function showToast(message, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast toast-${type} toast-visible`;
  clearTimeout(window.__eventHubToastTimer);
  window.__eventHubToastTimer = setTimeout(() => toast.classList.remove('toast-visible'), 2800);
}

function requireAuth() {
  if (!Session.isLoggedIn()) {
    window.location.href = 'login.html';
  }
}

function requireAdmin() {
  if (!Session.isLoggedIn() || !Session.isAdmin()) {
    window.location.href = 'login.html';
  }
}

function redirectIfLoggedIn() {
  if (Session.isLoggedIn()) {
    window.location.href = Session.isAdmin() ? 'admin/dashboard.html' : 'events.html';
  }
}

// ---------- Google Sign-In ----------
// Loads the Google Identity Services script (if needed), then renders a
// "Continue with Google" button into the given container element.
// onSuccess receives the parsed { token, user } response from our backend.
async function initGoogleSignIn(containerId, onSuccess, onError) {
  try {
    const { googleClientId } = await Api.getPublicConfig();
    if (!googleClientId) return; // Google Sign-In not configured on the server; just skip it

    const container = document.getElementById(containerId);
    if (!container) return;

    function render() {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          try {
            const data = await Api.googleLogin(response.credential);
            onSuccess(data);
          } catch (err) {
            onError && onError(err);
          }
        }
      });
      window.google.accounts.id.renderButton(container, {
        theme: 'filled_black',
        size: 'large',
        width: 360,
        shape: 'rectangular'
      });
    }

    if (window.google && window.google.accounts) {
      render();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = render;
      document.head.appendChild(script);
    }
  } catch (err) {
    // Silently skip Google Sign-In if the config request fails (e.g. offline)
  }
}
