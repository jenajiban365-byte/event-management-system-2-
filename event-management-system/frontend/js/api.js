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

function getStoredTheme() {
  const theme = localStorage.getItem('eventhub_theme') || 'system';
  return theme === 'dark' || theme === 'light' || theme === 'system' ? theme : 'system';
}

function getSystemColorMode() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyEventHubTheme(mode = getStoredTheme()) {
  const selectedMode = mode === 'dark' || mode === 'light' || mode === 'system' ? mode : 'system';
  const resolvedMode = selectedMode === 'system' ? getSystemColorMode() : selectedMode;
  const body = document.body;
  if (!body) return;
  body.setAttribute('data-theme', resolvedMode);
  body.classList.toggle('eventhub-light', resolvedMode === 'light');
  body.classList.toggle('eventhub-dark', resolvedMode === 'dark');

  const selectValues = [document.getElementById('themeSelect'), document.getElementById('mobileThemeSelect')];
  selectValues.forEach((control) => {
    if (control) control.value = selectedMode;
  });
}

function initThemeSupport() {
  const selectedTheme = getStoredTheme();
  applyEventHubTheme(selectedTheme);

  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  if (media && media.addEventListener) {
    media.addEventListener('change', () => {
      const theme = getStoredTheme();
      if (theme === 'system') applyEventHubTheme('system');
    });
  }
}

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
  verifyEmail: (token) => apiRequest(`/auth/verify-email?token=${encodeURIComponent(token)}`, { auth: false }),
  resendVerification: (email) => apiRequest('/auth/resend-verification', { method: 'POST', body: { email }, auth: false }),
  forgotPassword: (email) => apiRequest('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: (token, password) => apiRequest('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false }),
  submitContactForm: (payload) => apiRequest('/contact', { method: 'POST', body: payload, auth: false }),
  createSupportTicket: (payload) => apiRequest('/support', { method: 'POST', body: payload }),
  getMySupportTickets: () => apiRequest('/support/mine'),
  getSupportTickets: () => apiRequest('/support'),
  replyToSupportTicket: (id, message) => apiRequest(`/support/${id}/reply`, { method: 'POST', body: { message } }),
  updateSupportTicket: (id, status) => apiRequest(`/support/${id}/status`, { method: 'PUT', body: { status } }),
  getNotifications: () => apiRequest('/notifications/my'),
  markAllNotificationsRead: () => apiRequest('/notifications/read-all', { method: 'PUT' }),
  getClubs: () => apiRequest('/clubs', { auth: false }),
  requestClub: (payload) => apiRequest('/clubs/request', { method: 'POST', body: payload }),
  toggleClubFollow: (id) => apiRequest(`/clubs/${id}/follow`, { method: 'POST' }),
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

  // Saved events (persistent college feature)
  getSavedEvents: () => apiRequest('/saved-events'),
  getSavedEventIds: () => apiRequest('/saved-events/ids'),
  saveEvent: (id) => apiRequest(`/saved-events/${id}`, { method: 'POST' }),
  removeSavedEvent: (id) => apiRequest(`/saved-events/${id}`, { method: 'DELETE' }),

  // Organizer / college workflows
  getOrganizerDashboard: () => apiRequest('/organizer/dashboard'),
  getOrganizerEvents: () => apiRequest('/organizer/events'),
  createOrganizerEvent: (payload) => apiRequest('/organizer/events', { method: 'POST', body: payload }),
  updateOrganizerEvent: (id, payload) => apiRequest(`/organizer/events/${id}`, { method: 'PUT', body: payload }),
  getOrganizerRegistrations: (id) => apiRequest(`/organizer/events/${id}/registrations`),
  updateOrganizerRegistration: (id, status) => apiRequest(`/organizer/registrations/${id}/status`, { method: 'PUT', body: { status } }),
  announceOrganizerEvent: (id, payload) => apiRequest(`/organizer/events/${id}/announce`, { method: 'POST', body: payload }),
  checkInAttendee: (code) => apiRequest('/organizer/check-in', { method: 'POST', body: { code } }),
  getPendingEvents: () => apiRequest('/admin/pending-events'),
  approveEvent: (id, status, note) => apiRequest(`/events/${id}/approval`, { method: 'PUT', body: { status, note } }),

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

  // Waitlist
  getWaitlistStatus: (eventId) => apiRequest(`/waitlist/status/${encodeURIComponent(eventId)}`),
  joinWaitlist: (eventId) => apiRequest('/waitlist', { method: 'POST', body: { eventId } }),
  leaveWaitlist: (eventId) => apiRequest(`/waitlist/${encodeURIComponent(eventId)}`, { method: 'DELETE' }),

  // Users / profile
  getProfile: () => apiRequest('/users/me'),
  updateProfile: (payload) => apiRequest('/users/me', { method: 'PUT', body: payload }),
  getAllUsers: () => apiRequest('/users'),
  updateUser: (id, payload) => apiRequest(`/users/${id}`, { method: 'PUT', body: payload }),
  deleteUser: (id) => apiRequest(`/users/${id}`, { method: 'DELETE' }),

  // Admin dashboard
  getDashboard: () => apiRequest('/admin/dashboard'),
  geocodeAddress: (address) => apiRequest(`/geocode?address=${encodeURIComponent(address)}`)
};


