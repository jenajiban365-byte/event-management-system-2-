const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '', trim: true, maxlength: 2000 },
  attachment: {
    url: { type: String, default: '' },
    type: { type: String, enum: ['image', 'file'], default: 'file' },
    name: { type: String, default: '' },
    size: { type: Number, default: 0 },
    contentType: { type: String, default: '' }
  },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  readAt: { type: Date, default: null },
  editedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
  reactions: [{
    emoji: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, required: true }
  }]
}, schemaOptions);

messageSchema.index({ conversation: 1, createdAt: 1 });
messageSchema.index({ sender: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
