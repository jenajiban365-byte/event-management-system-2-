const express = require('express');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const Group = require('../models/Group');
const Club = require('../models/Club');
const SavedEvent = require('../models/SavedEvent');
const EventStory = require('../models/EventStory');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    avatarUrl: u.avatarUrl || '',
    chatAvatarUrl: u.chatAvatarUrl || '',
    chatAvatarId: u.chatAvatarId || '',
    department: u.department || '',
    year: u.year || '',
    role: u.role || 'user',
    campusConnectOptIn: u.campusConnectOptIn !== false
  };
}



router.get('/campus-pulse', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [bookings, saved, groups] = await Promise.all([
      Booking.find({ user: req.user.id, status: { $in: ['confirmed','pending'] } }).populate('event','category title').lean(),
      SavedEvent.find({ user: req.user.id }).populate('event','category title').lean(),
      Group.find({ members: req.user.id, status: 'active' }).select('club').lean()
    ]);
    const categoryWeights = {};
    [...bookings.map(x=>x.event), ...saved.map(x=>x.event)].filter(Boolean).forEach(e => { categoryWeights[e.category] = (categoryWeights[e.category] || 0) + 1; });
    const preferred = Object.entries(categoryWeights).sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,3);
    const upcoming = await Event.find({ status:'published', date:{ $gte:today } }).sort({ date:1, time:1 }).limit(60).populate('club','name logoUrl category').lean();
    const scored = upcoming.map(e => ({ ...e, recommendationScore: (preferred.includes(e.category) ? 5 : 0) + Math.min(3, Number(e.bookedCount||0)/Math.max(1,Number(e.capacity||1))*3) + (e.date===today ? 4 : 0) }));
    scored.sort((a,b)=>b.recommendationScore-a.recommendationScore || String(a.date).localeCompare(String(b.date)));
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate()+7); const weekEndStr = weekEnd.toISOString().slice(0,10);
    const myEventIds = new Set([...bookings.map(b=>b.event?._id), ...saved.map(x=>x.event?._id)].filter(Boolean).map(String));
    const myWeek = upcoming.filter(e => myEventIds.has(String(e._id)) && e.date <= weekEndStr).sort((a,b)=>String(a.date).localeCompare(String(b.date)) || String(a.time||'').localeCompare(String(b.time||''))).slice(0,10);
    const happening = upcoming.filter(e => {
      if(e.date !== today) return false;
      const [sh,sm] = String(e.time||'00:00').split(':').map(Number);
      const [eh,em] = String(e.endTime||e.time||'23:59').split(':').map(Number);
      const now = new Date(); const start = new Date(); start.setHours(sh||0,sm||0,0,0); const end = new Date(); end.setHours(eh||23,em||59,59,999);
      return now >= start && now <= end;
    }).slice(0,10);
    const clubs = await Club.find({ status:'active' }).select('name shortName logoUrl category followerIds').lean();
    const clubIds = groups.map(g=>String(g.club));
    const clubPulse = clubs.map(c => ({ id:c._id, name:c.name, shortName:c.shortName, logoUrl:c.logoUrl||'', category:c.category||'', following:clubIds.includes(String(c._id)), followers:Array.isArray(c.followerIds)?c.followerIds.length:0 })).sort((a,b)=>Number(b.following)-Number(a.following) || b.followers-a.followers).slice(0,8);
    const candidateIds = new Set();
    bookings.forEach(b=>{ if(b.event?.id) candidateIds.add(String(b.event.id)); });
    const attendeeEvents = upcoming.filter(e=>candidateIds.has(String(e._id))).map(e=>e.id);
    const people = await Booking.find({ event: { $in: attendeeEvents }, status:{ $in:['confirmed','pending'] }, user:{ $ne:req.user.id } }).populate('user','name avatarUrl chatAvatarUrl chatAvatarId department year status campusConnectOptIn eventBuddyOptIn').limit(30).lean();
    const peopleSeen = new Set(); const discoverPeople=[];
    for(const b of people){ const u=b.user; if(!u || u.status==='blocked' || u.campusConnectOptIn===false || peopleSeen.has(String(u._id))) continue; peopleSeen.add(String(u._id)); discoverPeople.push(publicUser(u)); }
    res.json({ preferredCategories:preferred, forYou:scored.slice(0,8), myWeek, happeningNow:happening, clubPulse, peopleYouMayKnow:discoverPeople.slice(0,8) });
  } catch(err){ console.error('CAMPUS PULSE ERROR:',err); res.status(500).json({message:'Could not load campus pulse.'}); }
});

router.get('/events/:eventId/stories', async (req,res)=>{
  try {
    const event=await Event.findOne({_id:req.params.eventId,status:'published'}).select('title');
    if(!event) return res.status(404).json({message:'Event not found.'});
    const stories=await EventStory.find({event:event._id}).sort({createdAt:-1}).limit(40).populate('author','name avatarUrl chatAvatarUrl chatAvatarId department year').lean();
    res.json({event,stories});
  }catch(err){res.status(500).json({message:'Could not load event moments.'});}
});

