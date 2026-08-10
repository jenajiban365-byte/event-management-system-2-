const rateLimit = require('express-rate-limit');

function createLimiter(max, message, windowMinutes = 15) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message }
  });
}

// Applies to login/register/google-login: max 10 attempts per 15 minutes per IP.
// Protects against brute-force password guessing and signup spam/bot abuse.
const authLimiter = createLimiter(10, 'Too many attempts from this device. Please try again in a few minutes.');

// Applies to the public contact form: max 5 submissions per 15 minutes per IP.
// Tighter than authLimiter since this is unauthenticated and sends real email traffic.
const contactLimiter = createLimiter(5, 'Too many messages sent. Please try again in a few minutes.');

module.exports = { createLimiter, authLimiter, contactLimiter };
