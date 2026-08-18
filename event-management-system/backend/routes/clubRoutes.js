const express = require('express');
const Club = require('../models/Club');
const User = require('../models/User');
const Event = require('../models/Event');
const Category = require('../models/Category');
const Opportunity = require('../models/Opportunity');
const Application = require('../models/Application');
const Announcement = require('../models/Announcement');
const ClubRequest = require('../models/ClubRequest');
const Notification = require('../models/Notification');
const { protect, adminOnly, clubHeadOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// Helper to format club output for student views
function formatClubSummary(club, userId = null) {
  const c = club.toObject ? club.toObject() : club;
  const followerCount = (c.followerIds || []).length;
  const memberCount = (c.memberIds || []).length;
  const isFollowing = userId ? (c.followerIds || []).map(String).includes(String(userId)) : false;
  const isMember = userId ? (c.memberIds || []).map(String).includes(String(userId)) : false;

  return {
    id: String(c.id || c._id || ''),
    _id: String(c.id || c._id || ''),
    name: c.name,
    slug: c.slug,
    shortName: c.shortName,
    description: c.description,
    category: c.category,
    department: c.department,
    logoUrl: c.logoUrl,
    coverImage: c.coverImage,
    contactEmail: c.contactEmail,
    socialLinks: c.socialLinks || {},
    status: c.status,
    followerCount,
    memberCount,
    isFollowing,
    isMember,
    upcomingEventsCount: c.upcomingEventsCount || 0,
    pastEventsCount: c.pastEventsCount || 0,
    activeRecruitmentsCount: c.activeRecruitmentsCount || 0
  };
}

// -------------------------------------------------------------
// PUBLIC / STUDENT ROUTES
// -------------------------------------------------------------

// Get all active clubs (supports category filter & search)
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let filter = { status: 'active' };

    if (category && category !== 'All') {
      filter.category = category;
    }
    if (search) {
      const regex = new RegExp(String(search).trim(), 'i');
      filter.$or = [{ name: regex }, { description: regex }, { department: regex }, { shortName: regex }];
    }

    const clubs = await Club.find(filter).sort({ name: 1 });

    // Count upcoming & past events for each club
    const nowStr = new Date().toISOString().split('T')[0];

    const clubSummaries = await Promise.all(
      clubs.map(async (club) => {
        const upcomingCount = await Event.countDocuments({
          club: club._id,
          status: 'published',
          date: { $gte: nowStr }
        });
        const pastCount = await Event.countDocuments({
          club: club._id,
          status: 'published',
          date: { $lt: nowStr }
        });
        const activeRecruitmentCount = await Opportunity.countDocuments({
          club: club._id,
          status: 'open'
        });

        const cObj = club.toObject();
        cObj.upcomingEventsCount = upcomingCount;
        cObj.pastEventsCount = pastCount;
        cObj.activeRecruitmentsCount = activeRecruitmentCount;

        return formatClubSummary(cObj, req.headers.authorization ? extractUserIdFromHeader(req.headers.authorization) : null);
      })
    );

    res.json({ clubs: clubSummaries });
  } catch (err) {
    console.error('FETCH CLUBS ERROR:', err);
    res.status(500).json({ message: 'Could not fetch clubs.' });
  }
});

function extractUserIdFromHeader(authHeader) {
  try {
    const { verifyToken } = require('../utils/auth');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      return decoded ? decoded.id : null;
    }
  } catch (e) {
    return null;
  }
  return null;
}

// Consolidated public recruitment feed.
router.get('/opportunities', async (req, res) => {
  try {
    const opportunities = await Opportunity.find({ status: 'open' })
      .populate('club', 'name category logoUrl status')
      .sort({ createdAt: -1 });
    res.json({ opportunities: opportunities.filter((item) => item.club && item.club.status === 'active') });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch club opportunities.' });
  }
});

// Announcements are intentionally limited to clubs the student follows.
router.get('/announcements', protect, async (req, res) => {
  try {
    const clubs = await Club.find({ status: 'active', followerIds: req.user.id }).select('_id');
    const clubIds = clubs.map((club) => club._id);
    const announcements = await Announcement.find({ club: { $in: clubIds } })
      .populate('club', 'name logoUrl category')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ announcements });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch followed-club announcements.' });
  }
});

