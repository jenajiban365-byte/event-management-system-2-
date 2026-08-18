const express = require('express');
const Event = require('../models/Event');
const Club = require('../models/Club');
const Booking = require('../models/Booking');
const Waitlist = require('../models/Waitlist');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { publishGroupPost } = require('../utils/group');
const router = express.Router();

function lifecycleFor(event) {
  if (event.status !== 'published') return event.status;
  const today = new Date().toISOString().slice(0,10);
  if (event.registrationDeadline && event.registrationDeadline < today && event.date >= today) return 'registration_closed';
  if (event.date < today) return 'completed';
  if (event.date > today) return 'registration_open';
  const now = new Date();
  const start = String(event.time || '00:00').split(':').map(Number);
  const end = String(event.endTime || event.time || '23:59').split(':').map(Number);
  const startAt = new Date(); startAt.setHours(start[0]||0,start[1]||0,0,0);
  const endAt = new Date(); endAt.setHours(end[0]||23,end[1]||59,59,999);
  if (now < startAt) return 'registration_open';
  if (now <= endAt) return 'ongoing';
  return 'completed';
}
function decorateLifecycle(event) { const obj=event.toObject ? event.toObject() : {...event}; obj.lifecycle=lifecycleFor(obj); return obj; }

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
    const { search, category, upcoming, date, dateTo, sort, excludeId, limit, price, eventType, availability } = req.query;
    const query = { status: 'published' };
    if (search) {
      const term = search.trim();
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matchingClubs = await Club.find({ status: 'active', $or: [
        { name: regex }, { shortName: regex }, { description: regex }, { department: regex }
      ] }).select('_id');
      query.$or = [
        { title: regex },
        { description: regex },
        { location: regex },
        ...(matchingClubs.length ? [{ club: { $in: matchingClubs.map((club) => club._id) } }] : [])
      ];
    }
    if (category) query.category = category;
    if (eventType) query.eventType = eventType;
    if (price === 'free') query.price = { $eq: 0 };
    if (price === 'paid') query.price = { $gt: 0 };
    if (availability === 'available') query.$expr = { $lt: ['$bookedCount', '$capacity'] };
    if (availability === 'waitlist') query.$expr = { $gte: ['$bookedCount', '$capacity'] };
    // Date filtering always works on 'YYYY-MM-DD' strings, so a single range
    // object keeps `date`, `dateTo` and `upcoming` composable instead of
    // overwriting each other (which silently broke the Discover date filter).
    const today = new Date().toISOString().split('T')[0];
    let dateFrom = date || null;
    let dateUntil = dateTo || null;
    if (dateFrom && !dateUntil && !dateTo) dateUntil = dateFrom; // exact single day
    if (upcoming === 'true') {
      if (!dateFrom || dateFrom < today) dateFrom = today;
      if (dateUntil && dateUntil < dateFrom) dateUntil = null;
    }
    if (dateFrom || dateUntil) {
      query.date = {};
      if (dateFrom) query.date.$gte = dateFrom;
      if (dateUntil) query.date.$lte = dateUntil;
    }
    if (excludeId) query._id = { $ne: excludeId };
    const sortOption = sort === 'popular' ? { bookedCount: -1, date: 1 } : sort === 'date-desc' ? { date: -1, time: -1 } : { date: 1, time: 1 };
    let eventsQuery = Event.find(query).sort(sortOption);
    if (limit) eventsQuery = eventsQuery.limit(Math.min(Number(limit) || 20, 50));
    const events = await eventsQuery.populate('club', 'name category logoUrl').populate('organizer', 'name email avatarUrl');
    res.json({ events: (await withWaitlistCounts(events)).map(decorateLifecycle) });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching events.', error: err.message });
  }
});