// ---------- Location helpers ----------
// Uses the browser's built-in Geolocation API. No Google Maps API or AI is needed.
const GEOLOCATION_EXCELLENT_ACCURACY_METERS = 250;
const GEOLOCATION_MODERATE_ACCURACY_METERS = 5000;
const GEOLOCATION_POOR_ACCURACY_METERS = 25000;

function getLocationAccuracyQuality(accuracy) {
  const numeric = Number(accuracy);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { level: 'poor', label: 'unreliable', approximate: true, sortable: false };
  }

  if (numeric <= GEOLOCATION_EXCELLENT_ACCURACY_METERS) {
    return { level: 'excellent', label: 'excellent', approximate: false, sortable: true };
  }

  if (numeric <= GEOLOCATION_MODERATE_ACCURACY_METERS) {
    return { level: 'moderate', label: 'moderate', approximate: true, sortable: true };
  }

  if (numeric <= GEOLOCATION_POOR_ACCURACY_METERS) {
    return { level: 'poor', label: 'low', approximate: true, sortable: false };
  }

  return { level: 'poor', label: 'unreliable', approximate: true, sortable: false };
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported by this browser.'));
      return;
    }

    // High-accuracy GPS can take too long on phones and desktop browsers.
    // Start with a fast network/cached location, then fall back to GPS only
    // if the browser cannot provide a position quickly enough.
    let settled = false;

    const finish = (position) => {
      if (settled) return;
      const latitude = Number(position.coords.latitude);
      const longitude = Number(position.coords.longitude);
      const accuracy = Number(position.coords.accuracy);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy) || accuracy < 0) {
        settled = true;
        reject(new Error('The browser returned an invalid location result. Please try again.'));
        return;
      }

      settled = true;
      resolve({
        latitude,
        longitude,
        accuracy,
        quality: getLocationAccuracyQuality(accuracy)
      });
    };

    const handlePermissionError = (error) => {
      if (settled) return;
      // Permission denial should never trigger another location request.
      if (error.code === 1) {
        settled = true;
        reject(new Error('Location permission was denied. Please allow location access in your browser settings and try again.'));
      }
    };

    const requestHighAccuracy = () => {
      if (settled) return;
      navigator.geolocation.getCurrentPosition(
        finish,
        (error) => {
          if (settled) return;
          handlePermissionError(error);
          if (settled) return;
          settled = true;
          const message = error.code === 3
            ? 'Location is taking too long to determine. Please make sure Location/GPS is enabled and try again.'
            : 'Your location could not be determined. Please try again.';
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 60000
        }
      );
    };

    navigator.geolocation.getCurrentPosition(
      finish,
      (error) => {
        if (settled) return;
        handlePermissionError(error);
        if (settled) return;

        // TIMEOUT/position-unavailable: retry with GPS and a longer window.
        // This is especially helpful on mobile Chrome where the first
        // network-based request can occasionally fail.
        requestHighAccuracy();
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 120000
      }
    );
  });
}

function isValidCoordinatePair(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  if (lat === 0 && lon === 0) return false;
  return true;
}

// Haversine formula: returns straight-line distance in kilometres.
function distanceInKm(lat1, lon1, lat2, lon2) {
  const values = [lat1, lon1, lat2, lon2].map(Number);
  if (values.some((value) => !Number.isFinite(value))) return null;
  if (!isValidCoordinatePair(values[0], values[1])) return null;
  if (!isValidCoordinatePair(values[2], values[3])) return null;

  const toRadians = (degrees) => degrees * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(values[2] - values[0]);
  const dLon = toRadians(values[3] - values[1]);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(values[0])) *
    Math.cos(toRadians(values[2])) *
    Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  if (!Number.isFinite(km) || km === null || km === undefined) return '';
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

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

function localEventDate(date, time = '00:00') {
  const [year, month, day] = String(date).split('-').map(Number);
  const [hours, minutes] = String(time).split(':').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0);
}

