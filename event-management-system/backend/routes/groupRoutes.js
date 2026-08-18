const express = require('express');
const Group = require('../models/Group');
const GroupPost = require('../models/GroupPost');
const Club = require('../models/Club');
const User = require('../models/User');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');
const { ensureGroupForClub } = require('../utils/group');

const router = express.Router();
router.use(protect);

function canManageGroup(user, club, group) {
  if (!user || !club || !group) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'club_head' && String(user.clubId || '') === String(club._id)) return true;
  if (user.role === 'organizer' && (club.organizerIds || []).some(id => String(id) === String(user.id))) return true;
  return (group.admins || []).some(id => String(id) === String(user.id));
}

router.get('/', async (req, res) => {
  try {
    const clubs = await Club.find({ status: 'active' }).sort({ name: 1 });
    const groups = [];
    for (const club of clubs) {
      const group = await ensureGroupForClub(club);
      groups.push({
        ...group.toObject(),
        club: { id: club.id, name: club.name, category: club.category, logoUrl: club.logoUrl, coverImage: club.coverImage },
        memberCount: group.members.length,
        isMember: group.members.some(id => String(id) === String(req.user.id)),
        isAdmin: canManageGroup(req.user, club, group)
      });
    }
    res.json({ groups });
  } catch (err) {
    console.error('GROUP LIST ERROR:', err);
    res.status(500).json({ message: 'Could not fetch campus groups.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('admins', 'name email avatarUrl role').populate('members', 'name email avatarUrl department year');
    if (!group || group.status !== 'active') return res.status(404).json({ message: 'Group not found.' });
    const club = await Club.findById(group.club).select('name category department logoUrl coverImage description clubHeads organizerIds');
    if (!club) return res.status(404).json({ message: 'Club not found.' });
    // Backfill the group feed with upcoming published club events created before Campus Groups existed.
    const today = new Date().toISOString().slice(0, 10);
    const upcomingEvents = await Event.find({ club: club._id, status: 'published', date: { $gte: today } }).sort({ date: 1 }).limit(20);
    for (const event of upcomingEvents) {
      const existingEventPost = await GroupPost.findOne({ group: group._id, event: event._id });
      if (!existingEventPost) {
        await GroupPost.create({
          group: group._id,
          author: event.organizer || (group.admins[0] || req.user.id),
          type: 'event',
          title: `New event: ${event.title}`,
          content: `${event.title} is live. Open the registration form to reserve your spot.`,
          event: event._id,
          link: `/event-form.html?id=${event._id}`
        });
      }
    }
    const posts = await GroupPost.find({ group: group._id }).sort({ pinned: -1, createdAt: -1 }).limit(100)
      .populate('author', 'name email avatarUrl role')
      .populate('event', 'title description category date time endTime location capacity bookedCount registrationDeadline customRegistrationQuestions imageUrl');
    res.json({
      group: { ...group.toObject(), memberCount: group.members.length, isMember: group.members.some(id => String(id._id || id) === String(req.user.id)), isAdmin: canManageGroup(req.user, club, group) },
      club,
      posts
    });
  } catch (err) {
    console.error('GROUP DETAILS ERROR:', err);
    res.status(500).json({ message: 'Could not fetch group.' });
  }
});

router.post('/:id/join', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group || group.status !== 'active') return res.status(404).json({ message: 'Group not found.' });
    if (!group.members.some(id => String(id) === String(req.user.id))) group.members.push(req.user.id);
    await group.save();
    await Club.findByIdAndUpdate(group.club, { $addToSet: { followerIds: req.user.id } });
    res.json({ message: 'You joined the group.', isMember: true, memberCount: group.members.length });
  } catch (err) { res.status(500).json({ message: 'Could not join group.' }); }
});


