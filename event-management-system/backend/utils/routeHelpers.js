// Shared helpers used by the route modules so the same try/catch, date,
// field-coercion and booking-status logic is not repeated in every handler.

// Booking statuses that occupy a seat on the event.
const COUNTED_BOOKING_STATUSES = ['confirmed', 'pending'];

function isCountedBookingStatus(status) {
  return COUNTED_BOOKING_STATUSES.includes(status);
}

// Today as the YYYY-MM-DD string used by Event.date comparisons.
function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toNumberOrNull(value) {
  return value === '' || value === null || value === undefined ? null : Number(value);
}

// Copies the provided fields from a request body onto a document, converting
// the ones listed in numericFields to numbers (or null when blank).
function applyFields(doc, body, fields, numericFields = []) {
  fields.forEach((field) => {
    if (body[field] === undefined) return;
    doc[field] = numericFields.includes(field) ? toNumberOrNull(body[field]) : body[field];
  });
  return doc;
}

// The user shape returned to (and stored by) the frontend.
function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl || '',
    emailVerified: user.emailVerified !== false,
    authProvider: user.authProvider || 'local'
  };
}

// Wraps an async route handler so unexpected errors become a single,
// consistent 500 response instead of a hand-written catch block per route.
function asyncRoute(handler, failureMessage, { includeError = true, logLabel = '' } = {}) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      if (logLabel) console.error(`${logLabel}:`, err);
      if (res.headersSent) return;
      const payload = { message: failureMessage };
      if (includeError) payload.error = err.message;
      res.status(500).json(payload);
    }
  };
}

module.exports = {
  COUNTED_BOOKING_STATUSES,
  isCountedBookingStatus,
  todayIsoDate,
  toNumberOrNull,
  applyFields,
  publicUser,
  asyncRoute
};
