const express = require('express');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const Waitlist = require('../models/Waitlist');
const Notification = require('../models/Notification');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { sendError } = require('../utils/errors');
const router = express.Router();

async function withWaitlistCounts(events) {
  const items = Array.isArray(events) ? events : [events];
  const counts = await Promise.all(items.map((event) => Waitlist.countDocuments({ event: event.id, status: 'waiting' })));
  return items.map((event, index) => {
    const obj = event.toObject ? event.toObject() : event;
    obj.waitlistCount = counts[index];
    return obj;
  });
}

router.get('/', async (req, res) => {
  try {
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
    if (upcoming === 'true') query.date = { ...(query.date ? { $eq: query.date } : {}), $gte: new Date().toISOString().split('T')[0] };
    if (excludeId) query._id = { $ne: excludeId };
    const sortOption = sort === 'popular' ? { bookedCount: -1, date: 1 } : { date: 1, time: 1 };
    let eventsQuery = Event.find(query).sort(sortOption);
    if (limit) eventsQuery = eventsQuery.limit(Math.min(Number(limit) || 20, 50));
    const events = await eventsQuery.populate('club', 'name category logoUrl').populate('organizer', 'name email avatarUrl');
    res.json({ events: await withWaitlistCounts(events) });
  } catch (err) {
    sendError(res, 'GET /api/events', err, 'Server error fetching events.');
  }
});

router.get('/all', protect, adminOnly, async (req, res) => {
  try { res.json({ events: await Event.find().sort({ date: 1 }) }); }
  catch (err) { sendError(res, 'GET /api/events/all', err, 'Server error fetching events.'); }
});

router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('club', 'name category logoUrl contactEmail').populate('organizer', 'name email avatarUrl');
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    const [result] = await withWaitlistCounts([event]);
    res.json({ event: result });
  } catch (err) {
    // A malformed id is a 400 via the CastError mapping; a database or waitlist
    // failure is no longer disguised as "Event not found".
    sendError(res, 'GET /api/events/:id', err, 'Server error fetching event.');
  }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { title, description, category, date, time, location, capacity, imageUrl, latitude, longitude } = req.body;
    if (!title || !description || !category || !date || !time || !location || !capacity) return res.status(400).json({ message: 'All fields are required.' });
    const newEvent = await Event.create({
      title, description, category, date, time, location,
      latitude: latitude === '' || latitude === null || latitude === undefined ? null : Number(latitude),
      longitude: longitude === '' || longitude === null || longitude === undefined ? null : Number(longitude),
      capacity: Number(capacity), bookedCount: 0, imageUrl: imageUrl || '', status: 'published'
    });
    res.status(201).json({ message: 'Event created.', event: newEvent });
  } catch (err) { sendError(res, 'POST /api/events', err, 'Server error creating event.'); }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    ['title', 'description', 'category', 'date', 'time', 'location', 'latitude', 'longitude', 'capacity', 'imageUrl', 'status'].forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'capacity' || field === 'latitude' || field === 'longitude') {
          event[field] = req.body[field] === '' || req.body[field] === null ? null : Number(req.body[field]);
        } else {
          event[field] = req.body[field];
        }
      }
    });
    if (event.capacity < event.bookedCount) return res.status(400).json({ message: 'Capacity cannot be lower than current bookings.' });
    await event.save();
    res.json({ message: 'Event updated.', event });
  } catch (err) { sendError(res, 'PUT /api/events/:id', err, 'Server error updating event.'); }
});

router.put('/:id/approval', protect, adminOnly, async (req, res) => {
  try {
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
  } catch (err) { sendError(res, 'PUT /api/events/:id/approval', err, 'Server error updating event approval.'); }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    await Booking.updateMany({ event: event.id }, { status: 'cancelled' });
    await Waitlist.deleteMany({ event: event.id });
    await event.deleteOne();
    res.json({ message: 'Event deleted.' });
  } catch (err) { sendError(res, 'DELETE /api/events/:id', err, 'Server error deleting event.'); }
});
module.exports = router;
