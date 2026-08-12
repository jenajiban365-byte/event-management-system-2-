function organizerOnly(req, res, next) {
  if (!req.user || !['organizer', 'admin'].includes(req.user.role)) return res.status(403).json({ message: 'Organizer access required.' });
  next();
}

function clubHeadOnly(req, res, next) {
  if (!req.user || !['club_head', 'admin'].includes(req.user.role)) return res.status(403).json({ message: 'Club Head access required.' });
  next();
}

function studentOnly(req, res, next) {
  if (!req.user || req.user.role !== 'user') return res.status(403).json({ message: 'Student access required.' });
  next();
}

module.exports = { organizerOnly, clubHeadOnly, studentOnly };