const express = require('express');
const crypto = require('crypto');
const Event = require('../models/Event');
const Club = require('../models/Club');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');
const { organizerOnly } = require('../middleware/roleMiddleware');
const router = express.Router();

function lifecycleFor(event) {
  if (event.status !== 'published') return event.status;
  const today = new Date().toISOString().slice(0,10);
  if (event.registrationDeadline && event.registrationDeadline < today && event.date >= today) return 'registration_closed';
  if (event.date < today) return 'completed';
  if (event.date > today) return 'registration_open';
  const now = new Date(); const [sh,sm]=String(event.time||'00:00').split(':').map(Number); const [eh,em]=String(event.endTime||event.time||'23:59').split(':').map(Number);
  const start=new Date(); start.setHours(sh||0,sm||0,0,0); const end=new Date(); end.setHours(eh||23,em||59,59,999);
  return now<start?'registration_open':now<=end?'ongoing':'completed';
}

async function getOrganizerClubIds(userId, isAdmin = false) {
  // College organizers are the campus-wide event operations team. They need
  // visibility into every active club and every event already published in
  // EventHub, not only events they personally created. The optional club
  // relationship remains useful as a primary/assigned club, but it must not
  // hide legacy or admin-created events from the organizer console.
  return Club.find({ status: { $nin: ['blocked', 'inactive'] } }).distinct('_id');
}

async function ensureClubAccess(userId, clubId, isAdmin = false) {
  if (isAdmin) return Club.findOne({ _id: clubId, status: { $in: ['approved', 'active'] } });
  const clubIds = await getOrganizerClubIds(userId, false);
  return Club.findOne({ _id: clubId, status: { $in: ['approved', 'active'] } }).then(club => club && clubIds.some(id => String(id) === String(club._id)) ? club : null);
}

function organizerEventFilter(userId, clubIds, isAdmin = false) {
  // Organizers manage the college event registry. This intentionally includes
  // events created by admins, club heads, older EventHub versions, and events
  // without a club. The student-facing event list is the source of truth.
  return {};
}

router.get('/dashboard', protect, organizerOnly, async (req, res) => {
  try {
    const clubIds = await getOrganizerClubIds(req.user.id, req.user.role === 'admin');
    const clubs = await Club.find({ _id: { $in: clubIds }, status: { $nin: ['blocked', 'inactive'] } }).sort({ name: 1 });
    const eventFilter = organizerEventFilter(req.user.id, clubIds, req.user.role === 'admin');
    const ownedEventIds = await Event.find(eventFilter).distinct('_id');
    const [events, upcoming, registrations] = await Promise.all([
      Event.countDocuments(eventFilter),
      Event.countDocuments({ ...eventFilter, status: 'published', date: { $gte: new Date().toISOString().slice(0, 10) } }),
      Booking.countDocuments({ event: { $in: ownedEventIds }, status: { $in: ['confirmed', 'pending'] } })
    ]);
    res.json({ totals: { clubs: clubs.length, events, upcomingEvents: upcoming, registrations }, clubs });
  } catch (err) { res.status(500).json({ message: 'Server error fetching organizer dashboard.', error: err.message }); }
});

router.get('/clubs', protect, organizerOnly, async (req, res) => {
  try {
    // This endpoint is intentionally campus-wide. Do not filter by the
    // organizer's clubId/organizerIds: organizers must be able to create and
    // operate events for every club that exists in EventHub.
    const clubs = await Club.find({
      status: { $nin: ['blocked', 'inactive'] }
    }).sort({ name: 1 });
    res.json({ clubs });
  } catch (err) {
    console.error('ORGANIZER CLUBS ERROR:', err);
    res.status(500).json({ message: 'Server error fetching organizer clubs.', error: err.message });
  }
});

router.get('/scope', protect, organizerOnly, async (req, res) => {
  try {
    const clubs = await Club.find({ status: { $in: ['approved', 'active'] } }).select('name shortName category department logoUrl coverImage status').sort({ name: 1 });
    const events = await Event.find({}).select('title date time status club organizer bookedCount capacity').populate('club', 'name shortName').populate('organizer', 'name email').sort({ date: 1, time: 1 });
    res.json({ scope: 'campus-wide', clubs, events });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching organizer campus scope.', error: err.message });
  }
});

