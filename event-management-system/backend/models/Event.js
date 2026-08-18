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
    customRegistrationQuestions: { type: [{
      question: { type: String, trim: true },
      description: { type: String, default: '', trim: true },
      type: { type: String, enum: ['text','textarea','select','checkbox','email','number','date','url','file','short_answer','paragraph','multiple_choice','checkbox_group','dropdown','linear_scale','rating','time','section'], default: 'text' },
      options: { type: [String], default: [] },
      required: { type: Boolean, default: true },
      imageUrl: { type: String, default: '' },
      scaleMin: { type: Number, default: 1 },
      scaleMax: { type: Number, default: 5 },
      scaleMinLabel: { type: String, default: '' },
      scaleMaxLabel: { type: String, default: '' },
      validation: { type: String, default: '' },
      maxLength: { type: Number, default: 0 },
      fileAccept: { type: String, default: '' },
      maxFileSizeMB: { type: Number, default: 10 },
      showWhen: { questionIndex: { type: Number, default: null }, equals: { type: String, default: '' } }
    }], default: [] },
    registrationForm: {
      enabled: { type: Boolean, default: false },
      title: { type: String, default: 'Event Registration' },
      description: { type: String, default: '' },
      formCode: { type: String, default: '' },
      settings: {
        collectEmail: { type: Boolean, default: true },
        requireLogin: { type: Boolean, default: true },
        limitOneResponse: { type: Boolean, default: true },
        showProgress: { type: Boolean, default: true },
        shuffleQuestions: { type: Boolean, default: false },
        allowEditResponse: { type: Boolean, default: false },
        showResponseReceipt: { type: Boolean, default: true },
        showDigitalTicket: { type: Boolean, default: true },
        confirmationTitle: { type: String, default: 'You’re registered!' },
        confirmationMessage: { type: String, default: 'Your response has been recorded on EventHub.' }
      },
      theme: {
        accent: { type: String, default: '#6554e8' },
        style: { type: String, enum: ['campus','minimal','midnight'], default: 'campus' },
        coverImage: { type: String, default: '' }
      }
    },
    approvalNote: { type: String, default: '', trim: true },
    publishedAt: { type: Date, default: null }
  },
  schemaOptions
);

module.exports = mongoose.model('Event', eventSchema);