function calendarDate(date, time = '00:00') {
  const d = date instanceof Date ? date : localEventDate(date, time);
  const pad = (part) => String(part).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

function googleCalendarUrl(event) {
  const startDate = localEventDate(event.date, event.time);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || 'EventHub event',
    dates: `${calendarDate(startDate)}/${calendarDate(endDate)}`,
    details: event.description || '',
    location: event.location || '',
    sf: 'true',
    output: 'xml'
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function downloadCalendarEvent(event) {
  const startDate = localEventDate(event.date, event.time);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EventHub//Event Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:eventhub-${event.id}@eventhub`, `DTSTAMP:${calendarDate(new Date())}`, `DTSTART:${calendarDate(startDate)}`, `DTEND:${calendarDate(endDate)}`,
    `SUMMARY:${calendarText(event.title)}`, `DESCRIPTION:${calendarText(event.description)}`, `LOCATION:${calendarText(event.location)}`, `URL:${eventShareUrl(event.id)}`,
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${String(event.title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event'}.ics`;
  document.body.appendChild(link); link.click(); link.remove(); const url = link.href; setTimeout(() => URL.revokeObjectURL(url), 1000);
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

// ---------- Saved events (locally stored list shared by every page) ----------
const SAVED_EVENTS_KEY = 'eventhub_saved_events';

const SavedEvents = {
  ids() {
    try {
      const ids = JSON.parse(localStorage.getItem(SAVED_EVENTS_KEY) || '[]');
      return new Set(Array.isArray(ids) ? ids.map(String) : []);
    } catch (err) {
      return new Set();
    }
  },
  has(id) {
    return SavedEvents.ids().has(String(id));
  },
  save(ids) {
    localStorage.setItem(SAVED_EVENTS_KEY, JSON.stringify([...ids]));
  },
  remove(id) {
    const ids = SavedEvents.ids();
    ids.delete(String(id));
    SavedEvents.save(ids);
  },
  // Adds or removes the event and returns true when it is now saved.
  toggle(id) {
    const ids = SavedEvents.ids();
    const key = String(id);
    const saved = !ids.has(key);
    if (saved) ids.add(key); else ids.delete(key);
    SavedEvents.save(ids);
    return saved;
  }
};

// ---------- Shared event rendering ----------
function eventPrice(event) {
  const price = Number(event && event.price);
  return Number.isFinite(price) && price > 0 ? `₹${price}` : 'Free';
}

const BOOKING_STATUS_BADGES = {
  confirmed: 'badge-success',
  pending: 'badge-warning',
  cancelled: 'badge-muted',
  rejected: 'badge-danger'
};

function bookingStatusBadge(status) {
  const label = String(status || '');
  return `<span class="badge ${BOOKING_STATUS_BADGES[label] || 'badge-muted'}">${escapeHtml(label.charAt(0).toUpperCase() + label.slice(1))}</span>`;
}

// The event tile used on the discover, saved-events and similar-events lists.
// removable renders the heart as a "remove from saved list" control instead of a toggle.
function renderEventCard(event, { imageWidth = 500, cardClass = '', removable = false, footnote = null, extraMeta = '' } = {}) {
  const spotsLeft = Number(event.capacity || 0) - Number(event.bookedCount || 0);
  const full = spotsLeft <= 0;
  const saved = removable || SavedEvents.has(event.id);
  const date = new Date(event.date);
  const image = event.imageUrl
    ? `<img src="${optimizedImageUrl(event.imageUrl, imageWidth).replace(/"/g, '&quot;')}" alt="${escapeHtml(event.title)}" loading="lazy" decoding="async" class="thumb-img" />`
    : `<span class="cat-badge">${escapeHtml((event.category || 'E').charAt(0))}</span>`;
  const heart = removable
    ? `<button type="button" class="save-heart saved" data-remove-saved="${escapeHtml(event.id)}" aria-label="Remove ${escapeHtml(event.title)} from saved events"><span class="heart-icon" aria-hidden="true">♥</span></button>`
    : `<button type="button" class="save-heart ${saved ? 'saved' : ''}" data-save-event="${escapeHtml(event.id)}" aria-label="${saved ? 'Remove saved event' : 'Save event'}"><span class="heart-icon" aria-hidden="true">${saved ? '♥' : '♡'}</span></button>`;

  return `<article class="event-card ${cardClass}">
      ${heart}
      <a href="event-details.html?id=${encodeURIComponent(event.id)}" class="event-card-link">
        <div class="thumb">
          ${image}
          <div class="event-date-chip" aria-label="Event date"><strong>${date.toLocaleDateString(undefined, { day: '2-digit' })}</strong><span>${date.toLocaleDateString(undefined, { month: 'short' })}</span></div>
          <span class="badge spots-badge ${full ? 'badge-danger' : 'badge-success'}">${full ? 'Full' : spotsLeft + ' left'}</span>
        </div>
        <div class="body">
          <div class="event-card-topline"><span class="badge badge-primary">${escapeHtml(event.category || 'Event')}</span><span class="event-time">${escapeHtml(event.time || '')}</span></div>
          <h3>${escapeHtml(event.title)}</h3>
          <div class="meta"><span>📅 ${formatDate(event.date)}</span><span>📍 ${escapeHtml(event.location || 'Location TBA')}</span>${extraMeta}</div>
          <div class="premium-meta"><span class="event-price">${escapeHtml(eventPrice(event))}</span><span class="badge badge-muted">${event.bookedCount || 0}/${event.capacity || 0} booked</span></div>
        </div>
        <div class="footer"><span class="event-card-footnote">${escapeHtml(footnote || (full ? 'Join the waitlist from details' : 'Seats available'))}</span><span class="btn btn-sm btn-outline event-card-cta">View details <span aria-hidden="true">→</span></span></div>
      </a>
    </article>`;
}

function renderCardSkeletons(container, count = 6) {
  if (!container) return;
  const skeleton = `<div class="skeleton-card"><div class="skeleton-thumb"></div><div class="skeleton-line short"></div><div class="skeleton-line long"></div><div class="skeleton-line medium"></div></div>`;
  container.innerHTML = skeleton.repeat(count);
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

initThemeSupport();

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
