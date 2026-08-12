const express = require('express');
const Club = require('../models/Club');
const User = require('../models/User');
const Event = require('../models/Event');
const Opportunity = require('../models/Opportunity');
const Application = require('../models/Application');
const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const { protect, clubHeadOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// Middleware to ensure user is assigned to the club or is admin
async function checkAssignedClub(req, res, next) {
  if (req.user.role === 'admin') {
    const clubId = req.query.clubId || req.body.clubId || req.headers['x-club-id'];
    if (!clubId) return res.status(400).json({ message: 'Admin must specify a clubId.' });
    const club = await Club.findById(clubId);
    if (club) { req.assignedClub = club; return next(); }
    return res.status(404).json({ message: 'Club not found.' });
  }

  if (req.user.role !== 'club_head' || !req.user.clubId) {
    return res.status(403).json({ message: 'Access denied. You are not assigned as a Club Head for any club.' });
  }

  const club = await Club.findById(req.user.clubId);
  if (!club) {
    return res.status(404).json({ message: 'Assigned club not found or deactivated.' });
  }

  req.assignedClub = club;
  next();
}

// All routes in clubHeadRoutes require authentication and club_head / admin role
router.use(protect, clubHeadOnly, checkAssignedClub);

// -------------------------------------------------------------
// MY CLUB DASHBOARD & PROFILE
// -------------------------------------------------------------

router.get('/my-club', async (req, res) => {
  try {
    const club = req.assignedClub;
    const nowStr = new Date().toISOString().split('T')[0];

    const followerCount = (club.followerIds || []).length;
    const memberCount = (club.memberIds || []).length;

    const upcomingEvents = await Event.find({ club: club._id, date: { $gte: nowStr } }).sort({ date: 1 });
    const pastEvents = await Event.find({ club: club._id, date: { $lt: nowStr } }).sort({ date: -1 });
    const announcements = await Announcement.find({ club: club._id }).sort({ createdAt: -1 });
    const opportunities = await Opportunity.find({ club: club._id }).sort({ createdAt: -1 });
    const pendingApplicationsCount = await Application.countDocuments({ club: club._id, status: 'pending' });

    // Populate club heads info
    const clubHeadsInfo = await User.find({ _id: { $in: club.clubHeads } }).select('name email avatarUrl department year');

    res.json({
      club,
      stats: {
        followerCount,
        memberCount,
        upcomingEventsCount: upcomingEvents.length,
        pastEventsCount: pastEvents.length,
        opportunitiesCount: opportunities.length,
        pendingApplicationsCount
      },
      clubHeads: clubHeadsInfo,
      upcomingEvents,
      pastEvents,
      announcements,
      opportunities
    });
  } catch (err) {
    console.error('GET MY CLUB ERROR:', err);
    res.status(500).json({ message: 'Could not fetch club dashboard.' });
  }
});

// Edit assigned club profile
router.put('/my-club', async (req, res) => {
  try {
    const club = req.assignedClub;

    if (req.body.description !== undefined) club.description = String(req.body.description).trim();
    if (req.body.category !== undefined) club.category = String(req.body.category).trim();
    if (req.body.department !== undefined) club.department = String(req.body.department).trim();
    if (req.body.logoUrl !== undefined) club.logoUrl = String(req.body.logoUrl).trim();
    if (req.body.coverImage !== undefined) club.coverImage = String(req.body.coverImage).trim();
    if (req.body.contactEmail !== undefined) club.contactEmail = String(req.body.contactEmail).trim();

    if (req.body.socialLinks && typeof req.body.socialLinks === 'object') {
      club.socialLinks = {
        website: String(req.body.socialLinks.website || club.socialLinks?.website || '').trim(),
        instagram: String(req.body.socialLinks.instagram || club.socialLinks?.instagram || '').trim(),
        linkedin: String(req.body.socialLinks.linkedin || club.socialLinks?.linkedin || '').trim(),
        github: String(req.body.socialLinks.github || club.socialLinks?.github || '').trim(),
        twitter: String(req.body.socialLinks.twitter || club.socialLinks?.twitter || '').trim()
      };
    }

    await club.save();
    res.json({ message: 'Club profile updated successfully.', club });
  } catch (err) {
    res.status(500).json({ message: 'Could not update club profile.' });
  }
});

// -------------------------------------------------------------
// RECRUITMENT OPPORTUNITIES
// -------------------------------------------------------------

router.get('/opportunities', async (req, res) => {
  try {
    const opportunities = await Opportunity.find({ club: req.assignedClub._id }).sort({ createdAt: -1 });
    
    // Attach application counts to each opportunity
    const list = await Promise.all(
      opportunities.map(async (opp) => {
        const totalApps = await Application.countDocuments({ opportunity: opp._id });
        const pendingApps = await Application.countDocuments({ opportunity: opp._id, status: 'pending' });
        const acceptedApps = await Application.countDocuments({ opportunity: opp._id, status: 'accepted' });
        return {
          ...opp.toObject(),
          totalApplications: totalApps,
          pendingApplications: pendingApps,
          acceptedApplications: acceptedApps
        };
      })
    );

    res.json({ opportunities: list });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch opportunities.' });
  }
});

router.post('/opportunities', async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required.' });
    }

    const opportunity = await Opportunity.create({
      club: req.assignedClub._id,
      title,
      description,
      requirements: String(req.body.requirements || '').trim(),
      eligibility: String(req.body.eligibility || 'Open to all students').trim(),
      departments: Array.isArray(req.body.departments) ? req.body.departments : [],
      years: Array.isArray(req.body.years) ? req.body.years : [],
      requiredSkills: Array.isArray(req.body.requiredSkills) ? req.body.requiredSkills : [],
      numberOfPositions: Number(req.body.numberOfPositions) || 1,
      openingDate: String(req.body.openingDate || '').trim(),
      closingDate: String(req.body.closingDate || '').trim(),
      customQuestions: Array.isArray(req.body.customQuestions) ? req.body.customQuestions : [],
      resumeRequired: Boolean(req.body.resumeRequired),
      portfolioRequired: Boolean(req.body.portfolioRequired),
      status: ['draft', 'open', 'closed'].includes(req.body.status) ? req.body.status : 'open',
      createdBy: req.user.id
    });

    // NOTIFICATION RULE: "A followed club opened a new recruitment opportunity."
    if (opportunity.status === 'open' && req.assignedClub.followerIds && req.assignedClub.followerIds.length > 0) {
      const followerNotifications = req.assignedClub.followerIds.map((followerId) => ({
        user: followerId,
        type: 'recruitment',
        title: `New Recruitment Opening: ${req.assignedClub.name}`,
        message: `${req.assignedClub.name} opened recruitment for "${opportunity.title}". Apply now!`,
        link: `/clubs.html?id=${req.assignedClub._id}`
      }));
      await Notification.insertMany(followerNotifications);
    }

    res.status(201).json({ message: 'Recruitment opportunity created.', opportunity });
  } catch (err) {
    console.error('CREATE OPPORTUNITY ERROR:', err);
    res.status(500).json({ message: 'Could not create opportunity.' });
  }
});

