const { verifyToken } = require('../utils/auth');
const User = require('../models/User');
const { sendError } = require('../utils/errors');

const TOKEN_ERROR_NAMES = ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'];

async function protect(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized. No token provided.' });
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }
    if (user.status === 'blocked') {
      return res.status(403).json({ message: 'Your account has been blocked. Contact admin.' });
    }
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl || '', emailVerified: user.emailVerified !== false };
    next();
  } catch (err) {
    // Only reject as unauthorized when the token itself is the problem; a failed
    // user lookup is a server fault and must not masquerade as a bad token.
    if (TOKEN_ERROR_NAMES.includes(err.name)) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
    return sendError(res, 'auth middleware', err, 'Could not verify your session right now.');
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
}

module.exports = { protect, adminOnly };