router.get('/all', protect, adminOnly, async (req, res) => {
  try { res.json({ events: await Event.find().sort({ date: 1 }) }); }
  catch (err) { res.status(500).json({ message: 'Server error fetching events.', error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('club', 'name category logoUrl contactEmail shortName').populate('organizer', 'name email avatarUrl');
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    const [result] = await withWaitlistCounts([event]);
    res.json({ event: decorateLifecycle(result) });
  } catch (err) { res.status(404).json({ message: 'Event not found.' }); }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { title, description, category, date, time, endTime, location, capacity, imageUrl, latitude, longitude, clubId, organizerId, registrationDeadline, eligibility, eventType, price, approvalRequired, customRegistrationQuestions } = req.body;
    if (!title || !description || !category || !date || !time || !location || !capacity) return res.status(400).json({ message: 'All fields are required.' });
    let club = null;
    let assignedOrganizer = organizerId || null;
    if (clubId) {
      club = await Club.findOne({ _id: clubId, status: { $in: ['approved', 'active'] } });
      if (!club) return res.status(400).json({ message: 'Selected club was not found or is inactive.' });
      if (!assignedOrganizer) assignedOrganizer = club.organizerIds?.[0] || club.createdBy || null;
    }
    const newEvent = await Event.create({
      title: String(title).trim(), description: String(description).trim(), category: String(category).trim(), date, time, endTime: endTime || '', location: String(location).trim(),
      latitude: latitude === '' || latitude === null || latitude === undefined ? null : Number(latitude),
      longitude: longitude === '' || longitude === null || longitude === undefined ? null : Number(longitude),
      capacity: Number(capacity), bookedCount: 0, imageUrl: imageUrl || '', status: 'published', club: club?._id || null, organizer: assignedOrganizer,
      registrationDeadline: registrationDeadline || '', eligibility: eligibility || 'All students', eventType: eventType || 'event', price: Number(price || 0), approvalRequired: !!approvalRequired,
      customRegistrationQuestions: Array.isArray(customRegistrationQuestions) ? customRegistrationQuestions : []
    });
    res.status(201).json({ message: 'Event created.', event: newEvent });
  } catch (err) { res.status(500).json({ message: 'Server error creating event.', error: err.message }); }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    ['title', 'description', 'category', 'date', 'time', 'endTime', 'location', 'latitude', 'longitude', 'capacity', 'imageUrl', 'status', 'registrationDeadline', 'eligibility', 'eventType', 'price', 'approvalRequired', 'customRegistrationQuestions'].forEach((field) => {
      if (req.body[field] !== undefined) {
        if (['capacity', 'latitude', 'longitude', 'price'].includes(field)) {
          event[field] = req.body[field] === '' || req.body[field] === null ? null : Number(req.body[field]);
        } else if (field === 'customRegistrationQuestions' && Array.isArray(req.body[field])) {
          event[field] = req.body[field];
        } else {
          event[field] = req.body[field];
        }
      }
    });
    if (req.body.clubId !== undefined) {
      if (!req.body.clubId) { event.club = null; }
      else {
        const club = await Club.findOne({ _id: req.body.clubId, status: { $in: ['approved', 'active'] } });
        if (!club) return res.status(400).json({ message: 'Selected club was not found or is inactive.' });
        event.club = club._id;
        if (!event.organizer) event.organizer = club.organizerIds?.[0] || club.createdBy || null;
      }
    }
    if (req.body.organizerId !== undefined) event.organizer = req.body.organizerId || null;
    if (event.capacity < event.bookedCount) return res.status(400).json({ message: 'Capacity cannot be lower than current bookings.' });
    await event.save();
    res.json({ message: 'Event updated.', event });
  } catch (err) { res.status(500).json({ message: 'Server error updating event.', error: err.message }); }
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
    if (status === 'published' && event.club) {
      const club = await Club.findById(event.club);
      if (club) {
        await publishGroupPost({
          club,
          authorId: event.organizer || req.user.id,
          type: 'event',
          title: `New event: ${event.title}`,
          content: `${event.title} is now live. Open the registration form to reserve your spot.`,
          event: event._id,
          link: `/event-form.html?id=${event._id}`
        });
      }
    }
    if (event.organizer) {
      const Notification = require('../models/Notification');
      await Notification.create({ user: event.organizer, type: 'event', title: `Event ${status.replace('_', ' ')}`, message: event.approvalNote || `${event.title} is now ${status.replace('_', ' ')}.`, link: `/event-details.html?id=${event.id}` });
    }
    res.json({ message: `Event ${status}.`, event });
  } catch (err) { res.status(500).json({ message: 'Server error updating event approval.', error: err.message }); }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    await Booking.updateMany({ event: event.id }, { status: 'cancelled' });
    await Waitlist.deleteMany({ event: event.id });
    await event.deleteOne();
    res.json({ message: 'Event deleted.' });
  } catch (err) { res.status(500).json({ message: 'Server error deleting event.', error: err.message }); }
});
module.exports = router;