router.put('/opportunities/:id', async (req, res) => {
  try {
    const opportunity = await Opportunity.findOne({ _id: req.params.id, club: req.assignedClub._id });
    if (!opportunity) return res.status(404).json({ message: 'Opportunity not found.' });

    const wasDraftOrClosed = opportunity.status !== 'open';

    if (req.body.title) opportunity.title = String(req.body.title).trim();
    if (req.body.description) opportunity.description = String(req.body.description).trim();
    if (req.body.requirements !== undefined) opportunity.requirements = String(req.body.requirements).trim();
    if (req.body.eligibility !== undefined) opportunity.eligibility = String(req.body.eligibility).trim();
    if (Array.isArray(req.body.departments)) opportunity.departments = req.body.departments;
    if (Array.isArray(req.body.years)) opportunity.years = req.body.years;
    if (Array.isArray(req.body.requiredSkills)) opportunity.requiredSkills = req.body.requiredSkills;
    if (req.body.numberOfPositions) opportunity.numberOfPositions = Number(req.body.numberOfPositions) || 1;
    if (req.body.openingDate !== undefined) opportunity.openingDate = String(req.body.openingDate).trim();
    if (req.body.closingDate !== undefined) opportunity.closingDate = String(req.body.closingDate).trim();
    if (Array.isArray(req.body.customQuestions)) opportunity.customQuestions = req.body.customQuestions;
    if (req.body.resumeRequired !== undefined) opportunity.resumeRequired = Boolean(req.body.resumeRequired);
    if (req.body.portfolioRequired !== undefined) opportunity.portfolioRequired = Boolean(req.body.portfolioRequired);
    if (req.body.status && ['draft', 'open', 'closed'].includes(req.body.status)) opportunity.status = req.body.status;

    await opportunity.save();

    // If status changed from non-open to open, notify followers
    if (wasDraftOrClosed && opportunity.status === 'open' && req.assignedClub.followerIds && req.assignedClub.followerIds.length > 0) {
      const followerNotifications = req.assignedClub.followerIds.map((followerId) => ({
        user: followerId,
        type: 'recruitment',
        title: `New Recruitment Opening: ${req.assignedClub.name}`,
        message: `${req.assignedClub.name} opened recruitment for "${opportunity.title}". Apply now!`,
        link: `/clubs.html?id=${req.assignedClub._id}`
      }));
      await Notification.insertMany(followerNotifications);
    }

    res.json({ message: 'Opportunity updated successfully.', opportunity });
  } catch (err) {
    res.status(500).json({ message: 'Could not update opportunity.' });
  }
});

