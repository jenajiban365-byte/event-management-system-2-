const express = require('express');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// @route  POST /api/bookings
router.post('/', protect, async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ message: 'eventId is required.' });

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    if (event.status !== 'published') {
      return res.status(400).json({ message: 'This event is not open for booking.' });
    }
    if (event.bookedCount >= event.capacity) {
      return res.status(400).json({ message: 'This event is fully booked.' });
    }

    const existing = await Booking.findOne({
      event: eventId,
      user: req.user.id,
      status: { $ne: 'cancelled' }
    });
    if (existing) {
      return res.status(409).json({ message: 'You have already booked this event.' });
    }

    const booking = await Booking.create({
      user: req.user.id,
      event: eventId,
      status: 'confirmed'
    });

    event.bookedCount += 1;
    await event.save();

    res.status(201).json({ message: 'Booking confirmed.', booking });
  } catch (err) {
    res.status(500).json({ message: 'Server error creating booking.', error: err.message });
  }
});

// @route  GET /api/bookings/my
router.get('/my', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate('event')
      .sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching bookings.', error: err.message });
  }
});

// @route  PUT /api/bookings/:id/cancel
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You cannot cancel this booking.' });
    }
    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking is already cancelled.' });
    }

    booking.status = 'cancelled';
    await booking.save();

    const event = await Event.findById(booking.event);
    if (event && event.bookedCount > 0) {
      event.bookedCount -= 1;
      await event.save();
    }

    res.json({ message: 'Booking cancelled.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error cancelling booking.', error: err.message });
  }
});

// @route  GET /api/bookings
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('event')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching bookings.', error: err.message });
  }
});

// @route  PUT /api/bookings/:id/status
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['confirmed', 'rejected', 'pending', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${allowed.join(', ')}` });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    const wasCounted = ['confirmed', 'pending'].includes(booking.status);
    const willBeCounted = ['confirmed', 'pending'].includes(status);
    const event = await Event.findById(booking.event);

    if (event && wasCounted && !willBeCounted) {
      event.bookedCount = Math.max(0, event.bookedCount - 1);
      await event.save();
    } else if (event && !wasCounted && willBeCounted) {
      event.bookedCount += 1;
      await event.save();
    }

    booking.status = status;
    await booking.save();

    res.json({ message: 'Booking status updated.', booking });
  } catch (err) {
    res.status(500).json({ message: 'Server error updating booking.', error: err.message });
  }
});

module.exports = router;