router.get('/events', protect, organizerOnly, async (req, res) => {
  try {
    const clubIds = await getOrganizerClubIds(req.user.id, req.user.role === 'admin');
    const events = await Event.find(organizerEventFilter(req.user.id, clubIds, req.user.role === 'admin'))
      .populate('club', 'name shortName logoUrl')
      .populate('organizer', 'name email avatarUrl')
      .sort({ date: 1, time: 1 });
    res.json({ events: events.map(e => {
      const o = e.toObject();
      o.lifecycle = lifecycleFor(o);
      o.managementSource = String(e.organizer || '') === String(req.user.id) ? 'created_by_you' : (e.club ? 'club_event' : 'campus_event');
      return o;
    }) });
  } catch (err) { res.status(500).json({ message: 'Server error fetching organizer events.', error: err.message }); }
});

router.post('/events', protect, organizerOnly, async (req, res) => {
  try {
    const { clubId, title, description, category, date, time, endTime, location, capacity, imageUrl, latitude, longitude, registrationDeadline, eligibility, eventType, price, approvalRequired, customRegistrationQuestions } = req.body;
    if (!title || !description || !category || !date || !time || !location || !capacity) return res.status(400).json({ message: 'Title, description, category, date, time, location and capacity are required.' });
    const club = clubId ? await ensureClubAccess(req.user.id, clubId, req.user.role === 'admin') : null;
    if (clubId && !club) return res.status(403).json({ message: 'Selected club was not found or is inactive.' });
    const event = await Event.create({
      club: club?._id || null, organizer: req.user.id, title: title.trim(), description: description.trim(), category: category.trim(), date, time, endTime: endTime || '', location: location.trim(),
      capacity: Number(capacity), imageUrl: imageUrl || '', latitude: latitude === '' || latitude == null ? null : Number(latitude), longitude: longitude === '' || longitude == null ? null : Number(longitude),
      registrationDeadline: registrationDeadline || '', eligibility: eligibility || 'All students', eventType: eventType || 'event', price: Number(price || 0), approvalRequired: !!approvalRequired,
      customRegistrationQuestions: Array.isArray(customRegistrationQuestions) ? customRegistrationQuestions.filter(q => q && String(q.question || '').trim()).map(q => ({ question: String(q.question).trim(), type: ['text','textarea','select','checkbox','email','number','date','url','file'].includes(q.type) ? q.type : 'text', options: Array.isArray(q.options) ? q.options.map(v => String(v).trim()).filter(Boolean).slice(0,20) : [], required: q.required !== false, showWhen: q.showWhen && Number.isInteger(Number(q.showWhen.questionIndex)) && Number(q.showWhen.questionIndex) >= 0 ? { questionIndex: Number(q.showWhen.questionIndex), equals: String(q.showWhen.equals || '').trim().slice(0,200) } : { questionIndex: null, equals: '' } })) : [],
      status: 'pending_approval'
    });
    res.status(201).json({ message: 'Event submitted for admin approval.', event });
  } catch (err) { res.status(500).json({ message: 'Server error creating organizer event.', error: err.message }); }
});

router.put('/events/:id', protect, organizerOnly, async (req, res) => {
  try {
    const clubIds = await getOrganizerClubIds(req.user.id, req.user.role === 'admin');
    const event = await Event.findOne({ _id: req.params.id, ...organizerEventFilter(req.user.id, clubIds, req.user.role === 'admin') });
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    const editable = ['title','description','category','date','time','endTime','location','capacity','imageUrl','latitude','longitude','registrationDeadline','eligibility','eventType','price','approvalRequired','customRegistrationQuestions'];
    editable.forEach((field) => { if (req.body[field] !== undefined) event[field] = ['capacity','latitude','longitude','price'].includes(field) ? (req.body[field] === '' || req.body[field] == null ? null : Number(req.body[field])) : (field === 'customRegistrationQuestions' && Array.isArray(req.body[field]) ? req.body[field].filter(q => q && String(q.question || '').trim()).map(q => ({ question: String(q.question).trim(), type: ['text','textarea','select','checkbox','email','number','date','url','file'].includes(q.type) ? q.type : 'text', options: Array.isArray(q.options) ? q.options.map(v => String(v).trim()).filter(Boolean).slice(0,20) : [], required: q.required !== false, showWhen: q.showWhen && Number.isInteger(Number(q.showWhen.questionIndex)) && Number(q.showWhen.questionIndex) >= 0 ? { questionIndex: Number(q.showWhen.questionIndex), equals: String(q.showWhen.equals || '').trim().slice(0,200) } : { questionIndex: null, equals: '' } })) : req.body[field]); });
    if (event.capacity < event.bookedCount) return res.status(400).json({ message: 'Capacity cannot be lower than current registrations.' });
    event.status = 'pending_approval';
    await event.save();
    res.json({ message: 'Event changes submitted for admin approval.', event });
  } catch (err) { res.status(500).json({ message: 'Server error updating organizer event.', error: err.message }); }
});