// Get Club Details by ID or Slug
router.get('/:idOrSlug', async (req, res) => {
  try {
    const param = req.params.idOrSlug;
    let club = null;

    if (param.match(/^[0-9a-fA-F]{24}$/)) {
      club = await Club.findById(param);
    }
    if (!club) {
      club = await Club.findOne({ slug: param });
    }

    if (!club || club.status !== 'active') {
      return res.status(404).json({ message: 'Club not found or inactive.' });
    }

    const userId = req.headers.authorization ? extractUserIdFromHeader(req.headers.authorization) : null;
    const nowStr = new Date().toISOString().split('T')[0];

    // Fetch upcoming events, past events, announcements, active opportunities
    const upcomingEvents = await Event.find({ club: club._id, status: 'published', date: { $gte: nowStr } }).sort({ date: 1 });
    const pastEvents = await Event.find({ club: club._id, status: 'published', date: { $lt: nowStr } }).sort({ date: -1 });
    const announcements = await Announcement.find({ club: club._id }).sort({ createdAt: -1 });
    const opportunities = await Opportunity.find({ club: club._id, status: 'open' }).sort({ createdAt: -1 });
    const configuredHeadIds = Array.isArray(club.clubHeads) ? club.clubHeads.map((id) => String(id)) : [];
    const clubHeads = await User.find({
      $or: [
        { _id: { $in: configuredHeadIds } },
        { clubId: club._id, role: 'club_head' }
      ],
      status: 'active'
    }).select('name email avatarUrl department year role').lean();
    const uniqueClubHeads = Array.from(
      new Map(clubHeads.map((head) => [String(head._id), head])).values()
    );
    const members = await User.find({ _id: { $in: club.memberIds || [] }, status: 'active' })
      .select('name email avatarUrl department year role');

    const cObj = club.toObject();
    cObj.upcomingEventsCount = upcomingEvents.length;
    cObj.pastEventsCount = pastEvents.length;
    cObj.activeRecruitmentsCount = opportunities.length;

    res.json({
      club: formatClubSummary(cObj, userId),
      upcomingEvents,
      pastEvents,
      announcements,
      opportunities,
      clubHeads: uniqueClubHeads,
      members
    });
  } catch (err) {
    console.error('FETCH CLUB DETAILS ERROR:', err);
    res.status(500).json({ message: 'Could not fetch club details.' });
  }
});

// Follow / Unfollow club
router.post('/:id/follow', protect, async (req, res) => {
  try {
    const clubId = String(req.params.id || '').trim();
    if (!/^[0-9a-fA-F]{24}$/.test(clubId)) {
      return res.status(400).json({ message: 'Invalid club ID. Please refresh the Clubs page and try again.' });
    }
    const club = await Club.findById(clubId);
    if (!club || club.status !== 'active') {
      return res.status(404).json({ message: 'Club not found.' });
    }

    const userId = String(req.user.id || '');
    if (!userId) {
      return res.status(401).json({ message: 'Your session is missing a user ID. Please sign in again.' });
    }

    // Older EventHub club records may have followerIds missing/null. Normalize
    // the field on the document before saving so follow never fails on legacy data.
    if (!Array.isArray(club.followerIds)) club.followerIds = [];

    const existingIndex = club.followerIds.findIndex((id) => String(id) === userId);
    const isFollowing = existingIndex !== -1;

    if (isFollowing) {
      club.followerIds.splice(existingIndex, 1);
    } else {
      club.followerIds.push(userId);
    }

    await club.save();

    const nowFollowing = !isFollowing;
    res.json({
      isFollowing: nowFollowing,
      followerCount: club.followerIds.length,
      message: nowFollowing ? `You are now following ${club.name}.` : `Unfollowed ${club.name}.`
    });
  } catch (err) {
    console.error('TOGGLE CLUB FOLLOW ERROR:', err);
    res.status(500).json({ message: 'Could not update follow status.' });
  }
});

