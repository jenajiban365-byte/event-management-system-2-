const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');
const customAnswerSchema = new mongoose.Schema({
  question: { type: String, required: true }, answer: { type: String, default: '' }
}, { _id: false });
const applicationSchema = new mongoose.Schema({
  opportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true },
  club: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  department: { type: String, required: true, trim: true },
  year: { type: String, required: true, trim: true },
  skills: [{ type: String, trim: true }],
  experience: { type: String, default: '', trim: true },
  answers: [customAnswerSchema],
  githubUrl: { type: String, default: '', trim: true },
  portfolioUrl: { type: String, default: '', trim: true },
  resumeUrl: { type: String, default: '', trim: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  reviewedAt: { type: Date, default: null }
}, schemaOptions);
applicationSchema.index({ opportunity: 1, student: 1 }, { unique: true });
module.exports = mongoose.model('Application', applicationSchema);
