const mongoose = require('mongoose');
const { logError } = require('../utils/errors');

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('MONGODB_URI is not set. Add it to your .env file (see .env.example).');
    process.exit(1);
  }

  // Connection problems after the initial handshake are emitted as events, so
  // without these listeners a dropped database link would be invisible.
  mongoose.connection.on('error', (err) => logError('mongodb connection', err));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected. Mongoose will retry automatically.'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected.'));

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log('MongoDB connected successfully.');
  } catch (err) {
    logError('mongodb initial connection', err);
    process.exit(1);
  }
}

module.exports = connectDB;
