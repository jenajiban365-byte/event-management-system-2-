const express = require('express');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// @route  GET /api/events
// @desc   Public: list published events with optional search/filter
router.get('/', async (req, res) => {
  try {
    const { search, category, upcoming, date, sort, excludeId, limit } = req.query;
    const query = { status: 'published' };

    if (search) {
      const term = search.trim();
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: regex }, { description: regex }, { location: regex }];
    }
    if (category) query.category = category;
    if (date) query.date = date;
    if (upcoming === 'true') {
      const today = new Date().toISOString().split('T')[0];
      query.date = { ...(query.date ? { $eq: query.date } : {}), $gte: today };
    }
    if (excludeId) query._id = { $ne: excludeId };

    const sortOption = sort === 'popular' ? { bookedCount: -1 } : { date: 1 };

    let eventsQuery = Event.find(query).sort(sortOption);
    if (limit) eventsQuery = eventsQuery.limit(Math.min(Number(limit) || 20, 50));

    const events = await eventsQuery;
    res.json({ events });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching events.', error: err.message });
  }
});

// @route  GET /api/events/all
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.json({ events });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching events.', error: err.message });
  }
});

// @route  GET /api/events/:id
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    res.json({ event });
  } catch (err) {
    res.status(404).json({ message: 'Event not found.' });
  }
});

// @route  POST /api/events
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { title, description, category, date, time, location, capacity, imageUrl } = req.body;
    if (!title || !description || !category || !date || !time || !location || !capacity) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const newEvent = await Event.create({
      title,
      description,
      category,
      date,
      time,
      location,
      capacity: Number(capacity),
      bookedCount: 0,
      imageUrl: imageUrl || '',
      status: 'published'
    });

    res.status(201).json({ message: 'Event created.', event: newEvent });
  } catch (err) {
    res.status(500).json({ message: 'Server error creating event.', error: err.message });
  }
});

// @route  PUT /api/events/:id
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const allowedFields = [
      'title', 'description', 'category', 'date', 'time',
      'location', 'capacity', 'imageUrl', 'status'
    ];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        event[field] = field === 'capacity' ? Number(req.body[field]) : req.body[field];
      }
    });

    await event.save();
    res.json({ message: 'Event updated.', event });
  } catch (err) {
    res.status(500).json({ message: 'Server error updating event.', error: err.message });
  }
});

// @route  DELETE /api/events/:id
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    // Cascade: cancel related bookings
    await Booking.updateMany({ event: event.id }, { status: 'cancelled' });

    await event.deleteOne();
    res.json({ message: 'Event deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error deleting event.', error: err.message });
  }
});

module.exports = router;
