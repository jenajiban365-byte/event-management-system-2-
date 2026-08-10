const express = require('express');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const Waitlist = require('../models/Waitlist');
const Notification = require('../models/Notification');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { asyncRoute, applyFields, toNumberOrNull, todayIsoDate } = require('../utils/routeHelpers');
const router = express.Router();

const EVENT_FIELDS = ['title', 'description', 'category', 'date', 'time', 'location', 'latitude', 'longitude', 'capacity', 'imageUrl', 'status'];
const EVENT_NUMERIC_FIELDS = ['capacity', 'latitude', 'longitude'];

async function withWaitlistCounts(events) {
  const items = Array.isArray(events) ? events : [events];
  const counts = await Promise.all(items.map((event) => Waitlist.countDocuments({ event: event.id, status: 'waiting' })));
  return items.map((event, index) => {
    const obj = event.toObject ? event.toObject() : event;
    obj.waitlistCount = counts[index];
    return obj;
  });
}

router.get('/', asyncRoute(async (req, res) => {
  const { search, category, upcoming, date, sort, excludeId, limit, price, eventType, availability } = req.query;
  const query = { status: 'published' };
  if (search) {
    const term = search.trim();
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ title: regex }, { description: regex }, { location: regex }];
  }
  if (category) query.category = category;
  if (eventType) query.eventType = eventType;
  if (price === 'free') query.price = { $eq: 0 };
  if (price === 'paid') query.price = { $gt: 0 };
  if (availability === 'available') query.$expr = { $lt: ['$bookedCount', '$capacity'] };
  if (date) query.date = date;
  if (upcoming === 'true') query.date = { ...(query.date ? { $eq: query.date } : {}), $gte: todayIsoDate() };
  if (excludeId) query._id = { $ne: excludeId };
  const sortOption = sort === 'popular' ? { bookedCount: -1, date: 1 } : { date: 1, time: 1 };
  let eventsQuery = Event.find(query).sort(sortOption);
  if (limit) eventsQuery = eventsQuery.limit(Math.min(Number(limit) || 20, 50));
  const events = await eventsQuery.populate('club', 'name category logoUrl').populate('organizer', 'name email avatarUrl');
  res.json({ events: await withWaitlistCounts(events) });
}, 'Server error fetching events.'));

router.get('/all', protect, adminOnly, asyncRoute(async (req, res) => {
  res.json({ events: await Event.find().sort({ date: 1 }) });
}, 'Server error fetching events.'));

router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('club', 'name category logoUrl contactEmail').populate('organizer', 'name email avatarUrl');
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    const [result] = await withWaitlistCounts([event]);
    res.json({ event: result });
  } catch (err) { res.status(404).json({ message: 'Event not found.' }); }
});

router.post('/', protect, adminOnly, asyncRoute(async (req, res) => {
  const { title, description, category, date, time, location, capacity, imageUrl, latitude, longitude } = req.body;
  if (!title || !description || !category || !date || !time || !location || !capacity) return res.status(400).json({ message: 'All fields are required.' });
  const newEvent = await Event.create({
    title, description, category, date, time, location,
    latitude: toNumberOrNull(latitude),
    longitude: toNumberOrNull(longitude),
    capacity: Number(capacity), bookedCount: 0, imageUrl: imageUrl || '', status: 'published'
  });
  res.status(201).json({ message: 'Event created.', event: newEvent });
}, 'Server error creating event.'));

router.put('/:id', protect, adminOnly, asyncRoute(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ message: 'Event not found.' });
  applyFields(event, req.body, EVENT_FIELDS, EVENT_NUMERIC_FIELDS);
  if (event.capacity < event.bookedCount) return res.status(400).json({ message: 'Capacity cannot be lower than current bookings.' });
  await event.save();
  res.json({ message: 'Event updated.', event });
}, 'Server error updating event.'));

router.put('/:id/approval', protect, adminOnly, asyncRoute(async (req, res) => {
  const { status, note } = req.body;
  if (!['published', 'changes_requested', 'rejected', 'cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid approval status.' });
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ message: 'Event not found.' });
  event.status = status;
  event.approvalNote = String(note || '').trim();
  if (status === 'published') event.publishedAt = new Date();
  await event.save();
  if (event.organizer) {
    await Notification.create({ user: event.organizer, type: 'event', title: `Event ${status.replace('_', ' ')}`, message: event.approvalNote || `${event.title} is now ${status.replace('_', ' ')}.`, link: `/event-details.html?id=${event.id}` });
  }
  res.json({ message: `Event ${status}.`, event });
}, 'Server error updating event approval.'));

router.delete('/:id', protect, adminOnly, asyncRoute(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ message: 'Event not found.' });
  await Booking.updateMany({ event: event.id }, { status: 'cancelled' });
  await Waitlist.deleteMany({ event: event.id });
  await event.deleteOne();
  res.json({ message: 'Event deleted.' });
}, 'Server error deleting event.'));

module.exports = router;
