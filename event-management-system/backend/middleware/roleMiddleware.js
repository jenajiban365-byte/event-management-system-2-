// Builds a middleware that only lets the listed roles through.
function requireRoles(roles, message) {
  return function roleGuard(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message });
    }
    next();
  };
}

const adminOnly = requireRoles(['admin'], 'Admin access required.');
const organizerOnly = requireRoles(['organizer', 'admin'], 'Organizer access required.');
const staffOnly = requireRoles(['admin', 'organizer'], 'Staff access required.');

module.exports = { requireRoles, adminOnly, organizerOnly, staffOnly };
