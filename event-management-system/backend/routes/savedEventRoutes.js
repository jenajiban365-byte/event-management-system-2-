const express = require('express');
const SavedEvent = require('../models/SavedEvent');
const Event = require('../models/Event');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const saved = await SavedEvent.find({ user: req.user.id })
      .populate({ path: 'event', populate: [{ path: 'club', select: 'name logoUrl' }, { path: 'organizer', select: 'name' }] })
      .sort({ createdAt: -1 });
    const available = saved.filter((item) => item.event && item.event.status === 'published');
    const staleIds = saved.filter((item) => !item.event || item.event.status !== 'published').map(item => item._id);
    if (staleIds.length) await SavedEvent.deleteMany({ _id: { $in: staleIds } });
    res.json({ savedEvents: available });
  } catch (err) { res.status(500).json({ message: 'Server error fetching saved events.', error: err.message }); }
});

router.get('/ids', protect, async (req, res) => {
  try { const saved = await SavedEvent.find({ user: req.user.id }).select('event'); res.json({ eventIds: saved.map((item) => String(item.event)) }); }
  catch (err) { res.status(500).json({ message: 'Server error fetching saved events.' }); }
});

router.post('/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, status: 'published' });
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    await SavedEvent.updateOne({ user: req.user.id, event: event.id }, { $setOnInsert: { user: req.user.id, event: event.id } }, { upsert: true });
    res.status(201).json({ message: 'Event saved.' });
  } catch (err) { res.status(500).json({ message: 'Server error saving event.', error: err.message }); }
});

router.delete('/:eventId', protect, async (req, res) => {
  try { await SavedEvent.deleteOne({ user: req.user.id, event: req.params.eventId }); res.json({ message: 'Event removed from saved events.' }); }
  catch (err) { res.status(500).json({ message: 'Server error removing saved event.' }); }
});
module.exports = router;
