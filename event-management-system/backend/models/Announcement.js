const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');
const announcementSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, schemaOptions);
module.exports = mongoose.model('Announcement', announcementSchema);
