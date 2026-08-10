const mongoose = require('mongoose');
const schemaOptions = require('./schemaOptions');
const messageSchema = new mongoose.Schema({ sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, senderName: String, body: { type: String, required: true, trim: true }, createdAt: { type: Date, default: Date.now } }, { _id: true });
const ticketSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true, trim: true }, email: { type: String, required: true, lowercase: true, trim: true },
  subject: { type: String, required: true, trim: true }, status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  messages: { type: [messageSchema], default: [] }
}, schemaOptions);
ticketSchema.index({ requester: 1, updatedAt: -1 });
module.exports = mongoose.model('SupportTicket', ticketSchema);