router.get('/events/:id/registrations', protect, organizerOnly, async (req, res) => {
  try {
    const clubIds = await getOrganizerClubIds(req.user.id, req.user.role === 'admin');
    const event = await Event.findOne({ _id: req.params.id, ...organizerEventFilter(req.user.id, clubIds, req.user.role === 'admin') });
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    const bookings = await Booking.find({ event: event.id }).populate('user', 'name email studentId department year phone avatarUrl').sort({ createdAt: 1 });
    res.json({ event, bookings });
  } catch (err) { res.status(500).json({ message: 'Server error fetching registrations.', error: err.message }); }
});




router.get('/events/:id/registrations.csv', protect, organizerOnly, async (req, res) => {
  try {
    const clubIds = await getOrganizerClubIds(req.user.id, req.user.role === 'admin');
    const event = await Event.findOne({ _id: req.params.id, ...organizerEventFilter(req.user.id, clubIds, req.user.role === 'admin') });
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    const bookings = await Booking.find({ event: event._id }).populate('user', 'name email studentId department year phone avatarUrl').sort({ createdAt: 1 });
    const questions = [...new Set((event.customRegistrationQuestions || []).map(q => String(q.question || '').trim()).filter(Boolean))];
    const esc = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const headers = ['Name','Email','Student ID','Department','Year','Phone','Status','Registered At',...questions];
    const rows = bookings.map(b => { const map = new Map((b.registrationAnswers || []).map(a => [String(a.question || '').trim(), a.answer || ''])); return [b.user?.name,b.user?.email,b.user?.studentId,b.user?.department,b.user?.year,b.user?.phone,b.status,b.createdAt?.toISOString(),...questions.map(q => map.get(q)||'')]; });
    const csv = [headers,...rows].map(r => r.map(esc).join(',')).join('\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${event.title.replace(/[^a-z0-9]+/gi,'-')}-registrations.csv"`);
    res.send('\ufeff'+csv);
  } catch (err) { res.status(500).json({ message: 'Could not export registrations.' }); }
});

router.post('/events/:id/announce', protect, organizerOnly, async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const message = String(req.body.message || '').trim();
    const audience = req.body.audience || 'registrants';
    if (!title || !message) return res.status(400).json({ message: 'Announcement title and message are required.' });
    const clubs = await Club.find({ status: { $in: ['approved', 'active'] } }).select('_id followerIds');
    const event = await Event.findOne({ _id: req.params.id });
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    const recipientIds = new Set();
    if (audience === 'registrants' || audience === 'both') {
      const bookings = await Booking.find({ event: event.id, status: { $in: ['confirmed', 'pending'] } }).select('user');
      bookings.forEach((b) => recipientIds.add(String(b.user)));
    }
    if (audience === 'followers' || audience === 'both') {
      const club = clubs.find((c) => String(c._id) === String(event.club));
      (club?.followerIds || []).forEach((id) => recipientIds.add(String(id)));
    }
    if (recipientIds.size) await Notification.insertMany([...recipientIds].map((user) => ({ user, type: 'announcement', title, message, link: `event-details.html?id=${event.id}` })));
    res.json({ message: 'Announcement sent.', recipientCount: recipientIds.size });
  } catch (err) { res.status(500).json({ message: 'Server error sending announcement.', error: err.message }); }
});

