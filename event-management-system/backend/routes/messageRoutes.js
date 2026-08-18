const express = require('express');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Group = require('../models/Group');
const User = require('../models/User');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

function participantQuery(userId) {
  return { participants: userId };
}

async function findConversationForUser(id, userId) {
  return Conversation.findOne({ _id: id, ...participantQuery(userId) });
}

async function canConnectThroughEvent(eventId, me, target) {
  if (!eventId) return true;
  const event = await Event.findById(eventId).select('_id status');
  if (!event || event.status !== 'published') return false;
  const active = { status: { $in: ['confirmed', 'pending'] }, event: event._id, user: { $in: [me, target] } };
  const count = await Booking.countDocuments(active);
  return count === 2;
}

async function canConnectThroughGroup(groupId, me, target) {
  if (!groupId) return true;
  const group = await Group.findById(groupId).select('members admins status');
  if (!group || group.status !== 'active') return false;
  const allowed = new Set([
    ...(group.members || []).map(String),
    ...(group.admins || []).map(String)
  ]);
  return allowed.has(String(me)) && allowed.has(String(target));
}

router.get('/unread-count', async (req, res) => {
  try {
    const conversations = await Conversation.find(participantQuery(req.user.id)).select('_id lastMessageBy').lean();
    const ids = conversations.map(c => c._id);
    const unread = await Message.aggregate([
      { $match: { conversation: { $in: ids }, sender: { $ne: req.user.id }, readAt: null } },
      { $group: { _id: '$conversation', count: { $sum: 1 } } }
    ]);
    const unreadMap = new Map(unread.map(x => [String(x._id), x.count]));
    const count = conversations.reduce((total, c) => {
      if (String(c.lastMessageBy || '') === String(req.user.id)) return total;
      return total + (unreadMap.get(String(c._id)) || 0);
    }, 0);
    res.json({ count });
  } catch (err) {
    console.error('MESSAGE UNREAD ERROR:', err);
    res.status(500).json({ message: 'Could not load chat count.' });
  }
});

router.get('/conversations', async (req, res) => {
  try {
    const conversations = await Conversation.find(participantQuery(req.user.id))
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(100)
      .populate('participants', 'name avatarUrl chatAvatarUrl chatAvatarId department year role lastActiveAt')
      .lean();
    const ids = conversations.map(c => c._id);
    const unread = await Message.aggregate([
      { $match: { conversation: { $in: ids }, sender: { $ne: req.user.id }, readAt: null } },
      { $group: { _id: '$conversation', count: { $sum: 1 } } }
    ]);
    const unreadMap = new Map(unread.map(x => [String(x._id), x.count]));
    const now = Date.now();
    // A conversation is unread only when the latest activity came from the other person.
    // If I just sent the latest message, never show an unread badge on my own chat.
    res.json({ conversations: conversations.map(c => {
      const typingFresh = c.typingAt && (now - new Date(c.typingAt).getTime()) < 7000
        && String(c.typingBy || '') !== String(req.user.id);
      return {
        ...c,
        unreadCount: String(c.lastMessageBy || '') === String(req.user.id)
          ? 0
          : (unreadMap.get(String(c._id)) || 0),
        isTyping: !!typingFresh,
        muted: (c.mutedBy || []).some(id => String(id) === String(req.user.id))
      };
    }) });
  } catch (err) {
    console.error('CONVERSATIONS ERROR:', err);
    res.status(500).json({ message: 'Could not load conversations.' });
  }
});

