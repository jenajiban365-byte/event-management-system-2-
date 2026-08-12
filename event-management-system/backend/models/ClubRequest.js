const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');
const clubRequestSchema = new mongoose.Schema({
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  proposedName: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  department: { type: String, default: 'General / Open', trim: true },
  description: { type: String, required: true, trim: true },
  purpose: { type: String, default: '', trim: true },
  whyExist: { type: String, default: '', trim: true },
  proposedFacultyCoordinator: { type: String, default: '', trim: true },
  additionalInfo: { type: String, default: '', trim: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNote: { type: String, default: '', trim: true }
}, schemaOptions);
module.exports = mongoose.model('ClubRequest', clubRequestSchema);
