const Group = require('../models/Group');
const GroupPost = require('../models/GroupPost');
const Notification = require('../models/Notification');

async function ensureGroupForClub(club, createdBy = null) {
  if (!club) return null;
  let group = await Group.findOne({ club: club._id });
  if (!group) {
    const admins = [
      ...(club.clubHeads || []).map(String),
      ...(club.organizerIds || []).map(String)
    ];
    group = await Group.create({
      name: club.name,
      club: club._id,
      description: club.description || `Official campus group for ${club.name}.`,
      coverImage: club.coverImage || '',
      admins: [...new Set(admins)],
      members: [...new Set((club.followerIds || []).map(String))],
      createdBy: createdBy || club.createdBy || null
    });
  } else {
    const expectedAdmins = [
      ...(club.clubHeads || []).map(String),
      ...(club.organizerIds || []).map(String)
    ];
    const merged = [...new Set([...(group.admins || []).map(String), ...expectedAdmins])];
    const mergedMembers = [...new Set([...(group.members || []).map(String), ...(club.followerIds || []).map(String)])];
    if (merged.length !== group.admins.length || mergedMembers.length !== group.members.length) {
      group.admins = merged;
      group.members = mergedMembers;
      await group.save();
    }
  }
  return group;
}

async function publishGroupPost({ club, authorId, type = 'announcement', title, content = '', event = null, link = '', notify = true }) {
  const group = await ensureGroupForClub(club, authorId);
  if (!group) return null;
  const post = await GroupPost.create({ group: group._id, author: authorId, type, title, content, event, link });
  if (notify && group.members?.length) {
    const recipientIds = [...new Set(group.members.map(String).filter(id => id !== String(authorId)))];
    if (recipientIds.length) {
      await Notification.insertMany(recipientIds.map(user => ({
        user,
        type: type === 'event' || type === 'form' ? 'event' : 'announcement',
        title: `${club.name}: ${title}`,
        message: content ? content.substring(0, 180) : `New ${type} posted in ${club.name}.`,
        link: link || `/group.html?id=${group._id}`
      })));
    }
  }
  return post;
}

module.exports = { ensureGroupForClub, publishGroupPost };
