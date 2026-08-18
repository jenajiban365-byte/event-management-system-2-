const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  contextGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
  contextEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: null },
  lastMessageBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // Soft presence / typing for campus messenger feel (TTL-checked on read)
  typingBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  typingAt: { type: Date, default: null },
  // Per-user mute (user ids who muted this conversation)
  mutedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, schemaOptions);

conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.index({ contextGroup: 1, updatedAt: -1 });
conversationSchema.index({ contextEvent: 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
