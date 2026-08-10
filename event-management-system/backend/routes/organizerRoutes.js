const express = require('express');
const Event = require('../models/Event');
const Club = require('../models/Club');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');
const { organizerOnly } = require('../middleware/roleMiddleware');
const { asyncRoute, applyFields, isCountedBookingStatus, todayIsoDate, COUNTED_BOOKING_STATUSES } = require('../utils/routeHelpers');
const router = express.Router();

const ORGANIZER_EVENT_FIELDS = ['title', 'description', 'category', 'date', 'time', 'location', 'capacity', 'imageUrl', 'latitude', 'longitude', 'registrationDeadline', 'eligibility', 'eventType', 'price', 'approvalRequired'];
const ORGANIZER_EVENT_NUMERIC_FIELDS = ['capacity', 'latitude', 'longitude', 'price'];

async function ensureClubAccess(userId, clubId) {
  return Club.findOne({ _id: clubId, status: 'approved', organizerIds: userId });
}

// Ids of the clubs this organizer manages — every organizer query is scoped by them.
async function organizerClubIds(userId) {
  const clubs = await Club.find({ organizerIds: userId }).select('_id');
  return clubs.map((club) => club._id);
}

async function findOrganizerEvent(userId, eventId) {
  return Event.findOne({ _id: eventId, organizer: userId, club: { $in: await organizerClubIds(userId) } });
}

router.get('/dashboard', protect, organizerOnly, asyncRoute(async (req, res) => {
  const clubs = await Club.find({ organizerIds: req.user.id });
  const clubIds = clubs.map((c) => c._id);
  const [events, upcoming, registrations] = await Promise.all([
    Event.countDocuments({ club: { $in: clubIds }, organizer: req.user.id }),
    Event.countDocuments({ club: { $in: clubIds }, organizer: req.user.id, status: 'published', date: { $gte: todayIsoDate() } }),
    Booking.countDocuments({ event: { $in: await Event.find({ club: { $in: clubIds } }).distinct('_id') }, status: { $in: COUNTED_BOOKING_STATUSES } })
  ]);
  res.json({ totals: { clubs: clubs.length, events, upcomingEvents: upcoming, registrations }, clubs });
}, 'Server error fetching organizer dashboard.'));

router.get('/events', protect, organizerOnly, asyncRoute(async (req, res) => {
  const events = await Event.find({ club: { $in: await organizerClubIds(req.user.id) }, organizer: req.user.id }).populate('club', 'name').sort({ date: 1, time: 1 });
  res.json({ events });
}, 'Server error fetching organizer events.'));

router.post('/events', protect, organizerOnly, asyncRoute(async (req, res) => {
  const { clubId, title, description, category, date, time, location, capacity, imageUrl, latitude, longitude, registrationDeadline, eligibility, eventType, price, approvalRequired } = req.body;
  if (!clubId || !title || !description || !category || !date || !time || !location || !capacity) return res.status(400).json({ message: 'Club, title, description, category, date, time, location and capacity are required.' });
  const club = await ensureClubAccess(req.user.id, clubId);
  if (!club) return res.status(403).json({ message: 'You do not have access to this club.' });
  const event = await Event.create({
    club: club._id, organizer: req.user.id, title: title.trim(), description: description.trim(), category: category.trim(), date, time, location: location.trim(),
    capacity: Number(capacity), imageUrl: imageUrl || '', latitude: latitude === '' || latitude == null ? null : Number(latitude), longitude: longitude === '' || longitude == null ? null : Number(longitude),
    registrationDeadline: registrationDeadline || '', eligibility: eligibility || 'All students', eventType: eventType || 'event', price: Number(price || 0), approvalRequired: !!approvalRequired,
    status: 'pending_approval'
  });
  res.status(201).json({ message: 'Event submitted for admin approval.', event });
}, 'Server error creating organizer event.'));

router.put('/events/:id', protect, organizerOnly, asyncRoute(async (req, res) => {
  const event = await findOrganizerEvent(req.user.id, req.params.id);
  if (!event) return res.status(404).json({ message: 'Event not found.' });
  applyFields(event, req.body, ORGANIZER_EVENT_FIELDS, ORGANIZER_EVENT_NUMERIC_FIELDS);
  if (event.capacity < event.bookedCount) return res.status(400).json({ message: 'Capacity cannot be lower than current registrations.' });
  event.status = 'pending_approval';
  await event.save();
  res.json({ message: 'Event changes submitted for admin approval.', event });
}, 'Server error updating organizer event.'));

