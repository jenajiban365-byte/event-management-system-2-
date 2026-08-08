const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    date: { type: String, required: true }, // stored as 'YYYY-MM-DD' to match <input type="date">
    time: { type: String, required: true }, // stored as 'HH:MM' to match <input type="time">
    location: { type: String, required: true },
    capacity: { type: Number, required: true, min: 1 },
    bookedCount: { type: Number, default: 0 },
    imageUrl: { type: String, default: '' },
    status: { type: String, enum: ['published', 'draft'], default: 'published' }
  },
  schemaOptions
);

module.exports = mongoose.model('Event', eventSchema);
