const express = require('express');
const SavedEvent = require('../models/SavedEvent');
const Event = require('../models/Event');
const { protect } = require('../middleware/authMiddleware');
const { asyncRoute } = require('../utils/routeHelpers');
const router = express.Router();

router.get('/', protect, asyncRoute(async (req, res) => {
  const saved = await SavedEvent.find({ user: req.user.id })
    .populate({ path: 'event', populate: [{ path: 'club', select: 'name logoUrl' }, { path: 'organizer', select: 'name' }] })
    .sort({ createdAt: -1 });
  res.json({ savedEvents: saved.filter((item) => item.event && item.event.status === 'published') });
}, 'Server error fetching saved events.'));

router.get('/ids', protect, asyncRoute(async (req, res) => {
  const saved = await SavedEvent.find({ user: req.user.id }).select('event');
  res.json({ eventIds: saved.map((item) => String(item.event)) });
}, 'Server error fetching saved events.', { includeError: false }));

router.post('/:eventId', protect, asyncRoute(async (req, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, status: 'published' });
  if (!event) return res.status(404).json({ message: 'Event not found.' });
  await SavedEvent.updateOne({ user: req.user.id, event: event.id }, { $setOnInsert: { user: req.user.id, event: event.id } }, { upsert: true });
  res.status(201).json({ message: 'Event saved.' });
}, 'Server error saving event.'));

router.delete('/:eventId', protect, asyncRoute(async (req, res) => {
  await SavedEvent.deleteOne({ user: req.user.id, event: req.params.eventId });
  res.json({ message: 'Event removed from saved events.' });
}, 'Server error removing saved event.', { includeError: false }));

module.exports = router;