router.post('/start', async (req, res) => {
  try {
    const targetId = String(req.body.userId || '').trim();
    const groupId = String(req.body.groupId || '').trim() || null;
    const eventId = String(req.body.eventId || '').trim() || null;
    if (!targetId) return res.status(400).json({ message: 'A person is required.' });
    if (targetId === String(req.user.id)) return res.status(400).json({ message: 'You cannot start a chat with yourself.' });
    const target = await User.findById(targetId).select('name avatarUrl chatAvatarUrl chatAvatarId department year role status');
    if (!target || target.status === 'blocked') return res.status(404).json({ message: 'That person is not available.' });
    if (!(await canConnectThroughGroup(groupId, req.user.id, targetId))) return res.status(403).json({ message: 'Join the same campus group before starting a chat.' });
    if (!(await canConnectThroughEvent(eventId, req.user.id, targetId))) return res.status(403).json({ message: 'You both need an active registration for this event.' });

    let conversation = await Conversation.findOne({ participants: { $all: [req.user.id, targetId], $size: 2 } });
    if (!conversation) {
      conversation = await Conversation.create({ participants: [req.user.id, targetId], contextGroup: groupId || null, contextEvent: eventId || null });
    } else if ((groupId && !conversation.contextGroup) || (eventId && !conversation.contextEvent)) {
      if (groupId && !conversation.contextGroup) conversation.contextGroup = groupId;
      if (eventId && !conversation.contextEvent) conversation.contextEvent = eventId;
      await conversation.save();
    }
    res.status(201).json({ conversation });
  } catch (err) {
    console.error('START CHAT ERROR:', err);
    res.status(500).json({ message: 'Could not start the chat.' });
  }
});

router.get('/conversations/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, ...participantQuery(req.user.id) })
      .populate('participants', 'name avatarUrl chatAvatarUrl chatAvatarId department year role lastActiveAt');
    if (!conversation) return res.status(404).json({ message: 'Chat not found.' });
    const messages = await Message.find({ conversation: conversation._id })
      .sort({ createdAt: 1 })
      .limit(1000)
      .populate('sender', 'name avatarUrl chatAvatarUrl chatAvatarId department year role')
      .populate({ path: 'replyTo', select: 'text sender deletedAt attachment createdAt', populate: { path: 'sender', select: 'name' } });
    const muted = (conversation.mutedBy || []).some(id => String(id) === String(req.user.id));
    const typingFresh = conversation.typingAt && (Date.now() - new Date(conversation.typingAt).getTime()) < 7000
      && String(conversation.typingBy || '') !== String(req.user.id);
    res.json({
      conversation: {
        ...conversation.toObject(),
        muted,
        isTyping: !!typingFresh
      },
      messages
    });
  } catch (err) {
    console.error('CHAT LOAD ERROR:', err);
    res.status(500).json({ message: 'Could not load this chat.' });
  }
});

router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const conversation = await findConversationForUser(req.params.id, req.user.id);
    if (!conversation) return res.status(404).json({ message: 'Chat not found.' });
    const text = String(req.body.text || '').trim();
    const attachment = req.body.attachment && req.body.attachment.url ? {
      url: String(req.body.attachment.url),
      type: req.body.attachment.type === 'image' ? 'image' : 'file',
      name: String(req.body.attachment.name || 'Attachment').slice(0, 200),
      size: Number(req.body.attachment.size) || 0,
      contentType: String(req.body.attachment.contentType || '').slice(0, 160)
    } : null;
    if (!text && !attachment) return res.status(400).json({ message: 'Write a message or attach something first.' });
    if (text.length > 2000) return res.status(400).json({ message: 'Message is too long.' });

    let replyTo = null;
    if (req.body.replyTo) {
      const parent = await Message.findOne({ _id: req.body.replyTo, conversation: conversation._id });
      if (parent) replyTo = parent._id;
    }

    const message = await Message.create({ conversation: conversation._id, sender: req.user.id, text, attachment, replyTo });

    // Sending while the conversation is open means the user is actively
    // viewing this thread. Clear any older incoming unread messages too, so
    // the sender never creates an unread badge for their own conversation.
    await Message.updateMany(
      { conversation: conversation._id, sender: { $ne: req.user.id }, readAt: null },
      { readAt: new Date() }
    );

    conversation.lastMessage = text || (attachment?.type === 'image' ? '📷 Photo' : `📎 ${attachment?.name || 'Attachment'}`);
    conversation.lastMessageAt = new Date();
    conversation.lastMessageBy = req.user.id;
    await conversation.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'name avatarUrl chatAvatarUrl chatAvatarId department year role')
      .populate({ path: 'replyTo', select: 'text sender deletedAt attachment createdAt', populate: { path: 'sender', select: 'name' } });
    res.status(201).json({ message: populated });
  } catch (err) {
    console.error('SEND CHAT ERROR:', err);
    res.status(500).json({ message: 'Could not send your message.' });
  }
});

