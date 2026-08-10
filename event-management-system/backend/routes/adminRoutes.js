const express = require('express');
const Event = require('../models/Event');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Club = require('../models/Club');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { sendError } = require('../utils/errors');
const router = express.Router();

router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const start = new Date(); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - 13);
    const [totalEvents, upcomingEvents, totalUsers, totalBookings, activeBookings, totalClubs, pendingClubs, pendingEvents, recentBookingsRaw, trendRaw] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ date: { $gte: today }, status: 'published' }),
      User.countDocuments({ role: { $in: ['user', 'organizer'] } }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: { $in: ['confirmed', 'pending'] } }),
      Club.countDocuments({ status: 'approved' }),
      Club.countDocuments({ status: 'pending' }),
      Event.countDocuments({ status: 'pending_approval' }),
      Booking.find().populate('user', 'name').populate('event', 'title').sort({ createdAt: -1 }).limit(5),
      Booking.aggregate([
        { $match: { createdAt: { $gte: start } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
    ]);
    const trendMap = new Map(trendRaw.map((item) => [item._id, item.count]));
    const bookingTrend = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(start); d.setUTCDate(start.getUTCDate() + i);
      const date = d.toISOString().slice(0, 10);
      bookingTrend.push({ date, count: trendMap.get(date) || 0 });
    }
    const recentBookings = recentBookingsRaw.map((b) => ({ id: b.id, status: b.status, createdAt: b.createdAt, userName: b.user ? b.user.name : 'Unknown', eventTitle: b.event ? b.event.title : 'Unknown' }));
    res.json({ totals: { totalEvents, upcomingEvents, totalUsers, totalBookings, activeBookings, totalClubs, pendingClubs, pendingEvents }, recentBookings, bookingTrend });
  } catch (err) { sendError(res, 'GET /api/admin/dashboard', err, 'Server error fetching dashboard.'); }
});
router.get('/pending-events', protect, adminOnly, async (req, res) => {
  try { const events = await Event.find({ status: 'pending_approval' }).populate('club', 'name').populate('organizer', 'name email').sort({ createdAt: -1 }); res.json({ events }); }
  catch (err) { sendError(res, 'GET /api/admin/pending-events', err, 'Server error fetching pending events.'); }
});

router.get('/clubs', protect, adminOnly, async (req, res) => {
  try { const clubs = await Club.find().populate('createdBy', 'name email').populate('organizerIds', 'name email').sort({ createdAt: -1 }); res.json({ clubs }); }
  catch (err) { sendError(res, 'GET /api/admin/clubs', err, 'Server error fetching clubs.'); }
});

module.exports = router;
