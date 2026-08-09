const express = require('express');
const Event = require('../models/Event');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const start = new Date(); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - 13);
    const [totalEvents, upcomingEvents, totalUsers, totalBookings, activeBookings, recentBookingsRaw, trendRaw] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ date: { $gte: today }, status: 'published' }),
      User.countDocuments({ role: 'user' }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: { $in: ['confirmed', 'pending'] } }),
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
    res.json({ totals: { totalEvents, upcomingEvents, totalUsers, totalBookings, activeBookings }, recentBookings, bookingTrend });
  } catch (err) { res.status(500).json({ message: 'Server error fetching dashboard.', error: err.message }); }
});
module.exports = router;
