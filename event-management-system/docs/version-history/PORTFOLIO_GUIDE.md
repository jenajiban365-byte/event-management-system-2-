# EventHub: portfolio-ready handoff

## What was improved in this version

This ZIP is based on the uploaded EventHub project and keeps the original Node.js,
Express, MongoDB, and vanilla HTML/CSS/JavaScript architecture.

- **Richer event details:** attendees can share an event with the native device
  share sheet or copy a link, and download a portable `.ics` calendar invite.
- **Safer capacity handling:** booking claims a seat with an atomic MongoDB
  update, preventing simultaneous requests from exceeding capacity.
- **Duplicate booking protection:** active registrations are protected with a
  partial unique index while cancelled bookings can still be rebooked.
- **Installable experience:** added a web app manifest and a small service worker
  for a resilient, app-like shell on mobile.
- **Better product polish:** added event availability progress, persisted event
  filters, live result feedback, toast notifications, responsive action layouts,
  and improved metadata for sharing/search previews.
- **Security baseline:** disabled the Express fingerprint and added lightweight
  security headers for content type, framing, referrers, and browser permissions.

## Resume bullets you can use

Choose the bullets that match what you can explain in an interview:

- Built and deployed a full-stack event booking platform using Node.js, Express,
  MongoDB/Mongoose, and a responsive vanilla JavaScript frontend.
- Implemented JWT authentication, bcrypt password hashing, Google OAuth support,
  role-based admin authorization, and rate limiting for auth endpoints.
- Designed an event discovery experience with keyword/category/date filtering,
  featured events, availability indicators, related-event recommendations, and
  mobile navigation.
- Prevented event overbooking with an atomic capacity claim and protected active
  registrations with a MongoDB partial unique index.
- Added calendar invite generation, native sharing, installable PWA support,
  skeleton loading states, and accessible live result feedback.
- Deployed the application to Render with MongoDB Atlas persistence and documented
  the environment configuration for repeatable setup.

## What to add next for an even stronger portfolio

These are intentionally not claimed as complete in this ZIP:

1. **Automated testing:** Jest/Supertest API tests for auth, booking capacity,
   duplicate bookings, cancellations, and admin authorization; Playwright tests
   for the booking journey.
2. **CI/CD:** GitHub Actions for linting, tests, dependency audit, and a build
   check before merging.
3. **Event operations:** QR-code tickets with a staff check-in screen and
   attendance analytics.
4. **Payments:** Stripe Checkout for paid events, webhook-driven booking
   confirmation, and receipt emails.
5. **Observability:** structured request logs, a health/readiness endpoint, and
   error tracking with sensitive fields redacted.
6. **Production hardening:** move tokens from localStorage to secure,
   httpOnly cookies, add CSRF protection, and rotate the seeded admin password
   immediately after deployment.

## How to use the ZIP

1. Extract it and open the `event-management-system` folder in GitHub Desktop.
2. Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI` and
   `JWT_SECRET`.
3. Run `npm install` inside `backend`, then `npm start`.
4. Push the changes to your GitHub repository. Render can continue using
   `backend` as the root directory, `npm install` as the build command, and
   `npm start` as the start command.

Do not commit `backend/.env`; it is intentionally excluded from this package.