router.delete('/opportunities/:id', async (req, res) => {
  try {
    const result = await Opportunity.deleteOne({ _id: req.params.id, club: req.assignedClub._id });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Opportunity not found.' });
    res.json({ message: 'Opportunity deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete opportunity.' });
  }
});

// -------------------------------------------------------------
// APPLICATIONS MANAGEMENT
// -------------------------------------------------------------

router.get('/applications', async (req, res) => {
  try {
    const { opportunityId, status } = req.query;
    let filter = { club: req.assignedClub._id };

    if (opportunityId) filter.opportunity = opportunityId;
    if (status && ['pending', 'accepted', 'rejected'].includes(status)) filter.status = status;

    const applications = await Application.find(filter)
      .populate('opportunity', 'title')
      .populate('student', 'name email avatarUrl studentId department year phone')
      .sort({ createdAt: -1 });

    res.json({ applications });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch applications.' });
  }
});

// Accept or Reject Student Application
router.put('/applications/:id/status', async (req, res) => {
  try {
    const { status } = req.body; // 'accepted' or 'rejected'
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be accepted or rejected.' });
    }

    const application = await Application.findOne({ _id: req.params.id, club: req.assignedClub._id }).populate('opportunity');
    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    application.status = status;
    application.reviewedAt = new Date();
    await application.save();

    const club = req.assignedClub;

    if (status === 'accepted') {
      const acceptedCount = await Application.countDocuments({ opportunity: application.opportunity._id, status: 'accepted', _id: { $ne: application._id } });
      if (acceptedCount >= application.opportunity.numberOfPositions) {
        application.status = 'pending';
        await application.save();
        return res.status(400).json({ message: 'All positions for this opportunity have already been filled.' });
      }
      // Add student to official club members if not already
      const isMember = (club.memberIds || []).map(String).includes(String(application.student));
      if (!isMember) {
        club.memberIds.push(application.student);
        await club.save();
      }

      // NOTIFICATION RULE: "Student's recruitment application was accepted."
      await Notification.create({
        user: application.student,
        type: 'club',
        title: 'Application Accepted! 🎉',
        message: `Congratulations! Your application for "${application.opportunity.title}" at ${club.name} has been accepted. You are now a member!`,
        link: `/clubs.html?id=${club._id}`
      });
    } else if (status === 'rejected') {
      // NOTIFICATION RULE: "Student's recruitment application was rejected."
      await Notification.create({
        user: application.student,
        type: 'club',
        title: 'Application Update',
        message: `Thank you for applying to "${application.opportunity.title}" at ${club.name}. Unfortunately, your application was not selected at this time.`,
        link: `/clubs.html?id=${club._id}`
      });
    }

    res.json({
      message: `Application marked as ${status}.`,
      application
    });
  } catch (err) {
    console.error('UPDATE APPLICATION STATUS ERROR:', err);
    res.status(500).json({ message: 'Could not update application status.' });
  }
});

// -------------------------------------------------------------
// ANNOUNCEMENTS
// -------------------------------------------------------------

router.get('/announcements', async (req, res) => {
  try {
    const announcements = await Announcement.find({ club: req.assignedClub._id }).sort({ createdAt: -1 });
    res.json({ announcements });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch announcements.' });
  }
});

