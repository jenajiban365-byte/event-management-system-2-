const rateLimit = require('express-rate-limit');

// Applies to login/register/google-login: max 10 attempts per 15 minutes per IP.
// Protects against brute-force password guessing and signup spam/bot abuse.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts from this device. Please try again in a few minutes.' }
});

module.exports = { authLimiter };