// Request a new club creation (Student request)
router.post('/request-new', protect, async (req, res) => {
  try {
    const proposedName = String(req.body.proposedName || req.body.name || '').trim();
    const category = String(req.body.category || 'Other').trim();
    const department = String(req.body.department || 'General / Open').trim();
    const description = String(req.body.description || '').trim();

    if (!proposedName || !description) {
      return res.status(400).json({ message: 'Proposed club name and description are required.' });
    }

    const clubRequest = await ClubRequest.create({
      requestedBy: req.user.id,
      proposedName,
      category,
      department,
      description,
      purpose: String(req.body.purpose || '').trim(),
      whyExist: String(req.body.whyExist || '').trim(),
      proposedFacultyCoordinator: String(req.body.proposedFacultyCoordinator || '').trim(),
      additionalInfo: String(req.body.additionalInfo || '').trim(),
      status: 'pending'
    });

    // Notify College Admins
    const admins = await User.find({ role: 'admin', status: 'active' }).select('_id');
    if (admins.length > 0) {
      await Notification.insertMany(
        admins.map((a) => ({
          user: a._id,
          type: 'club',
          title: 'New Club Request',
          message: `${req.user.name} requested a new club: "${proposedName}".`,
          link: '/admin/clubs.html'
        }))
      );
    }

    res.status(201).json({
      message: 'Club request submitted successfully. College Admin will review your request.',
      clubRequest
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not submit club request.' });
  }
});

// -------------------------------------------------------------
// STUDENT OPPORTUNITY / APPLICATION ROUTES
// -------------------------------------------------------------

// Submit Application for Recruitment Opportunity
router.post('/opportunities/:opportunityId/apply', protect, async (req, res) => {
  try {
    const opportunity = await Opportunity.findById(req.params.opportunityId).populate('club');
    if (!opportunity || opportunity.status !== 'open') {
      return res.status(400).json({ message: 'This recruitment opportunity is not accepting applications.' });
    }

    // Check existing application
    const existing = await Application.findOne({
      opportunity: opportunity._id,
      student: req.user.id
    });
    if (existing) {
      return res.status(409).json({ message: 'You have already submitted an application for this opportunity.' });
    }

    const name = String(req.body.name || req.user.name || '').trim();
    const email = String(req.body.email || req.user.email || '').trim();
    const department = String(req.body.department || req.user.department || '').trim();
    const year = String(req.body.year || req.user.year || '').trim();

    if (!department || !year) {
      return res.status(400).json({ message: 'Department and Year are required.' });
    }

    const skills = Array.isArray(req.body.skills) ? req.body.skills : String(req.body.skills || '').split(',').map((s) => s.trim()).filter(Boolean);
    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    const answerMap = new Map(answers.map((a) => [String(a.question || '').trim(), String(a.answer || '').trim()]));
    const missingQuestions = (opportunity.customQuestions || []).filter((q) => q.required && !answerMap.get(q.question));
    if (missingQuestions.length) return res.status(400).json({ message: 'Please answer all required application questions.' });
    if (opportunity.resumeRequired && !String(req.body.resumeUrl || '').trim()) return res.status(400).json({ message: 'A resume is required for this opportunity.' });
    if (opportunity.portfolioRequired && !String(req.body.portfolioUrl || '').trim()) return res.status(400).json({ message: 'A portfolio is required for this opportunity.' });
    if (opportunity.departments.length && !opportunity.departments.includes(department)) return res.status(403).json({ message: 'You are not eligible by department for this opportunity.' });
    if (opportunity.years.length && !opportunity.years.includes(year)) return res.status(403).json({ message: 'You are not eligible by year for this opportunity.' });

    const application = await Application.create({
      opportunity: opportunity._id,
      club: opportunity.club._id,
      student: req.user.id,
      name,
      email,
      department,
      year,
      skills,
      experience: String(req.body.experience || '').trim(),
      answers,
      githubUrl: String(req.body.githubUrl || '').trim(),
      portfolioUrl: String(req.body.portfolioUrl || '').trim(),
      resumeUrl: String(req.body.resumeUrl || '').trim(),
      status: 'pending'
    });

    // Notify Club Heads of this assigned club
    const clubObj = await Club.findById(opportunity.club._id);
    if (clubObj && clubObj.clubHeads && clubObj.clubHeads.length > 0) {
      await Notification.insertMany(
        clubObj.clubHeads.map((chId) => ({
          user: chId,
          type: 'recruitment',
          title: 'New Recruitment Application',
          message: `${name} applied for "${opportunity.title}".`,
          link: `/organizer/club-dashboard.html#applications`
        }))
      );
    }

    res.status(201).json({
      message: 'Application submitted successfully!',
      application
    });
  } catch (err) {
    console.error('SUBMIT APPLICATION ERROR:', err);
    res.status(500).json({ message: 'Could not submit application.' });
  }
});

module.exports = router;