router.post('/events/:eventId/stories', async (req,res)=>{
  try {
    const event=await Event.findOne({_id:req.params.eventId,status:'published'}).select('title');
    if(!event) return res.status(404).json({message:'Event not found.'});
    const booking=await Booking.findOne({event:event._id,user:req.user.id,status:{ $in:['confirmed','pending'] }});
    if(!booking) return res.status(403).json({message:'Register for the event before sharing a moment.'});
    const caption=String(req.body.caption||'').trim().slice(0,280);
    const mediaUrl=String(req.body.mediaUrl||'').trim();
    const mediaType=mediaUrl ? (String(req.body.mediaType||'image')==='file'?'file':'image') : 'none';
    if(!caption && !mediaUrl) return res.status(400).json({message:'Add a photo or a short caption first.'});
    const story=await EventStory.create({event:event._id,author:req.user.id,caption,mediaUrl,mediaType});
    await story.populate('author','name avatarUrl chatAvatarUrl chatAvatarId department year');
    res.status(201).json({story});
  }catch(err){res.status(500).json({message:'Could not share this moment.'});}
});

router.get('/events/:eventId/buddies', async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId).select('title date club');
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    const mine = await Booking.findOne({ event: event._id, user: req.user.id, status: { $in: ['confirmed', 'pending'] } });
    if (!mine) return res.status(403).json({ message: 'Register for this event to discover your event buddies.' });

    const bookings = await Booking.find({ event: event._id, status: { $in: ['confirmed', 'pending'] }, user: { $ne: req.user.id } })
      .populate('user', 'name avatarUrl chatAvatarUrl chatAvatarId department year role status eventBuddyOptIn campusConnectOptIn')
      .lean();
    const visible = bookings.filter(b => b.user && b.user.status !== 'blocked' && b.user.eventBuddyOptIn === true && b.user.campusConnectOptIn !== false);
    const me = await User.findById(req.user.id).select('department year');
    const clubIds = await Club.find({ followerIds: req.user.id }).select('_id').lean();
    const myClubSet = new Set(clubIds.map(c => String(c._id)));
    const myGroups = await Group.find({ members: req.user.id, status: 'active' }).select('club').lean();
    myGroups.forEach(g => myClubSet.add(String(g.club)));

    const result = [];
    for (const b of visible) {
      const u = b.user;
      const sharedGroupClubs = await Group.find({ status: 'active', members: { $all: [req.user.id, u._id] } }).populate('club', 'name').select('name club').lean();
      const sameDepartment = !!me?.department && !!u.department && me.department.toLowerCase() === u.department.toLowerCase();
      const sameYear = !!me?.year && !!u.year && me.year === u.year;
      result.push({
        user: publicUser(u),
        sameDepartment,
        sameYear,
        sharedGroups: sharedGroupClubs.map(g => ({ id: g._id, name: g.club?.name || g.name })),
        connectionHint: sameDepartment && sameYear ? 'Same department & year' : sameDepartment ? 'Same department' : sameYear ? 'Same year' : 'Also attending'
      });
    }
    result.sort((a,b) => (Number(b.sameDepartment)+Number(b.sameYear)+b.sharedGroups.length) - (Number(a.sameDepartment)+Number(a.sameYear)+a.sharedGroups.length));
    res.json({ event: { id: event.id, title: event.title, date: event.date }, totalVisible: result.length, buddies: result.slice(0, 40) });
  } catch (err) {
    console.error('EVENT BUDDIES ERROR:', err);
    res.status(500).json({ message: 'Could not load event buddies.' });
  }
});

router.get('/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('name avatarUrl chatAvatarUrl chatAvatarId department year role status campusConnectOptIn');
    if (!user || user.status === 'blocked' || user.campusConnectOptIn === false) return res.status(404).json({ message: 'Profile not available.' });
    const shared = await Group.find({ status: 'active', members: { $all: [req.user.id, user._id] } }).populate('club', 'name category logoUrl').select('name club').lean();
    res.json({ user: publicUser(user), sharedGroups: shared.map(g => ({ id: g._id, name: g.club?.name || g.name, category: g.club?.category || '' })) });
  } catch (err) { res.status(500).json({ message: 'Could not load profile.' }); }
});

router.get('/users/:userId/shared-groups', async (req, res) => {
  try {
    const target = await User.findById(req.params.userId).select('_id campusConnectOptIn status');
    if (!target || target.status === 'blocked' || target.campusConnectOptIn === false) return res.status(404).json({ message: 'Profile not available.' });
    const groups = await Group.find({ status: 'active', members: { $all: [req.user.id, target._id] } }).populate('club', 'name category logoUrl').lean();
    res.json({ groups: groups.map(g => ({ id: g.id, name: g.club?.name || g.name, category: g.club?.category || '', logoUrl: g.club?.logoUrl || '' })) });
  } catch (err) { res.status(500).json({ message: 'Could not load shared groups.' }); }
});

module.exports = router;
