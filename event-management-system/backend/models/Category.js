const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '', trim: true },
  icon: { type: String, default: '📁', trim: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  order: { type: Number, default: 0 }
}, schemaOptions);
module.exports = mongoose.model('Category', categorySchema);
