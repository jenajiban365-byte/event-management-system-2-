const express = require('express');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const Waitlist = require('../models/Waitlist');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/status/:eventId', protect, async (req, res) => {
  try {
    const entry = await Waitlist.findOne({ event: req.params.eventId, user: req.user.id, status: 'waiting' });
    const count = await Waitlist.countDocuments({ event: req.params.eventId, status: 'waiting' });
    res.json({ joined: !!entry, position: entry ? entry.position : null, count });
  } catch (err) { console.error(req.method, req.originalUrl, err); res.status(500).json({ message: 'Server error checking waitlist.' }); }
});

router.post('/', protect, async (req, res) => {
  try {
    const event = await Event.findById(typeof req.body.eventId === 'string' ? req.body.eventId : '');
    if (!event || event.status !== 'published') return res.status(404).json({ message: 'Event not found.' });
    if (event.bookedCount < event.capacity) return res.status(400).json({ message: 'This event still has available seats.' });
    const existingBooking = await Booking.findOne({ event: event.id, user: req.user.id, status: { $ne: 'cancelled' } });
    if (existingBooking) return res.status(409).json({ message: 'You already have a booking for this event.' });
    const existing = await Waitlist.findOne({ event: event.id, user: req.user.id, status: 'waiting' });
    if (existing) return res.status(409).json({ message: `You are already on the waitlist at position ${existing.position}.` });
    const count = await Waitlist.countDocuments({ event: event.id, status: 'waiting' });
    const entry = await Waitlist.create({ event: event.id, user: req.user.id, position: count + 1 });
    res.status(201).json({ message: 'You joined the waitlist.', entry, count: count + 1 });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'You are already on the waitlist.' });
    res.status(500).json({ message: 'Server error joining waitlist.' });
  }
});

router.delete('/:eventId', protect, async (req, res) => {
  try {
    const entry = await Waitlist.findOneAndUpdate({ event: req.params.eventId, user: req.user.id, status: 'waiting' }, { status: 'cancelled' }, { new: true });
    if (!entry) return res.status(404).json({ message: 'Waitlist entry not found.' });
    await Waitlist.updateMany({ event: req.params.eventId, status: 'waiting', position: { $gt: entry.position } }, { $inc: { position: -1 } });
    res.json({ message: 'Removed from waitlist.' });
  } catch (err) { console.error(req.method, req.originalUrl, err); res.status(500).json({ message: 'Server error leaving waitlist.' }); }
});
module.exports = router;
