const express = require('express');
const Event = require('../models/Event');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Club = require('../models/Club');
const Category = require('../models/Category');
const ClubRequest = require('../models/ClubRequest');
const Notification = require('../models/Notification');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// ADMIN DASHBOARD ANALYTICS
router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const start = new Date(); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - 13);

    const [
      totalEvents,
      upcomingEvents,
      totalStudents,
      totalOrganizers,
      totalClubHeads,
      totalClubs,
      pendingClubRequests,
      pendingEvents,
      totalBookings,
      recentBookingsRaw,
      trendRaw
    ] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ date: { $gte: today }, status: 'published' }),
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'organizer' }),
      User.countDocuments({ role: 'club_head' }),
      Club.countDocuments({ status: 'active' }),
      ClubRequest.countDocuments({ status: 'pending' }),
      Event.countDocuments({ status: 'pending_approval' }),
      Booking.countDocuments(),
      Booking.find().populate('user', 'name email').populate('event', 'title').sort({ createdAt: -1 }).limit(5),
      Booking.aggregate([
        { $match: { createdAt: { $gte: start } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
    ]);

    const trendMap = new Map(trendRaw.map((item) => [item._id, item.count]));
    const bookingTrend = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(start); d.setUTCDate(start.getUTCDate() + i);
      const date = d.toISOString().slice(0, 10);
      bookingTrend.push({ date, count: trendMap.get(date) || 0 });
    }

    const recentBookings = recentBookingsRaw.map((b) => ({
      id: b.id,
      status: b.status,
      createdAt: b.createdAt,
      userName: b.user ? b.user.name : 'Unknown',
      eventTitle: b.event ? b.event.title : 'Unknown'
    }));

    res.json({
      totals: {
        totalEvents,
        upcomingEvents,
        totalStudents,
        totalOrganizers,
        totalClubHeads,
        totalClubs,
        pendingClubRequests,
        pendingEvents,
        totalBookings,
        totalUsers: totalStudents + totalOrganizers + totalClubHeads,
        activeBookings: totalBookings
      },
      recentBookings,
      bookingTrend
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching dashboard stats.', error: err.message });
  }
});

// -------------------------------------------------------------
// CLUB MANAGEMENT
// -------------------------------------------------------------

// Get all clubs
router.get('/clubs', protect, adminOnly, async (req, res) => {
  try {
    const clubs = await Club.find()
      .populate('clubHeads', 'name email department year')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ clubs });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching clubs.' });
  }
});

// Create new club directly
router.post('/clubs', protect, adminOnly, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const category = String(req.body.category || 'Coding & Technology').trim();
    const description = String(req.body.description || '').trim();

    if (!name || !category) {
      return res.status(400).json({ message: 'Club name and category are required.' });
    }

    const slug = req.body.slug
      ? String(req.body.slug).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const existing = await Club.findOne({ $or: [{ name }, { slug }] });
    if (existing) {
      return res.status(409).json({ message: 'A club with this name or slug already exists.' });
    }

    const club = await Club.create({
      name,
      slug,
      shortName: String(req.body.shortName || '').trim(),
      description,
      category,
      department: String(req.body.department || 'General / Open').trim(),
      logoUrl: String(req.body.logoUrl || '').trim(),
      coverImage: String(req.body.coverImage || '').trim(),
      contactEmail: String(req.body.contactEmail || '').trim(),
      socialLinks: req.body.socialLinks || {},
      status: 'active',
      createdBy: req.user.id
    });

    // If initial club head email or userId is provided during creation
    if (req.body.clubHeadUser) {
      const userToAssign = await User.findOne({
        $or: [{ _id: req.body.clubHeadUser }, { email: String(req.body.clubHeadUser).toLowerCase() }]
      });
      if (userToAssign) {
        userToAssign.role = 'club_head';
        userToAssign.clubId = club._id;
        await userToAssign.save();
        club.clubHeads.push(userToAssign._id);
        await club.save();
      }
    }

    res.status(201).json({ message: 'Club created successfully.', club });
  } catch (err) {
    console.error('CREATE CLUB ERROR:', err);
    res.status(500).json({ message: 'Could not create club.' });
  }
});

