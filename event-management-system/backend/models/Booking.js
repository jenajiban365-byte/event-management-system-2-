const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    status: { type: String, enum: ['confirmed', 'pending', 'cancelled', 'rejected'], default: 'confirmed' },
    checkInCode: { type: String, unique: true, sparse: true },
    checkedInAt: { type: Date, default: null },
    attendanceStatus: { type: String, enum: ['not_checked_in', 'checked_in'], default: 'not_checked_in' },
    registrationAnswers: { type: [{ question: String, answer: String }], default: [] },
    registrationProfile: {
      name: { type: String, default: '' }, email: { type: String, default: '' }, studentId: { type: String, default: '' },
      department: { type: String, default: '' }, year: { type: String, default: '' }, phone: { type: String, default: '' }
    }
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