router.put('/conversations/:id/read', async (req, res) => {
  try {
    const conversation = await findConversationForUser(req.params.id, req.user.id);
    if (!conversation) return res.status(404).json({ message: 'Chat not found.' });
    await Message.updateMany({ conversation: conversation._id, sender: { $ne: req.user.id }, readAt: null }, { readAt: new Date() });
    res.json({ message: 'Chat marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not mark chat as read.' });
  }
});

// V44 — incremental message polling (no full reload / no scroll jump)
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const conversation = await findConversationForUser(req.params.id, req.user.id);
    if (!conversation) return res.status(404).json({ message: 'Chat not found.' });
    const query = { conversation: conversation._id };
    if (req.query.after) {
      const after = new Date(String(req.query.after));
      if (!Number.isNaN(after.getTime())) query.updatedAt = { $gt: after };
    }
    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .limit(1000)
      .populate('sender', 'name avatarUrl chatAvatarUrl chatAvatarId department year role')
      .populate({ path: 'replyTo', select: 'text sender deletedAt attachment createdAt', populate: { path: 'sender', select: 'name' } });
    const typingFresh = conversation.typingAt && (Date.now() - new Date(conversation.typingAt).getTime()) < 7000
      && String(conversation.typingBy || '') !== String(req.user.id);
    res.json({
      messages,
      serverTime: new Date().toISOString(),
      isTyping: !!typingFresh
    });
  } catch (err) {
    console.error('CHAT SYNC ERROR:', err);
    res.status(500).json({ message: 'Could not sync this chat.' });
  }
});

// V44 — edit your own message
router.put('/messages/:messageId', async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: 'Message not found.' });
    if (String(message.sender) !== String(req.user.id)) return res.status(403).json({ message: 'You can only edit your own messages.' });
    if (message.deletedAt) return res.status(400).json({ message: 'This message was deleted.' });
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ message: 'Write a message first.' });
    if (text.length > 2000) return res.status(400).json({ message: 'Message is too long.' });
    message.text = text;
    message.editedAt = new Date();
    await message.save();
    const conversation = await findConversationForUser(message.conversation, req.user.id);
    if (conversation && String(conversation.lastMessageBy) === String(req.user.id)) {
      conversation.lastMessage = text;
      await conversation.save();
    }
    const populated = await Message.findById(message._id).populate('sender', 'name avatarUrl chatAvatarUrl chatAvatarId department year role');
    res.json({ message: populated });
  } catch (err) {
    console.error('EDIT MESSAGE ERROR:', err);
    res.status(500).json({ message: 'Could not edit this message.' });
  }
});

// V44 — delete (soft) your own message
router.delete('/messages/:messageId', async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: 'Message not found.' });
    if (String(message.sender) !== String(req.user.id)) return res.status(403).json({ message: 'You can only delete your own messages.' });
    message.deletedAt = new Date();
    message.text = 'This message was deleted';
    message.reactions = [];
    await message.save();
    res.json({ message: 'Message deleted.' });
  } catch (err) {
    console.error('DELETE MESSAGE ERROR:', err);
    res.status(500).json({ message: 'Could not delete this message.' });
  }
});

// V44 — toggle an emoji reaction on a message inside your conversation
router.post('/messages/:messageId/reactions', async (req, res) => {
  try {
    const emoji = String(req.body.emoji || '').trim().slice(0, 8);
    if (!emoji) return res.status(400).json({ message: 'Pick a reaction.' });
    const message = await Message.findById(req.params.messageId);
    if (!message || message.deletedAt) return res.status(404).json({ message: 'Message not found.' });
    const conversation = await findConversationForUser(message.conversation, req.user.id);
    if (!conversation) return res.status(403).json({ message: 'You are not part of this chat.' });
    const existing = (message.reactions || []).findIndex(r => String(r.user) === String(req.user.id) && r.emoji === emoji);
    if (existing >= 0) message.reactions.splice(existing, 1);
    else message.reactions.push({ emoji, user: req.user.id });
    await message.save();
    const populated = await Message.findById(message._id).populate('sender', 'name avatarUrl chatAvatarUrl chatAvatarId department year role');
    res.json({ message: populated });
  } catch (err) {
    console.error('REACTION ERROR:', err);
    res.status(500).json({ message: 'Could not react to this message.' });
  }
});

