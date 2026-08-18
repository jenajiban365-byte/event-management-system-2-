const express = require('express');
const crypto = require('crypto');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const Club = require('../models/Club');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

const QUESTION_TYPES = new Set([
  'short_answer','paragraph','multiple_choice','checkbox_group','dropdown','email','number','date','time','url','file','linear_scale','rating',
  // Legacy EventHub types remain valid.
  'text','textarea','select','checkbox'
]);

function cleanQuestion(q = {}) {
  const type = QUESTION_TYPES.has(String(q.type)) ? String(q.type) : 'short_answer';
  return {
    question: String(q.question || '').trim().slice(0, 500),
    description: String(q.description || '').trim().slice(0, 1000),
    type,
    options: Array.isArray(q.options) ? q.options.map(v => String(v).trim()).filter(Boolean).slice(0, 50) : [],
    required: q.required !== false,
    imageUrl: String(q.imageUrl || '').trim().slice(0, 1000),
    scaleMin: Math.min(10, Math.max(0, Number(q.scaleMin ?? 1))),
    scaleMax: Math.min(10, Math.max(1, Number(q.scaleMax ?? 5))),
    scaleMinLabel: String(q.scaleMinLabel || '').trim().slice(0, 80),
    scaleMaxLabel: String(q.scaleMaxLabel || '').trim().slice(0, 80),
    validation: String(q.validation || '').trim().slice(0, 200),
    maxLength: Math.min(5000, Math.max(0, Number(q.maxLength || 0))),
    fileAccept: String(q.fileAccept || '').trim().slice(0, 300),
    maxFileSizeMB: Math.min(100, Math.max(1, Number(q.maxFileSizeMB || 10))),
    showWhen: q.showWhen && Number.isInteger(Number(q.showWhen.questionIndex)) && Number(q.showWhen.questionIndex) >= 0
      ? { questionIndex: Number(q.showWhen.questionIndex), equals: String(q.showWhen.equals || '').trim().slice(0, 200) }
      : { questionIndex: null, equals: '' }
  };
}

function normalizeQuestions(list) {
  return (Array.isArray(list) ? list : [])
    .map(cleanQuestion)
    .filter(q => q.question);
}

function formCodeFor(event) {
  return event.registrationForm?.formCode || `EH-${crypto.createHash('sha1').update(String(event._id)).digest('hex').slice(0, 8).toUpperCase()}`;
}

async function canManageEvent(req, event) {
  if (!event) return false;
  if (['admin','organizer'].includes(req.user.role)) return true;
  if (req.user.role !== 'club_head') return false;
  if (event.organizer && String(event.organizer) === String(req.user.id)) return true;
  if (!event.club) return false;
  const club = await Club.findById(event.club).select('clubHeads');
  return String(req.user.clubId || '') === String(event.club) || !!club?.clubHeads?.some(id => String(id) === String(req.user.id));
}

// Public form metadata. The form itself is only live for published events.
router.get('/public/:eventId', async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .populate('club', 'name shortName logoUrl coverImage')
      .populate('organizer', 'name avatarUrl');
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    if (event.status !== 'published') return res.status(404).json({ message: 'This registration form is not live yet.' });
    const form = event.registrationForm || {};
    const settings = form.settings || {};
    const questions = normalizeQuestions(event.customRegistrationQuestions);
    const spotsLeft = Math.max(0, Number(event.capacity || 0) - Number(event.bookedCount || 0));
    res.json({
      event: {
        id: event.id, title: event.title, description: event.description, date: event.date, time: event.time, endTime: event.endTime,
        location: event.location, imageUrl: event.imageUrl, capacity: event.capacity, bookedCount: event.bookedCount,
        spotsLeft, registrationDeadline: event.registrationDeadline, eligibility: event.eligibility, price: event.price,
        club: event.club, organizer: event.organizer
      },
      form: {
        enabled: form.enabled !== false,
        title: form.title || `${event.title} Registration`,
        description: form.description || '',
        formCode: formCodeFor(event),
        settings: {
          collectEmail: settings.collectEmail !== false,
          requireLogin: settings.requireLogin !== false,
          limitOneResponse: settings.limitOneResponse !== false,
          showProgress: settings.showProgress !== false,
          shuffleQuestions: !!settings.shuffleQuestions,
          allowEditResponse: !!settings.allowEditResponse,
          showResponseReceipt: settings.showResponseReceipt !== false,
          showDigitalTicket: settings.showDigitalTicket !== false,
          confirmationTitle: settings.confirmationTitle || 'You’re registered!',
          confirmationMessage: settings.confirmationMessage || 'Your response has been recorded on EventHub.'
        },
        theme: form.theme || { accent: '#6554e8', style: 'campus', coverImage: '' },
        questions
      }
    });
  } catch (err) { res.status(500).json({ message: 'Could not load registration form.' }); }
});

router.get('/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId).populate('club', 'name shortName logoUrl coverImage');
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    if (!await canManageEvent(req, event)) return res.status(403).json({ message: 'You cannot manage this event form.' });
    const bookings = await Booking.countDocuments({ event: event._id, status: { $in: ['confirmed','pending'] } });
    res.json({
      event,
      form: {
        enabled: event.registrationForm?.enabled || false,
        title: event.registrationForm?.title || `${event.title} Registration`,
        description: event.registrationForm?.description || '',
        formCode: formCodeFor(event),
        settings: event.registrationForm?.settings || {},
        theme: event.registrationForm?.theme || {},
        questions: normalizeQuestions(event.customRegistrationQuestions),
        responseCount: bookings,
        publicUrl: `/smart-form.html?event=${event.id}`
      }
    });
  } catch (err) { res.status(500).json({ message: 'Could not load form builder.' }); }
});

router.put('/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    if (!await canManageEvent(req, event)) return res.status(403).json({ message: 'You cannot manage this event form.' });
    const settings = req.body.settings || {};
    const theme = req.body.theme || {};
    event.customRegistrationQuestions = normalizeQuestions(req.body.questions);
    event.registrationForm = {
      enabled: req.body.enabled !== false,
      title: String(req.body.title || `${event.title} Registration`).trim().slice(0, 180),
      description: String(req.body.description || '').trim().slice(0, 2000),
      formCode: formCodeFor(event),
      settings: {
        collectEmail: settings.collectEmail !== false,
        requireLogin: settings.requireLogin !== false,
        limitOneResponse: settings.limitOneResponse !== false,
        showProgress: settings.showProgress !== false,
        shuffleQuestions: !!settings.shuffleQuestions,
        allowEditResponse: !!settings.allowEditResponse,
        showResponseReceipt: settings.showResponseReceipt !== false,
        showDigitalTicket: settings.showDigitalTicket !== false,
        confirmationTitle: String(settings.confirmationTitle || 'You’re registered!').slice(0, 120),
        confirmationMessage: String(settings.confirmationMessage || 'Your response has been recorded on EventHub.').slice(0, 500)
      },
      theme: {
        accent: /^#[0-9a-f]{6}$/i.test(String(theme.accent || '')) ? String(theme.accent) : '#6554e8',
        style: ['campus','minimal','midnight'].includes(theme.style) ? theme.style : 'campus',
        coverImage: String(theme.coverImage || '').trim().slice(0, 1000)
      }
    };
    await event.save();
    res.json({ message: 'Campus Smart Form saved.', form: { ...event.registrationForm.toObject(), questions: normalizeQuestions(event.customRegistrationQuestions), publicUrl: `/smart-form.html?event=${event.id}` } });
  } catch (err) { res.status(500).json({ message: 'Could not save registration form.', error: err.message }); }
});

module.exports = router;
