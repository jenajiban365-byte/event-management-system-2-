const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');

const eventStorySchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  caption: { type: String, default: '', trim: true, maxlength: 280 },
  mediaUrl: { type: String, default: '' },
  mediaType: { type: String, enum: ['image','file','none'], default: 'none' }
}, schemaOptions);

eventStorySchema.index({ event: 1, createdAt: -1 });
module.exports = mongoose.model('EventStory', eventStorySchema);
