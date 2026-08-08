const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }
  },
  schemaOptions
);

module.exports = mongoose.model('Category', categorySchema);
