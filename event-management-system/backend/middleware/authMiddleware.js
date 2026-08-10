const { verifyToken } = require('../utils/auth');
const User = require('../models/User');
const { publicUser } = require('../utils/routeHelpers');
const { adminOnly } = require('./roleMiddleware');

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
    req.user = publicUser(user);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = { protect, adminOnly };
