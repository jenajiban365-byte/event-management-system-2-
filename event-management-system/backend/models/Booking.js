const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    status: { type: String, enum: ['confirmed', 'pending', 'cancelled', 'rejected'], default: 'confirmed' }
  },
  schemaOptions
);

// Prevent duplicate active registrations for the same attendee and event.
// Cancelled bookings remain re-bookable because they are excluded from the
// partial unique index.
bookingSchema.index(
  { user: 1, event: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['confirmed', 'pending'] }
    }
  }
);

module.exports = mongoose.model('Booking', bookingSchema);
