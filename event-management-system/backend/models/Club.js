const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');
const clubSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  shortName: { type: String, default: '', trim: true },
  description: { type: String, default: '', trim: true },
  category: { type: String, required: true, trim: true },
  department: { type: String, default: 'General / Open', trim: true },
  logoUrl: { type: String, default: '' },
  coverImage: { type: String, default: '' },
  contactEmail: { type: String, default: '', trim: true },
  status: { type: String, enum: ['pending', 'approved', 'active', 'inactive', 'blocked'], default: 'active' },
  clubHeads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  socialLinks: {
    website: { type: String, default: '' }, instagram: { type: String, default: '' },
    linkedin: { type: String, default: '' }, github: { type: String, default: '' }, twitter: { type: String, default: '' }
  },
  // Legacy field kept so existing EventHub club data remains readable.
  organizerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, schemaOptions);
module.exports = mongoose.model('Club', clubSchema);