router.post('/:id/members/:memberId/message', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('members', 'name email status');
    if (!group || group.status !== 'active') return res.status(404).json({ message: 'Group not found.' });
    if (!group.members.some(m => String(m._id) === String(req.user.id))) return res.status(403).json({ message: 'Join the group before contacting members.' });
    if (String(req.params.memberId) === String(req.user.id)) return res.status(400).json({ message: 'You cannot message yourself.' });
    const target = group.members.find(m => String(m._id) === String(req.params.memberId));
    if (!target || target.status === 'blocked') return res.status(404).json({ message: 'Member not found.' });
    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ message: 'Message is required.' });
    if (message.length > 2000) return res.status(400).json({ message: 'Message is too long.' });
    const Conversation = require('../models/Conversation');
    const Message = require('../models/Message');
    let conversation = await Conversation.findOne({ participants: { $all: [req.user.id, target._id], $size: 2 } });
    if (!conversation) conversation = await Conversation.create({ participants: [req.user.id, target._id], contextGroup: group._id });
    const chatMessage = await Message.create({ conversation: conversation._id, sender: req.user.id, text: message });
    conversation.contextGroup = conversation.contextGroup || group._id;
    conversation.lastMessage = message;
    conversation.lastMessageAt = new Date();
    conversation.lastMessageBy = req.user.id;
    await conversation.save();
    // Direct member-to-member chat is a chat event, not an EventHub notification.
    // The recipient will see the unread badge in Chat instead.
    res.status(201).json({ message: 'Message sent.', conversationId: conversation._id, chatMessage });
  } catch (err) {
    console.error('GROUP MEMBER MESSAGE ERROR:', err);
    res.status(500).json({ message: 'Could not send message.' });
  }
});

router.post('/:id/leave', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    group.members = group.members.filter(id => String(id) !== String(req.user.id));
    await group.save();
    await Club.findByIdAndUpdate(group.club, { $pull: { followerIds: req.user.id } });
    res.json({ message: 'You left the group.', isMember: false, memberCount: group.members.length });
  } catch (err) { res.status(500).json({ message: 'Could not leave group.' }); }
});

router.post('/:id/posts', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    const club = await Club.findById(group.club);
    if (!canManageGroup(req.user, club, group)) return res.status(403).json({ message: 'Only group admins, Club Heads or organizers can post.' });
    const title = String(req.body.title || '').trim();
    const content = String(req.body.content || '').trim();
    const type = ['announcement', 'form'].includes(req.body.type) ? req.body.type : 'announcement';
    if (!title) return res.status(400).json({ message: 'Post title is required.' });
    if (type === 'announcement' && !content) return res.status(400).json({ message: 'Announcement content is required.' });
    const post = await GroupPost.create({ group: group._id, author: req.user.id, type, title, content, link: String(req.body.link || '').trim() });
    const recipientIds = [...new Set(group.members.map(String).filter(id => id !== String(req.user.id)))];
    if (recipientIds.length) await Notification.insertMany(recipientIds.map(user => ({ user, type: 'group', title: `${club.name}: ${title}`, message: content.substring(0, 180) || 'New post in your campus group.', link: post.link || `/group.html?id=${group.id}` })));
    res.status(201).json({ message: 'Post published.', post });
  } catch (err) { console.error('GROUP POST ERROR:', err); res.status(500).json({ message: 'Could not publish group post.' }); }
});

router.put('/:id/posts/:postId/pin', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    const post = await GroupPost.findOne({ _id: req.params.postId, group: req.params.id });
    const club = group ? await Club.findById(group.club) : null;
    if (!group || !post) return res.status(404).json({ message: 'Post not found.' });
    if (!canManageGroup(req.user, club, group)) return res.status(403).json({ message: 'You cannot pin posts.' });
    post.pinned = !post.pinned;
    await post.save();
    res.json({ message: post.pinned ? 'Post pinned.' : 'Post unpinned.', post });
  } catch (err) { res.status(500).json({ message: 'Could not update pinned post.' }); }
});

router.delete('/:id/posts/:postId', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    const post = await GroupPost.findOne({ _id: req.params.postId, group: req.params.id });
    const club = group ? await Club.findById(group.club) : null;
    if (!group || !post) return res.status(404).json({ message: 'Post not found.' });
    if (!canManageGroup(req.user, club, group)) return res.status(403).json({ message: 'You cannot delete posts.' });
    await post.deleteOne();
    res.json({ message: 'Post deleted.' });
  } catch (err) { res.status(500).json({ message: 'Could not delete post.' }); }
});

module.exports = router;