// V44 — bulk approve/reject registrations from the organizer roster
router.put('/registrations/bulk-status', protect, organizerOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String).slice(0, 200) : [];
    if (!['confirmed', 'rejected', 'cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid registration status.' });
    if (!ids.length) return res.status(400).json({ message: 'Select at least one registration.' });
    const bookings = await Booking.find({ _id: { $in: ids } }).populate('event').populate('user', 'name email');
    let updated = 0;
    const skipped = [];
    for (const booking of bookings) {
      if (!booking.event) { skipped.push(String(booking._id)); continue; }
      if (booking.status === status) continue;
      const wasCounted = ['confirmed', 'pending'].includes(booking.status);
      const willBeCounted = ['confirmed', 'pending'].includes(status);
      if (!wasCounted && willBeCounted) {
        if (booking.event.bookedCount >= booking.event.capacity) { skipped.push(String(booking._id)); continue; }
        booking.event.bookedCount += 1;
      } else if (wasCounted && !willBeCounted) {
        booking.event.bookedCount = Math.max(0, booking.event.bookedCount - 1);
      }
      booking.status = status;
      await booking.event.save();
      await booking.save();
      await Notification.create({ user: booking.user._id, type: 'booking', title: `Registration ${status}`, message: `Your registration for ${booking.event.title} is ${status}.`, link: `event-details.html?id=${booking.event.id}` });
      updated += 1;
    }
    res.json({ message: `${updated} registration${updated === 1 ? '' : 's'} ${status}.`, updated, skipped });
  } catch (err) { res.status(500).json({ message: 'Server error updating registrations.', error: err.message }); }
});

router.put('/registrations/:id/status', protect, organizerOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['confirmed', 'rejected', 'cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid registration status.' });
    const booking = await Booking.findById(req.params.id).populate('event').populate('user', 'name email');
    if (!booking || !booking.event) return res.status(404).json({ message: 'Registration not found.' });
    // Organizers are campus-wide operators, so a registration belongs to their
    // management scope whenever its event exists in EventHub.
    if (req.user.role !== 'admin' && !booking.event) return res.status(404).json({ message: 'Event not found.' });
    const wasCounted = ['confirmed', 'pending'].includes(booking.status);
    const willBeCounted = ['confirmed', 'pending'].includes(status);
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
  } catch (err) { res.status(500).json({ message: 'Server error updating registration.', error: err.message }); }
});

router.post('/check-in', protect, async (req, res) => {
  try {
    if (!['organizer', 'admin', 'club_head'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Organizer or Club Head access required.' });
    }

    const code = String(req.body.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ message: 'Check-in code is required.' });

    const booking = await Booking.findOne({ checkInCode: code })
      .populate('event')
      .populate('user', 'name email studentId department');

    if (!booking) return res.status(404).json({ message: 'Registration pass not found.' });

    let allowed = req.user.role === 'admin' || req.user.role === 'organizer';
    if (!allowed && booking.event) {
      const club = await Club.findById(booking.event.club).select('clubHeads');
      if (club && req.user.role === 'club_head') {
        allowed = String(req.user.clubId || '') === String(club._id) || (club.clubHeads || []).some((id) => String(id) === String(req.user.id));
      }
      if (!allowed && booking.event.organizer && String(booking.event.organizer) === String(req.user.id)) allowed = true;
    }
    if (!allowed) return res.status(403).json({ message: 'You cannot check in attendees for this event.' });
    if (booking.status !== 'confirmed') return res.status(400).json({ message: 'This registration is not confirmed.' });
    if (booking.checkedInAt) return res.status(409).json({ message: 'This attendee is already checked in.', booking });

    booking.checkedInAt = new Date();
    booking.attendanceStatus = 'checked_in';
    await booking.save();

    await Notification.create({
      user: booking.user._id,
      type: 'checkin',
      title: 'Checked in successfully',
      message: `You have been checked in for ${booking.event.title}.`,
      link: `event-details.html?id=${booking.event.id}`
    });

    res.json({ message: 'Check-in successful.', booking });
  } catch (err) {
    res.status(500).json({ message: 'Server error during check-in.', error: err.message });
  }
});

module.exports = router;