// Update club
router.put('/clubs/:id', protect, adminOnly, async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: 'Club not found.' });

    if (req.body.name) club.name = String(req.body.name).trim();
    if (req.body.shortName !== undefined) club.shortName = String(req.body.shortName).trim();
    if (req.body.description !== undefined) club.description = String(req.body.description).trim();
    if (req.body.category) club.category = String(req.body.category).trim();
    if (req.body.department !== undefined) club.department = String(req.body.department).trim();
    if (req.body.logoUrl !== undefined) club.logoUrl = String(req.body.logoUrl).trim();
    if (req.body.coverImage !== undefined) club.coverImage = String(req.body.coverImage).trim();
    if (req.body.contactEmail !== undefined) club.contactEmail = String(req.body.contactEmail).trim();
    if (req.body.status && ['active', 'inactive', 'blocked'].includes(req.body.status)) {
      club.status = req.body.status;
    }
    if (req.body.socialLinks && typeof req.body.socialLinks === 'object') {
      club.socialLinks = req.body.socialLinks;
    }

    await club.save();
    res.json({ message: 'Club updated successfully.', club });
  } catch (err) {
    res.status(500).json({ message: 'Could not update club.' });
  }
});

// Assign Club Head
router.post('/clubs/:id/assign-head', protect, adminOnly, async (req, res) => {
  try {
    const { userEmail, userId } = req.body;
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: 'Club not found.' });

    let user = null;
    if (userId) {
      user = await User.findById(userId);
    } else if (userEmail) {
      user = await User.findOne({ email: String(userEmail).trim().toLowerCase() });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found. Ensure the student/organizer account exists first.' });
    }
    if (user.role === 'admin') return res.status(400).json({ message: 'A College Admin cannot be assigned as Club Head.' });

    if (user.clubId && String(user.clubId) !== String(club._id)) {
      await Club.findByIdAndUpdate(user.clubId, { $pull: { clubHeads: user._id } });
    }
    user.role = 'club_head';
    user.clubId = club._id;
    await user.save();

    const headIdx = club.clubHeads.findIndex((id) => String(id) === String(user._id));
    if (headIdx < 0) {
      club.clubHeads.push(user._id);
      await club.save();
    }

    // Notify user
    await Notification.create({
      user: user._id,
      type: 'club',
      title: 'Assigned as Club Head! 👑',
      message: `You have been appointed as Club Head for "${club.name}". Access your dashboard now.`,
      link: '/organizer/club-dashboard.html'
    });

    res.json({ message: `${user.name} assigned as Club Head for ${club.name}.`, club, user });
  } catch (err) {
    console.error('ASSIGN HEAD ERROR:', err);
    res.status(500).json({ message: 'Could not assign Club Head.' });
  }
});

// Remove Club Head
router.post('/clubs/:id/remove-head', protect, adminOnly, async (req, res) => {
  try {
    const { userId } = req.body;
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: 'Club not found.' });

    const user = await User.findById(userId);
    if (user) {
      if (user.role === 'club_head') user.role = 'user';
      user.clubId = null;
      await user.save();
    }

    club.clubHeads = club.clubHeads.filter((id) => String(id) !== String(userId));
    await club.save();

    res.json({ message: 'Club Head removed.', club });
  } catch (err) {
    res.status(500).json({ message: 'Could not remove Club Head.' });
  }
});

// -------------------------------------------------------------
// CLUB REQUESTS
// -------------------------------------------------------------

router.get('/club-requests', protect, adminOnly, async (req, res) => {
  try {
    const requests = await ClubRequest.find()
      .populate('requestedBy', 'name email studentId department year')
      .sort({ createdAt: -1 });
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch club requests.' });
  }
});

