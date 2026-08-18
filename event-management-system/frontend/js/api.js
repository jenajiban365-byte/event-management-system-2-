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
  setUser(user) {
    localStorage.setItem('ems_user', JSON.stringify(user || {}));
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
  },
  isOrganizer() {
    const user = Session.getUser();
    return !!user && (user.role === 'organizer' || user.role === 'admin');
  }
};

function getStoredTheme() {
  // EventHub uses a single bright campus theme. Keep this helper for
  // backwards compatibility with existing pages, but never expose dark mode.
  return 'light';
}

function getSystemColorMode() {
  return 'light';
}

function applyEventHubTheme(mode = 'light') {
  const body = document.body;
  if (!body) return;
  localStorage.setItem('eventhub_theme', 'light');
  body.setAttribute('data-theme', 'light');
  body.classList.add('eventhub-light');
  body.classList.remove('eventhub-dark');
  [document.getElementById('themeSelect'), document.getElementById('mobileThemeSelect')].forEach((control) => {
    if (control) control.value = 'light';
  });
}

function initThemeSupport() {
  applyEventHubTheme('light');
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
  getUnreadNotificationCount: () => apiRequest('/notifications/unread-count'),
  markAllNotificationsRead: () => apiRequest('/notifications/read-all', { method: 'PUT' }),
  // The clubs endpoint is public, but include the token when a student is signed in so the backend can return isFollowing correctly after refresh.
  getClubs: (query = '') => apiRequest(`/clubs${query}`),
  toggleClubFollow: (id) => apiRequest(`/clubs/${id}/follow`, { method: 'POST' }),
  getClub: (idOrSlug) => apiRequest(`/clubs/${encodeURIComponent(idOrSlug)}`, { auth: !!Session.getToken() }),
  getClubOpportunities: () => apiRequest('/clubs/opportunities', { auth: false }),
  getFollowedClubAnnouncements: () => apiRequest('/clubs/announcements'),
  requestNewClub: (payload) => apiRequest('/clubs/request-new', { method: 'POST', body: payload }),
  applyToOpportunity: (id, payload) => apiRequest(`/clubs/opportunities/${id}/apply`, { method: 'POST', body: payload }),
  getClubHeadDashboard: () => apiRequest('/club-head/my-club'),
  updateClubHeadClub: (payload) => apiRequest('/club-head/my-club', { method: 'PUT', body: payload }),
  getClubHeadOpportunities: () => apiRequest('/club-head/opportunities'),
  createClubHeadOpportunity: (payload) => apiRequest('/club-head/opportunities', { method: 'POST', body: payload }),
  updateClubHeadOpportunity: (id,payload) => apiRequest(`/club-head/opportunities/${id}`, { method: 'PUT', body: payload }),
  deleteClubHeadOpportunity: (id) => apiRequest(`/club-head/opportunities/${id}`, { method: 'DELETE' }),
  getClubHeadApplications: (query='') => apiRequest(`/club-head/applications${query}`),
  updateClubHeadApplication: (id,status) => apiRequest(`/club-head/applications/${id}/status`, { method: 'PUT', body: { status } }),
  getClubHeadAnnouncements: () => apiRequest('/club-head/announcements'),
  createClubHeadAnnouncement: (payload) => apiRequest('/club-head/announcements', { method: 'POST', body: payload }),
  deleteClubHeadAnnouncement: (id) => apiRequest(`/club-head/announcements/${id}`, { method: 'DELETE' }),
  getClubHeadEvents: () => apiRequest('/club-head/events'),
  createClubHeadEvent: (payload) => apiRequest('/club-head/events', { method: 'POST', body: payload }),
  updateClubHeadEvent: (id,payload) => apiRequest(`/club-head/events/${id}`, { method: 'PUT', body: payload }),
  deleteClubHeadEvent: (id) => apiRequest(`/club-head/events/${id}`, { method: 'DELETE' }),
  getClubHeadMembers: () => apiRequest('/club-head/members'),
  getGroups: () => apiRequest('/groups'),
  getGroup: (id) => apiRequest(`/groups/${encodeURIComponent(id)}`),
  joinGroup: (id) => apiRequest(`/groups/${encodeURIComponent(id)}/join`, { method: 'POST' }),
  leaveGroup: (id) => apiRequest(`/groups/${encodeURIComponent(id)}/leave`, { method: 'POST' }),
  messageGroupMember: (groupId, memberId, message) => apiRequest(`/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}/message`, { method: 'POST', body: { message } }),
  getConversations: () => apiRequest('/messages/conversations'),
  startConversation: (userId, groupId = '') => apiRequest('/messages/start', { method: 'POST', body: { userId, groupId } }),
  getConversation: (id) => apiRequest(`/messages/conversations/${encodeURIComponent(id)}`),
  sendMessage: (id, text, extra = {}) => apiRequest(`/messages/conversations/${encodeURIComponent(id)}/messages`, { method: 'POST', body: { text, ...extra } }),
  uploadChatAttachment: async (conversationId, file) => {
    const headers = {
      'Content-Type': file?.type || 'application/octet-stream',
      'X-EventHub-File-Name': encodeURIComponent(file?.name || 'attachment'),
      'X-EventHub-Conversation-Id': String(conversationId || '')
    };
    if (Session.getToken()) headers.Authorization = `Bearer ${Session.getToken()}`;
    const res = await fetch('/api/media/chat-attachment', { method: 'POST', headers, body: file });
    let data = null; try { data = await res.json(); } catch (_) {}
    if (!res.ok) { const err = new Error(data?.message || `Upload failed with status ${res.status}`); err.status = res.status; throw err; }
    return data;
  },
  uploadRegistrationAttachment: async (eventId, file) => {
    const headers = {
      'Content-Type': file?.type || 'application/octet-stream',
      'X-EventHub-File-Name': encodeURIComponent(file?.name || 'registration-file'),
      'X-EventHub-Event-Id': String(eventId || '')
    };
    if (Session.getToken()) headers.Authorization = `Bearer ${Session.getToken()}`;
    const res = await fetch('/api/media/registration-attachment', { method: 'POST', headers, body: file });
    let data = null; try { data = await res.json(); } catch (_) {}
    if (!res.ok) { const err = new Error(data?.message || `Upload failed with status ${res.status}`); err.status = res.status; throw err; }
    return data;
  },
  syncMessages: (id, after) => apiRequest(`/messages/conversations/${encodeURIComponent(id)}/messages${after ? `?after=${encodeURIComponent(after)}` : ''}`),
  editMessage: (messageId, text) => apiRequest(`/messages/messages/${encodeURIComponent(messageId)}`, { method: 'PUT', body: { text } }),
  deleteMessage: (messageId) => apiRequest(`/messages/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' }),
  reactToMessage: (messageId, emoji) => apiRequest(`/messages/messages/${encodeURIComponent(messageId)}/reactions`, { method: 'POST', body: { emoji } }),
  getChatDirectory: (q = '') => apiRequest(`/messages/directory${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  bulkUpdateOrganizerRegistrations: (ids, status) => apiRequest('/organizer/registrations/bulk-status', { method: 'PUT', body: { ids, status } }),
  markConversationRead: (id) => apiRequest(`/messages/conversations/${encodeURIComponent(id)}/read`, { method: 'PUT' }),
  setTyping: (id, typing = true) => apiRequest(`/messages/conversations/${encodeURIComponent(id)}/typing`, { method: 'POST', body: { typing } }),
  muteConversation: (id, mute = true) => apiRequest(`/messages/conversations/${encodeURIComponent(id)}/mute`, { method: 'POST', body: { mute } }),
  shareEventToChat: (conversationId, eventId) => apiRequest(`/messages/conversations/${encodeURIComponent(conversationId)}/share-event`, { method: 'POST', body: { eventId } }),
  pingPresence: () => apiRequest('/messages/presence', { method: 'POST', body: {} }),
  getUnreadChatCount: () => apiRequest('/messages/unread-count'),
  getRegistrationForm: (eventId) => apiRequest(`/registration-forms/${encodeURIComponent(eventId)}`),
  saveRegistrationForm: (eventId, payload) => apiRequest(`/registration-forms/${encodeURIComponent(eventId)}`, { method: 'PUT', body: payload }),
  getPublicRegistrationForm: (eventId) => apiRequest(`/registration-forms/public/${encodeURIComponent(eventId)}`),
  getEventBuddies: (eventId) => apiRequest(`/social/events/${encodeURIComponent(eventId)}/buddies`),
  getCampusPulse: () => apiRequest('/social/campus-pulse'),
  getEventStories: (eventId) => apiRequest(`/social/events/${encodeURIComponent(eventId)}/stories`),
  createEventStory: (eventId, payload) => apiRequest(`/social/events/${encodeURIComponent(eventId)}/stories`, { method:'POST', body:payload }),
  uploadEventStoryImage: async (eventId, file) => { const token=Session.getToken(); const res=await fetch(`/api/media/event-story`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':file.type||'application/octet-stream','X-EventHub-Event-Id':eventId,'X-EventHub-File-Name':encodeURIComponent(file.name||'moment')},body:file}); const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data.message||'Could not upload event photo.'); return data; },
  getPublicProfile: (userId) => apiRequest(`/social/users/${encodeURIComponent(userId)}`),
  getSharedGroups: (userId) => apiRequest(`/social/users/${encodeURIComponent(userId)}/shared-groups`),
  connectToEventBuddy: (userId, eventId) => apiRequest('/messages/start', { method: 'POST', body: { userId, eventId } }),
  createGroupPost: (id, payload) => apiRequest(`/groups/${encodeURIComponent(id)}/posts`, { method: 'POST', body: payload }),
  toggleGroupPostPin: (id, postId) => apiRequest(`/groups/${encodeURIComponent(id)}/posts/${encodeURIComponent(postId)}/pin`, { method: 'PUT' }),
  deleteGroupPost: (id, postId) => apiRequest(`/groups/${encodeURIComponent(id)}/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' }),
  getClubHeadRegistrations: (eventId) => apiRequest(`/club-head/events/${encodeURIComponent(eventId)}/registrations`),
  getClubHeadRegistrationsCsvUrl: (eventId) => `/api/club-head/events/${encodeURIComponent(eventId)}/registrations.csv`,
  getAdminClubs: () => apiRequest('/admin/clubs'),
  createAdminClub: (payload) => apiRequest('/admin/clubs', { method: 'POST', body: payload }),
  updateAdminClub: (id,payload) => apiRequest(`/admin/clubs/${id}`, { method: 'PUT', body: payload }),
  assignClubHead: (id,payload) => apiRequest(`/admin/clubs/${id}/assign-head`, { method: 'POST', body: payload }),
  removeClubHead: (id,payload) => apiRequest(`/admin/clubs/${id}/remove-head`, { method: 'POST', body: payload }),
  getClubRequests: () => apiRequest('/admin/club-requests'),
  approveClubRequest: (id) => apiRequest(`/admin/club-requests/${id}/approve`, { method: 'PUT' }),
  rejectClubRequest: (id,adminNote='') => apiRequest(`/admin/club-requests/${id}/reject`, { method: 'PUT', body: { adminNote } }),
  googleLogin: (credential, requestedRole) => apiRequest('/auth/google', { method: 'POST', body: { credential, requestedRole }, auth: false }),
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
  getMyClubs: () => apiRequest('/organizer/clubs'),
  getOrganizerEvents: () => apiRequest('/organizer/events'),
  createOrganizerEvent: (payload) => apiRequest('/organizer/events', { method: 'POST', body: payload }),
  updateOrganizerEvent: (id, payload) => apiRequest(`/organizer/events/${id}`, { method: 'PUT', body: payload }),
  getOrganizerRegistrations: (id) => apiRequest(`/organizer/events/${id}/registrations`),
  getOrganizerRegistrationsCsvUrl: (id) => `/api/organizer/events/${encodeURIComponent(id)}/registrations.csv`,
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
  createBooking: (eventId, registrationAnswers = []) => apiRequest('/bookings', { method: 'POST', body: { eventId, registrationAnswers } }),
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
  uploadProfilePhoto: async (file) => {
    const headers = {
      'Content-Type': file?.type || 'application/octet-stream',
      'X-EventHub-File-Name': encodeURIComponent(file?.name || 'profile-photo')
    };
    if (Session.getToken()) headers.Authorization = `Bearer ${Session.getToken()}`;
    const res = await fetch('/api/media/avatar', { method: 'POST', headers, body: file });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error(data?.message || `Upload failed with status ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  },
  getAllUsers: () => apiRequest('/users'),
  updateUser: (id, payload) => apiRequest(`/users/${id}`, { method: 'PUT', body: payload }),
  deleteUser: (id) => apiRequest(`/users/${id}`, { method: 'DELETE' }),

  // Admin dashboard
  getDashboard: () => apiRequest('/admin/dashboard'),
  getAdminUsers: (query='') => apiRequest(`/admin/users${query}`),
  updateAdminUserRole: (id,payload) => apiRequest(`/admin/users/${id}/role`, { method: 'PUT', body: payload }),
  geocodeAddress: (address) => apiRequest(`/geocode?address=${encodeURIComponent(address)}`)
};

// Make the shared session/API objects available to page-level modules.
// Campus Chat avatar studio runs in its own IIFE and accesses these through
// window, while the rest of api.js intentionally uses the lexical bindings.
window.Session = Session;
window.Api = Api;


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

function eventRegistrationUrl(event) {
  return new URL(event?.registrationForm?.enabled ? `smart-form.html?event=${encodeURIComponent(event.id)}` : `event-form.html?id=${encodeURIComponent(event.id)}`, window.location.href).href;
}

async function shareRegistrationLink(event) {
  const url = eventRegistrationUrl(event);
  const shareData = {
    title: `Register: ${event.title}`,
    text: `Register for ${event.title} on EventHub — ${formatDate(event.date)} at ${event.time || ''}.`,
    url
  };
  if (navigator.share) {
    await navigator.share(shareData);
    return 'shared';
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
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

// Organizer pages live in /organizer/, so redirects need to climb one level.
function requireOrganizer() {
  if (!Session.isLoggedIn() || !Session.isOrganizer()) {
    window.location.href = '../login.html';
  }
}

function getRoleHome(role = Session.getUser()?.role) {
  if (role === 'admin') return 'admin/dashboard.html';
  if (role === 'organizer') return 'organizer/dashboard.html';
  if (role === 'club_head') return 'organizer/club-dashboard.html';
  return 'events.html';
}

function redirectIfLoggedIn() {
  if (Session.isLoggedIn()) {
    window.location.href = getRoleHome();
  }
}

initThemeSupport();

// ---------- Google Sign-In ----------
// Google Identity Services must be initialized exactly once per page. Button
// rendering may happen more than once (for example when the login card changes
// width or the user changes role), but initialize() must never be called again.
const googleAuthState = window.__eventHubGoogleAuthState || {
  initialized: false,
  initializing: null,
  clientId: null,
  callback: null,
  containers: new Map(),
  observers: new Map()
};
window.__eventHubGoogleAuthState = googleAuthState;

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleAuthState.loading) return googleAuthState.loading;

  googleAuthState.loading = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Sign-In could not be loaded.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Google Sign-In could not be loaded.'));
    document.head.appendChild(script);
  });
  return googleAuthState.loading;
}

async function initGoogleSignIn(containerId, onSuccess, onError, getRequestedRole) {
  try {
    const { googleClientId } = await Api.getPublicConfig();
    if (!googleClientId) return; // Google Sign-In is optional when not configured.

    const container = document.getElementById(containerId);
    if (!container) return;

    googleAuthState.clientId = googleAuthState.clientId || googleClientId;
    if (googleAuthState.clientId !== googleClientId) {
      console.error('[Google Auth] Client ID changed during this page lifetime; reload required.');
      return;
    }

    googleAuthState.callback = async (response) => {
      try {
        const data = await Api.googleLogin(
          response.credential,
          typeof getRequestedRole === 'function' ? getRequestedRole() : undefined
        );
        onSuccess(data);
      } catch (err) {
        onError && onError(err);
      }
    };

    await loadGoogleIdentityServices();

    if (!googleAuthState.initialized) {
      if (!window.google?.accounts?.id) throw new Error('Google Sign-In is unavailable.');
      window.google.accounts.id.initialize({
        client_id: googleAuthState.clientId,
        callback: (response) => googleAuthState.callback?.(response),
        auto_select: false,
        cancel_on_tap_outside: true
      });
      googleAuthState.initialized = true;
      console.info('[Google Auth] Identity Services initialized once.');
    }

    const renderButton = () => {
      if (!googleAuthState.initialized || !window.google?.accounts?.id || !container.isConnected) return;
      const width = Math.max(220, Math.min(Math.floor(container.getBoundingClientRect().width || 400), 400));
      container.innerHTML = '';
      window.google.accounts.id.renderButton(container, {
        theme: 'outline', size: 'large', width, shape: 'rectangular', text: 'signin_with'
      });
    };

    // Expose ONLY button rendering for role-picker/resize updates. It does not
    // initialize GIS again.
    window.__eventHubGoogleRenderers = window.__eventHubGoogleRenderers || {};
    window.__eventHubGoogleRenderers[containerId] = renderButton;
    googleAuthState.containers.set(containerId, renderButton);

    if (!googleAuthState.observers.has(containerId) && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        if (container.offsetWidth > 0) {
          clearTimeout(container.__googleResizeTimer);
          container.__googleResizeTimer = setTimeout(renderButton, 80);
        }
      });
      observer.observe(container);
      googleAuthState.observers.set(containerId, observer);
    }

    renderButton();
  } catch (err) {
    console.warn('[Google Auth] Sign-In unavailable:', err.message || err);
  }
}

function requireClubHead(){ const u=Session.getUser(); if(!Session.isLoggedIn() || !u || u.role!=='club_head'){ window.location.href='../login.html'; return false;} return true; }
