const express = require('express');
const crypto = require('crypto');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const Waitlist = require('../models/Waitlist');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendWaitlistPromotedEmail, sendBookingConfirmationEmail } = require('../utils/email');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const router = express.Router();

async function promoteNextWaitlistEntry(eventId) {
  const event = await Event.findById(eventId);
  if (!event || event.bookedCount >= event.capacity) return null;
  const next = await Waitlist.findOne({ event: eventId, status: 'waiting' }).sort({ position: 1, createdAt: 1 });
  if (!next) return null;
  try {
    const promotedUser = await User.findById(next.user).select('name email studentId department year phone').lean();
    const booking = await Booking.create({ user: next.user, event: eventId, status: 'confirmed', checkInCode: crypto.randomBytes(5).toString('hex').toUpperCase(), registrationProfile: { name: promotedUser?.name || '', email: promotedUser?.email || '', studentId: promotedUser?.studentId || '', department: promotedUser?.department || '', year: promotedUser?.year || '', phone: promotedUser?.phone || '' } });
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

router.post('/', protect, async (req, res) => {
  try {
    const { eventId } = req.body;
    const submittedAnswers = Array.isArray(req.body.registrationAnswers) ? req.body.registrationAnswers : [];
    if (!eventId) return res.status(400).json({ message: 'eventId is required.' });
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    if (event.status !== 'published') return res.status(400).json({ message: 'This event is not open for booking.' });
    if (event.registrationDeadline && event.registrationDeadline < new Date().toISOString().slice(0, 10)) return res.status(400).json({ message: 'The registration deadline for this event has passed.' });
    const existing = await Booking.findOne({ event: eventId, user: req.user.id, status: { $ne: 'cancelled' } });
    const questions = Array.isArray(event.customRegistrationQuestions) ? event.customRegistrationQuestions : [];
    const answerMap = new Map(submittedAnswers.map(a => [String(a.question || '').trim(), String(a.answer || '').trim()]));
    const visible = q => {
      const dep = q.showWhen?.questionIndex;
      if (dep === null || dep === undefined || dep === '' || Number(dep) < 0) return true;
      const parent = questions[Number(dep)];
      return !!parent && answerMap.get(String(parent.question || '').trim()) === String(q.showWhen?.equals || '');
    };
    const answerableQuestions = questions.filter(q => q.type !== 'section');
    const visibleQuestions = answerableQuestions.filter(visible);
    const invalidChoice = visibleQuestions.find(q => ['select','dropdown','multiple_choice'].includes(q.type) && answerMap.get(String(q.question || '').trim()) && Array.isArray(q.options) && !q.options.includes(answerMap.get(String(q.question || '').trim())));
    if (invalidChoice) return res.status(400).json({ message: `Please choose a valid option for: ${invalidChoice.question}` });
    const invalidCheckboxes = visibleQuestions.find(q => q.type === 'checkbox_group' && answerMap.get(String(q.question || '').trim()) && Array.isArray(q.options) && String(answerMap.get(String(q.question || '').trim())).split(',').map(v => v.trim()).filter(Boolean).some(v => !q.options.includes(v)));
    if (invalidCheckboxes) return res.status(400).json({ message: `Please choose valid options for: ${invalidCheckboxes.question}` });
    const missing = visibleQuestions.filter(q => q.required !== false && !answerMap.get(String(q.question || '').trim()));
    if (missing.length) return res.status(400).json({ message: 'Please answer all required registration questions.' });
    const registrationAnswers = answerableQuestions.map(q => ({ question: String(q.question || '').trim(), answer: visible(q) ? (answerMap.get(String(q.question || '').trim()) || '') : '' }));
    if (existing) return res.status(409).json({ message: 'You have already booked this event.' });
    const profile = await User.findById(req.user.id).select('name email studentId department year phone').lean();
    const claimedEvent = await Event.findOneAndUpdate(
      { _id: eventId, status: 'published', $expr: { $lt: ['$bookedCount', '$capacity'] } },
      { $inc: { bookedCount: 1 } }, { new: true }
    );
    if (!claimedEvent) return res.status(400).json({ message: 'This event is fully booked. Join the waitlist instead.' });
    try {
      const booking = await Booking.create({ user: req.user.id, event: eventId, status: 'confirmed', checkInCode: crypto.randomBytes(5).toString('hex').toUpperCase(), registrationAnswers, registrationProfile: { name: profile?.name || '', email: profile?.email || '', studentId: profile?.studentId || '', department: profile?.department || '', year: profile?.year || '', phone: profile?.phone || '' } });
      await Notification.create({ user: req.user.id, type: 'booking', title: 'Registration confirmed', message: `Your spot for ${event.title} is confirmed.`, link: '/my-bookings.html' });
      User.findById(req.user.id).then((user) => {
        if (user) sendBookingConfirmationEmail(user.name, user.email, event, booking).catch((emailErr) => console.error('BOOKING CONFIRMATION EMAIL ERROR:', emailErr.message));
      }).catch((lookupErr) => console.error('BOOKING CONFIRMATION EMAIL LOOKUP ERROR:', lookupErr.message));
      res.status(201).json({ message: 'Booking confirmed.', booking });
    } catch (bookingError) {
      await Event.updateOne({ _id: eventId, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } });
      if (bookingError.code === 11000) return res.status(409).json({ message: 'You have already booked this event.' });
      throw bookingError;
    }
  } catch (err) { res.status(500).json({ message: 'Server error creating booking.', error: err.message }); }
});

router.get('/my', protect, async (req, res) => {
  try { res.json({ bookings: await Booking.find({ user: req.user.id }).populate('event').sort({ createdAt: -1 }) }); }
  catch (err) { res.status(500).json({ message: 'Server error fetching bookings.', error: err.message }); }
});

router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ message: 'You cannot cancel this booking.' });
    if (booking.status === 'cancelled') return res.status(400).json({ message: 'Booking is already cancelled.' });
    const wasCounted = ['confirmed', 'pending'].includes(booking.status);
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
  } catch (err) { res.status(500).json({ message: 'Server error cancelling booking.', error: err.message }); }
});

router.get('/', protect, adminOnly, async (req, res) => {
  try { res.json({ bookings: await Booking.find().populate('event').populate('user', 'name email').sort({ createdAt: -1 }) }); }
  catch (err) { res.status(500).json({ message: 'Server error fetching bookings.', error: err.message }); }
});

router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['confirmed', 'rejected', 'pending', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ message: `Status must be one of: ${allowed.join(', ')}` });
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    const wasCounted = ['confirmed', 'pending'].includes(booking.status);
    const willBeCounted = ['confirmed', 'pending'].includes(status);
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
  } catch (err) { res.status(500).json({ message: 'Server error updating booking.', error: err.message }); }
});

module.exports = router;
