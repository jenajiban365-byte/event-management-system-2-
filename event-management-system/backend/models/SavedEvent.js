const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');

// Keeps saved events available across browsers and devices.
const savedEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true }
}, schemaOptions);

savedEventSchema.index({ user: 1, event: 1 }, { unique: true });
module.exports = mongoose.model('SavedEvent', savedEventSchema);
