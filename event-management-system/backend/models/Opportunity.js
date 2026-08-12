const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');
const customQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true },
  required: { type: Boolean, default: true }
}, { _id: false });
const opportunitySchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  requirements: { type: String, default: '', trim: true },
  eligibility: { type: String, default: 'Open to all students', trim: true },
  departments: [{ type: String, trim: true }],
  years: [{ type: String, trim: true }],
  requiredSkills: [{ type: String, trim: true }],
  numberOfPositions: { type: Number, default: 1, min: 1 },
  openingDate: { type: String, default: '' },
  closingDate: { type: String, default: '' },
  customQuestions: [customQuestionSchema],
  resumeRequired: { type: Boolean, default: false },
  portfolioRequired: { type: Boolean, default: false },
  status: { type: String, enum: ['draft', 'open', 'closed'], default: 'open' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, schemaOptions);
module.exports = mongoose.model('Opportunity', opportunitySchema);
