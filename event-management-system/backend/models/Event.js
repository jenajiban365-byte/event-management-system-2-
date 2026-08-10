const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    date: { type: String, required: true }, // stored as 'YYYY-MM-DD' to match <input type="date">
    time: { type: String, required: true }, // stored as 'HH:MM' to match <input type="time">
    endTime: { type: String, default: '' },
    location: { type: String, required: true },
    // Optional coordinates used by the free browser-based "Near Me" feature.
    latitude: { type: Number, min: -90, max: 90, default: null },
    longitude: { type: Number, min: -180, max: 180, default: null },
    capacity: { type: Number, required: true, min: 1 },
    bookedCount: { type: Number, default: 0 },
    imageUrl: { type: String, default: '' },
    status: { type: String, enum: ['published', 'draft', 'pending_approval', 'changes_requested', 'rejected', 'cancelled'], default: 'published' },
    club: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', default: null },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    registrationDeadline: { type: String, default: '' },
    eligibility: { type: String, default: 'All students', trim: true },
    eventType: { type: String, default: 'event', trim: true },
    price: { type: Number, default: 0, min: 0 },
    approvalRequired: { type: Boolean, default: false },
    approvalNote: { type: String, default: '', trim: true },
    publishedAt: { type: Date, default: null }
  },
  schemaOptions
);

module.exports = mongoose.model('Event', eventSchema);
