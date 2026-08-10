const { verifyToken } = require('../utils/auth');
const User = require('../models/User');

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
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

// Attaches req.user when a valid token is present, but never rejects the request.
// Used by public endpoints that reveal extra data to staff.
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return next();

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);
    if (user && user.status !== 'blocked') {
      req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    }
  } catch (err) {
    // Ignore invalid tokens — the request continues as anonymous.
  }
  next();
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
}

module.exports = { protect, optionalAuth, adminOnly };
