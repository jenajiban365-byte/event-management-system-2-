const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');

const groupPostSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['announcement', 'event', 'form', 'opportunity'], default: 'announcement' },
  title: { type: String, required: true, trim: true },
  content: { type: String, default: '', trim: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
  link: { type: String, default: '', trim: true },
  pinned: { type: Boolean, default: false }
}, schemaOptions);

groupPostSchema.index({ group: 1, createdAt: -1 });
module.exports = mongoose.model('GroupPost', groupPostSchema);
