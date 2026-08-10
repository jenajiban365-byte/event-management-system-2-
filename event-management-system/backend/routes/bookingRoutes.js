const express = require('express');
const crypto = require('crypto');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const Waitlist = require('../models/Waitlist');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendWaitlistPromotedEmail } = require('../utils/email');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { asyncRoute, isCountedBookingStatus, todayIsoDate } = require('../utils/routeHelpers');
const router = express.Router();

function newCheckInCode() {
  return crypto.randomBytes(5).toString('hex').toUpperCase();
}

async function promoteNextWaitlistEntry(eventId) {
  const event = await Event.findById(eventId);
  if (!event || event.bookedCount >= event.capacity) return null;
  const next = await Waitlist.findOne({ event: eventId, status: 'waiting' }).sort({ position: 1, createdAt: 1 });
  if (!next) return null;
  try {
    const booking = await Booking.create({ user: next.user, event: eventId, status: 'confirmed', checkInCode: newCheckInCode() });
    next.status = 'fulfilled';
    await next.save();
    event.bookedCount += 1;
    await event.save();
    await Waitlist.updateMany({ event: eventId, status: 'waiting', position: { $gt: next.position } }, { $inc: { position: -1 } });

    // Notify the promoted user — failure to send shouldn't undo the promotion, just log it
    User.findById(next.user).then((user) => {
      if (user) sendWaitlistPromotedEmail(user.name, user.email, event).catch((err) => console.error('WAITLIST PROMOTION EMAIL ERROR:', err.message));
    }).catch((err) => console.error('WAITLIST PROMOTION EMAIL LOOKUP ERROR:', err.message));

    await Notification.create({ user: next.user, type: 'booking', title: 'Waitlist promoted', message: `A spot opened up for ${event.title}; your registration is confirmed.`, link: '/my-bookings.html' });
    return booking;
  } catch (err) {
    if (err.code !== 11000) console.error('WAITLIST PROMOTION ERROR:', err.message);
    return null;
  }
}

router.post('/', protect, asyncRoute(async (req, res) => {
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ message: 'eventId is required.' });
  const event = await Event.findById(eventId);
  if (!event) return res.status(404).json({ message: 'Event not found.' });
  if (event.status !== 'published') return res.status(400).json({ message: 'This event is not open for booking.' });
  if (event.registrationDeadline && event.registrationDeadline < todayIsoDate()) return res.status(400).json({ message: 'The registration deadline for this event has passed.' });
  const existing = await Booking.findOne({ event: eventId, user: req.user.id, status: { $ne: 'cancelled' } });
  if (existing) return res.status(409).json({ message: 'You have already booked this event.' });
  const claimedEvent = await Event.findOneAndUpdate(
    { _id: eventId, status: 'published', $expr: { $lt: ['$bookedCount', '$capacity'] } },
    { $inc: { bookedCount: 1 } }, { new: true }
  );
  if (!claimedEvent) return res.status(400).json({ message: 'This event is fully booked. Join the waitlist instead.' });
  try {
    const booking = await Booking.create({ user: req.user.id, event: eventId, status: 'confirmed', checkInCode: newCheckInCode() });
    await Notification.create({ user: req.user.id, type: 'booking', title: 'Registration confirmed', message: `Your spot for ${event.title} is confirmed.`, link: '/my-bookings.html' });
    res.status(201).json({ message: 'Booking confirmed.', booking });
  } catch (bookingError) {
    await Event.updateOne({ _id: eventId, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } });
    if (bookingError.code === 11000) return res.status(409).json({ message: 'You have already booked this event.' });
    throw bookingError;
  }
}, 'Server error creating booking.'));

router.get('/my', protect, asyncRoute(async (req, res) => {
  res.json({ bookings: await Booking.find({ user: req.user.id }).populate('event').sort({ createdAt: -1 }) });
}, 'Server error fetching bookings.'));

router.put('/:id/cancel', protect, asyncRoute(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ message: 'You cannot cancel this booking.' });
  if (booking.status === 'cancelled') return res.status(400).json({ message: 'Booking is already cancelled.' });
  const wasCounted = isCountedBookingStatus(booking.status);
  booking.status = 'cancelled';
  await booking.save();
  await Notification.create({ user: booking.user, type: 'booking', title: 'Registration cancelled', message: 'Your event registration has been cancelled.', link: '/my-bookings.html' });
  if (wasCounted) {
    const event = await Event.findById(booking.event);
    if (event) {
      event.bookedCount = Math.max(0, event.bookedCount - 1);
      await event.save();
      await promoteNextWaitlistEntry(event.id);
    }
  }
  res.json({ message: 'Booking cancelled.' });
}, 'Server error cancelling booking.'));

router.get('/', protect, adminOnly, asyncRoute(async (req, res) => {
  res.json({ bookings: await Booking.find().populate('event').populate('user', 'name email').sort({ createdAt: -1 }) });
}, 'Server error fetching bookings.'));

router.put('/:id/status', protect, adminOnly, asyncRoute(async (req, res) => {
  const { status } = req.body;
  const allowed = ['confirmed', 'rejected', 'pending', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ message: `Status must be one of: ${allowed.join(', ')}` });
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  const wasCounted = isCountedBookingStatus(booking.status);
  const willBeCounted = isCountedBookingStatus(status);
  const event = await Event.findById(booking.event);
  if (event && !wasCounted && willBeCounted) {
    if (event.bookedCount >= event.capacity) return res.status(400).json({ message: 'No available seat for this status change.' });
    event.bookedCount += 1;
    await event.save();
  } else if (event && wasCounted && !willBeCounted) {
    event.bookedCount = Math.max(0, event.bookedCount - 1);
    await event.save();
    await promoteNextWaitlistEntry(event.id);
  }
  booking.status = status;
  await booking.save();
  res.json({ message: 'Booking status updated.', booking });
}, 'Server error updating booking.'));

module.exports = router;