router.put('/club-requests/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const clubReq = await ClubRequest.findById(req.params.id).populate('requestedBy');
    if (!clubReq || clubReq.status !== 'pending') {
      return res.status(400).json({ message: 'Club request not found or already processed.' });
    }

    const slug = clubReq.proposedName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let club = await Club.findOne({ name: clubReq.proposedName });

    if (!club) {
      club = await Club.create({
        name: clubReq.proposedName,
        slug,
        description: clubReq.description,
        category: clubReq.category,
        department: clubReq.department,
        status: 'active',
        contactEmail: clubReq.requestedBy ? clubReq.requestedBy.email : '',
        createdBy: clubReq.requestedBy ? clubReq.requestedBy._id : req.user.id
      });
    } else {
      club.status = 'active';
      await club.save();
    }

    // IMPORTANT: approving a club request does NOT automatically appoint the requester as Club Head.
    // College Admin assigns Club Heads separately via /clubs/:id/assign-head.

    clubReq.status = 'approved';
    await clubReq.save();

    // NOTIFICATION RULE: Notify Requester
    if (clubReq.requestedBy) {
      await Notification.create({
        user: clubReq.requestedBy._id,
        type: 'club',
        title: 'Club Creation Approved! 🎉',
        message: `Your proposed club "${club.name}" has been approved by College Admin!`,
        link: '/organizer/club-dashboard.html'
      });
    }

    res.json({ message: `Club "${club.name}" approved and activated!`, club });
  } catch (err) {
    console.error('APPROVE CLUB REQUEST ERROR:', err);
    res.status(500).json({ message: 'Could not approve club request.' });
  }
});

router.put('/club-requests/:id/reject', protect, adminOnly, async (req, res) => {
  try {
    const clubReq = await ClubRequest.findById(req.params.id);
    if (!clubReq) return res.status(404).json({ message: 'Club request not found.' });

    clubReq.status = 'rejected';
    clubReq.adminNote = String(req.body.adminNote || '').trim();
    await clubReq.save();

    if (clubReq.requestedBy) {
      await Notification.create({
        user: clubReq.requestedBy,
        type: 'club',
        title: 'Club Request Update',
        message: `Your request for club "${clubReq.proposedName}" was not approved. Note: ${clubReq.adminNote || 'Does not fit requirements.'}`,
        link: '/clubs.html'
      });
    }

    res.json({ message: 'Club request rejected.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not reject club request.' });
  }
});

// -------------------------------------------------------------
// EVENT APPROVALS & USER MANAGEMENT
// -------------------------------------------------------------

router.get('/pending-events', protect, adminOnly, async (req, res) => {
  try {
    const events = await Event.find({ status: 'pending_approval' })
      .populate('club', 'name')
      .populate('organizer', 'name email')
      .sort({ createdAt: -1 });
    res.json({ events });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching pending events.' });
  }
});

router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const { role, search } = req.query;
    let filter = {};
    if (role) filter.role = role;
    if (search) {
      const regex = new RegExp(String(search).trim(), 'i');
      filter.$or = [{ name: regex }, { email: regex }, { studentId: regex }, { department: regex }];
    }

    const users = await User.find(filter).populate('clubId', 'name').sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users.' });
  }
});

router.put('/users/:id/role', protect, adminOnly, async (req, res) => {
  try {
    const { role, clubId } = req.body;
    if (!['user', 'organizer', 'club_head', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (role === 'club_head' && !clubId) return res.status(400).json({ message: 'clubId is required when assigning Club Head role.' });
    if (role === 'club_head') {
      if (user.clubId && String(user.clubId) !== String(clubId)) await Club.findByIdAndUpdate(user.clubId, { $pull: { clubHeads: user._id } });
      const club = await Club.findById(clubId);
      if (!club) return res.status(404).json({ message: 'Club not found.' });
      user.role = 'club_head';
      user.clubId = clubId;
      await Club.findByIdAndUpdate(clubId, { $addToSet: { clubHeads: user._id } });
    } else {
      if (user.clubId) await Club.findByIdAndUpdate(user.clubId, { $pull: { clubHeads: user._id } });
      user.role = role;
      user.clubId = null;
    }

    await user.save();
    res.json({ message: 'User role updated successfully.', user });
  } catch (err) {
    res.status(500).json({ message: 'Could not update user role.' });
  }
});

module.exports = router;
