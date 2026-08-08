const express = require('express');
const Event = require('../models/Event');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// @route  GET /api/admin/dashboard
router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [totalEvents, upcomingEvents, totalUsers, totalBookings, activeBookings, recentBookingsRaw] =
      await Promise.all([
        Event.countDocuments(),
        Event.countDocuments({ date: { $gte: today }, status: 'published' }),
        User.countDocuments({ role: 'user' }),
        Booking.countDocuments(),
        Booking.countDocuments({ status: { $in: ['confirmed', 'pending'] } }),
        Booking.find().populate('user', 'name').populate('event', 'title').sort({ createdAt: -1 }).limit(5)
      ]);

    const recentBookings = recentBookingsRaw.map((b) => ({
      id: b.id,
      status: b.status,
      createdAt: b.createdAt,
      userName: b.user ? b.user.name : 'Unknown',
      eventTitle: b.event ? b.event.title : 'Unknown'
    }));

    res.json({
      totals: { totalEvents, upcomingEvents, totalUsers, totalBookings, activeBookings },
      recentBookings
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching dashboard.', error: err.message });
  }
});

module.exports = router;
