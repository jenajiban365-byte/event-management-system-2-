const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');

const waitlistSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    position: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['waiting', 'fulfilled', 'cancelled'], default: 'waiting' }
  },
  schemaOptions
);

waitlistSchema.index(
  { event: 1, user: 1 },
  { unique: true, partialFilterExpression: { status: 'waiting' } }
);
waitlistSchema.index({ event: 1, status: 1, position: 1 });

module.exports = mongoose.model('Waitlist', waitlistSchema);
