const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: {
      type: String,
      required: function () { return !this.googleId; }
    },
    googleId: { type: String, unique: true, sparse: true },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    emailVerified: { type: Boolean, default: true },
    emailVerificationToken: { type: String, default: '', select: false },
    emailVerificationExpires: { type: Date, default: null, select: false },
    passwordResetToken: { type: String, default: '', select: false },
    passwordResetExpires: { type: Date, default: null, select: false },
    avatarUrl: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    status: { type: String, enum: ['active', 'blocked'], default: 'active' }
  },
  schemaOptions
);

module.exports = mongoose.model('User', userSchema);