router.get('/events/:id/registrations', protect, organizerOnly, asyncRoute(async (req, res) => {
  const event = await findOrganizerEvent(req.user.id, req.params.id);
  if (!event) return res.status(404).json({ message: 'Event not found.' });
  const bookings = await Booking.find({ event: event.id, status: { $in: COUNTED_BOOKING_STATUSES } }).populate('user', 'name email studentId department');
  res.json({ event, bookings });
}, 'Server error fetching registrations.'));

router.post('/events/:id/announce', protect, organizerOnly, asyncRoute(async (req, res) => {
  const title = String(req.body.title || '').trim();
  const message = String(req.body.message || '').trim();
  const audience = req.body.audience || 'registrants';
  if (!title || !message) return res.status(400).json({ message: 'Announcement title and message are required.' });
  const clubs = await Club.find({ organizerIds: req.user.id }).select('_id followerIds');
  const clubIds = clubs.map((c) => c._id);
  const event = await Event.findOne({ _id: req.params.id, organizer: req.user.id, club: { $in: clubIds } });
  if (!event) return res.status(404).json({ message: 'Event not found.' });
  const recipientIds = new Set();
  if (audience === 'registrants' || audience === 'both') {
    const bookings = await Booking.find({ event: event.id, status: { $in: COUNTED_BOOKING_STATUSES } }).select('user');
    bookings.forEach((b) => recipientIds.add(String(b.user)));
  }
  if (audience === 'followers' || audience === 'both') {
    const club = clubs.find((c) => String(c._id) === String(event.club));
    (club?.followerIds || []).forEach((id) => recipientIds.add(String(id)));
  }
  if (recipientIds.size) await Notification.insertMany([...recipientIds].map((user) => ({ user, type: 'announcement', title, message, link: `event-details.html?id=${event.id}` })));
  res.json({ message: 'Announcement sent.', recipientCount: recipientIds.size });
}, 'Server error sending announcement.'));

router.put('/registrations/:id/status', protect, organizerOnly, asyncRoute(async (req, res) => {
  const { status } = req.body;
  if (!['confirmed', 'rejected', 'cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid registration status.' });
  const booking = await Booking.findById(req.params.id).populate('event').populate('user', 'name email');
  if (!booking || !booking.event) return res.status(404).json({ message: 'Registration not found.' });
  const clubIds = await organizerClubIds(req.user.id);
  if (!clubIds.some((id) => id.toString() === String(booking.event.club)) || String(booking.event.organizer) !== req.user.id) return res.status(403).json({ message: 'You cannot manage this registration.' });
  const wasCounted = isCountedBookingStatus(booking.status);
  const willBeCounted = isCountedBookingStatus(status);
  if (!wasCounted && willBeCounted) {
    if (booking.event.bookedCount >= booking.event.capacity) return res.status(400).json({ message: 'No available seat.' });
    booking.event.bookedCount += 1;
  } else if (wasCounted && !willBeCounted) {
    booking.event.bookedCount = Math.max(0, booking.event.bookedCount - 1);
  }
  booking.status = status;
  await booking.event.save();
  await booking.save();
  await Notification.create({ user: booking.user._id, type: 'booking', title: `Registration ${status}`, message: `Your registration for ${booking.event.title} is ${status}.`, link: `event-details.html?id=${booking.event.id}` });
  res.json({ message: `Registration ${status}.`, booking });
}, 'Server error updating registration.'));

router.post('/check-in', protect, organizerOnly, asyncRoute(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ message: 'Check-in code is required.' });
  const booking = await Booking.findOne({ checkInCode: code }).populate('event').populate('user', 'name email studentId department');
  if (!booking) return res.status(404).json({ message: 'Registration pass not found.' });
  const clubIds = await organizerClubIds(req.user.id);
  if (!booking.event || !clubIds.some((id) => id.toString() === String(booking.event.club))) return res.status(403).json({ message: 'You cannot check in attendees for this event.' });
  if (booking.status !== 'confirmed') return res.status(400).json({ message: 'This registration is not confirmed.' });
  if (booking.checkedInAt) return res.status(409).json({ message: 'This attendee is already checked in.', booking });
  booking.checkedInAt = new Date();
  booking.attendanceStatus = 'checked_in';
  await booking.save();
  await Notification.create({ user: booking.user._id, type: 'checkin', title: 'Checked in successfully', message: `You have been checked in for ${booking.event.title}.`, link: `event-details.html?id=${booking.event.id}` });
  res.json({ message: 'Check-in successful.', booking });
}, 'Server error during check-in.'));

module.exports = router;
