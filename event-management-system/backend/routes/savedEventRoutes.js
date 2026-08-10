const express = require('express');
const SavedEvent = require('../models/SavedEvent');
const Event = require('../models/Event');
const { protect } = require('../middleware/authMiddleware');
const { sendError } = require('../utils/errors');
const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const saved = await SavedEvent.find({ user: req.user.id })
      .populate({ path: 'event', populate: [{ path: 'club', select: 'name logoUrl' }, { path: 'organizer', select: 'name' }] })
      .sort({ createdAt: -1 });
    res.json({ savedEvents: saved.filter((item) => item.event && item.event.status === 'published') });
  } catch (err) { sendError(res, 'GET /api/saved-events', err, 'Server error fetching saved events.'); }
});

router.get('/ids', protect, async (req, res) => {
  try { const saved = await SavedEvent.find({ user: req.user.id }).select('event'); res.json({ eventIds: saved.map((item) => String(item.event)) }); }
  catch (err) { sendError(res, 'GET /api/saved-events/ids', err, 'Server error fetching saved events.'); }
});

router.post('/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, status: 'published' });
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    await SavedEvent.updateOne({ user: req.user.id, event: event.id }, { $setOnInsert: { user: req.user.id, event: event.id } }, { upsert: true });
    res.status(201).json({ message: 'Event saved.' });
  } catch (err) { sendError(res, 'POST /api/saved-events/:eventId', err, 'Server error saving event.'); }
});

router.delete('/:eventId', protect, async (req, res) => {
  try { await SavedEvent.deleteOne({ user: req.user.id, event: req.params.eventId }); res.json({ message: 'Event removed from saved events.' }); }
  catch (err) { sendError(res, 'DELETE /api/saved-events/:eventId', err, 'Server error removing saved event.'); }
});
module.exports = router;
