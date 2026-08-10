function organizerOnly(req, res, next) {
  if (!req.user || !['organizer', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Organizer access required.' });
  }
  next();
}

module.exports = { organizerOnly };