router.post('/announcements', async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const content = String(req.body.content || '').trim();

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required.' });
    }

    const announcement = await Announcement.create({
      club: req.assignedClub._id,
      title,
      content,
      createdBy: req.user.id
    });

    // NOTIFICATION RULE: "A followed club posted an important announcement."
    // Send notification to all followers and members
    const recipientIds = [...new Set([
      ...(req.assignedClub.followerIds || []).map(String),
      ...(req.assignedClub.memberIds || []).map(String)
    ])];

    if (recipientIds.length > 0) {
      const notifs = recipientIds.map((userId) => ({
        user: userId,
        type: 'announcement',
        title: `Announcement from ${req.assignedClub.name}`,
        message: `${title}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
        link: `/clubs.html?id=${req.assignedClub._id}`
      }));
      await Notification.insertMany(notifs);
    }

    res.status(201).json({ message: 'Announcement published successfully.', announcement });
  } catch (err) {
    res.status(500).json({ message: 'Could not create announcement.' });
  }
});

router.delete('/announcements/:id', async (req, res) => {
  try {
    const result = await Announcement.deleteOne({ _id: req.params.id, club: req.assignedClub._id });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Announcement not found.' });
    res.json({ message: 'Announcement deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete announcement.' });
  }
});

// -------------------------------------------------------------
// CLUB EVENTS (Created by Club Head)
// -------------------------------------------------------------

router.get('/events', async (req, res) => {
  try {
    const events = await Event.find({ club: req.assignedClub._id }).sort({ date: -1 });
    res.json({ events });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch club events.' });
  }
});

router.post('/events', async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const date = String(req.body.date || '').trim();
    const time = String(req.body.time || '').trim();
    const location = String(req.body.location || '').trim();
    const capacity = Number(req.body.capacity) || 100;

    if (!title || !description || !date || !time || !location) {
      return res.status(400).json({ message: 'Title, description, date, time, and location are required.' });
    }

    const event = await Event.create({
      title,
      description,
      category: String(req.body.category || req.assignedClub.category || 'Event').trim(),
      date,
      time,
      endTime: String(req.body.endTime || '').trim(),
      location,
      capacity,
      price: Number(req.body.price) || 0,
      imageUrl: String(req.body.imageUrl || '').trim(),
      club: req.assignedClub._id,
      organizer: req.user.id,
      status: 'published',
      publishedAt: new Date()
    });

    // NOTIFICATION RULE: "A followed club created an event."
    const followerIds = (req.assignedClub.followerIds || []).map(String);
    if (followerIds.length > 0) {
      const notifs = followerIds.map((followerId) => ({
        user: followerId,
        type: 'event',
        title: `New Event by ${req.assignedClub.name}`,
        message: `"${title}" is scheduled for ${date} at ${time}. Register now!`,
        link: `/event-details.html?id=${event._id}`
      }));
      await Notification.insertMany(notifs);
    }

    res.status(201).json({ message: 'Club event created successfully.', event });
  } catch (err) {
    console.error('CREATE CLUB EVENT ERROR:', err);
    res.status(500).json({ message: 'Could not create club event.' });
  }
});

// Edit a club event owned by the assigned club
router.put('/events/:id', async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, club: req.assignedClub._id });
    if (!event) return res.status(404).json({ message: 'Club event not found.' });
    ['title','description','category','date','time','endTime','location','imageUrl'].forEach((field)=>{
      if (req.body[field] !== undefined) event[field] = String(req.body[field]).trim();
    });
    if (req.body.capacity !== undefined) event.capacity = Math.max(1, Number(req.body.capacity) || event.capacity);
    if (req.body.price !== undefined) event.price = Math.max(0, Number(req.body.price) || 0);
    if (event.capacity < event.bookedCount) return res.status(400).json({ message: 'Capacity cannot be lower than current bookings.' });
    await event.save();
    res.json({ message: 'Club event updated successfully.', event });
  } catch (err) { res.status(500).json({ message: 'Could not update club event.' }); }
});

router.delete('/events/:id', async (req,res)=>{
  try {
    const event=await Event.findOne({_id:req.params.id,club:req.assignedClub._id});
    if(!event)return res.status(404).json({message:'Club event not found.'});
    await event.deleteOne(); res.json({message:'Club event deleted.'});
  } catch(err){res.status(500).json({message:'Could not delete club event.'});}
});

// MEMBERS LIST
router.get('/members', async (req, res) => {
  try {
    const members = await User.find({ _id: { $in: req.assignedClub.memberIds || [] } })
      .select('name email avatarUrl studentId department year phone createdAt');
    res.json({ members });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch club members.' });
  }
});

module.exports = router;