// V44 — searchable directory of people you already share a campus group with
router.get('/directory', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const groups = await Group.find({ status: 'active', $or: [{ members: req.user.id }, { admins: req.user.id }] })
      .select('members admins name')
      .lean();
    const ids = new Set();
    groups.forEach(g => {
      [...(g.members || []), ...(g.admins || [])].forEach(id => {
        if (String(id) !== String(req.user.id)) ids.add(String(id));
      });
    });
    if (!ids.size) return res.json({ people: [] });
    const filter = { _id: { $in: [...ids] }, status: 'active' };
    if (q) filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const people = await User.find(filter).select('name avatarUrl chatAvatarUrl chatAvatarId department year role lastActiveAt').limit(40).lean();
    res.json({ people: people.map(p => ({ ...p, id: String(p._id) })) });
  } catch (err) {
    console.error('CHAT DIRECTORY ERROR:', err);
    res.status(500).json({ message: 'Could not load your campus directory.' });
  }
});

// V51 — typing indicator (soft presence, ~6s TTL on client)
router.post('/conversations/:id/typing', async (req, res) => {
  try {
    const conversation = await findConversationForUser(req.params.id, req.user.id);
    if (!conversation) return res.status(404).json({ message: 'Chat not found.' });
    const isTyping = req.body.typing !== false;
    conversation.typingBy = isTyping ? req.user.id : null;
    conversation.typingAt = isTyping ? new Date() : null;
    await conversation.save();
    // Touch last active
    await User.findByIdAndUpdate(req.user.id, { lastActiveAt: new Date() });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Could not update typing status.' });
  }
});

// V51 — mute / unmute conversation for current user
router.post('/conversations/:id/mute', async (req, res) => {
  try {
    const conversation = await findConversationForUser(req.params.id, req.user.id);
    if (!conversation) return res.status(404).json({ message: 'Chat not found.' });
    const mute = req.body.mute !== false;
    const uid = String(req.user.id);
    const muted = (conversation.mutedBy || []).map(String);
    if (mute && !muted.includes(uid)) conversation.mutedBy.push(req.user.id);
    if (!mute) conversation.mutedBy = (conversation.mutedBy || []).filter(id => String(id) !== uid);
    await conversation.save();
    res.json({ muted: mute });
  } catch (err) {
    res.status(500).json({ message: 'Could not update mute.' });
  }
});

// V51 — share an event into a conversation (creates a structured message)
router.post('/conversations/:id/share-event', async (req, res) => {
  try {
    const conversation = await findConversationForUser(req.params.id, req.user.id);
    if (!conversation) return res.status(404).json({ message: 'Chat not found.' });
    const eventId = String(req.body.eventId || '').trim();
    if (!eventId) return res.status(400).json({ message: 'Event is required.' });
    const event = await Event.findById(eventId).select('title date time location status capacity bookedCount imageUrl');
    if (!event || event.status !== 'published') return res.status(404).json({ message: 'Event not available.' });
    const text = `📅 ${event.title}\n${event.date}${event.time ? ' · ' + event.time : ''}\n📍 ${event.location || 'Campus'}\nOpen: event-details.html?id=${event.id}`;
    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user.id,
      text
    });
    conversation.lastMessage = `📅 ${event.title}`;
    conversation.lastMessageAt = new Date();
    conversation.lastMessageBy = req.user.id;
    await conversation.save();
    const populated = await Message.findById(message._id)
      .populate('sender', 'name avatarUrl chatAvatarUrl chatAvatarId department year role')
      .populate({ path: 'replyTo', select: 'text sender deletedAt attachment createdAt', populate: { path: 'sender', select: 'name' } });
    res.status(201).json({ message: populated });
  } catch (err) {
    console.error('SHARE EVENT ERROR:', err);
    res.status(500).json({ message: 'Could not share this event.' });
  }
});

// V51 — heartbeat for last-active presence (called from chat poll)
router.post('/presence', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { lastActiveAt: new Date() });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Presence update failed.' });
  }
});

module.exports = router;
