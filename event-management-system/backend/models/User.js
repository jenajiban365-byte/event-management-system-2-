const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Password is not required for accounts created via Google Sign-In
    password: {
      type: String,
      required: function () {
        return !this.googleId;
      }
    },
    googleId: { type: String, unique: true, sparse: true }, // sparse allows many users with no googleId
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' }
  },
  schemaOptions
);

module.exports = mongoose.model('User', userSchema);
