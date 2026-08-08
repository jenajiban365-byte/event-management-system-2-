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

module.exports = mongoose.model('Booking', bookingSchema);
