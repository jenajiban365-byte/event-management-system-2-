const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  club: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  description: { type: String, default: '', trim: true },
  coverImage: { type: String, default: '' },
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, schemaOptions);

groupSchema.index({ club: 1 }, { unique: true });
module.exports = mongoose.model('Group', groupSchema);
