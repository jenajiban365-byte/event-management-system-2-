require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const Club = require('../models/Club');
const Event = require('../models/Event');
const Opportunity = require('../models/Opportunity');
const Announcement = require('../models/Announcement');
const Booking = require('../models/Booking');
const Waitlist = require('../models/Waitlist');
const SavedEvent = require('../models/SavedEvent');
const Application = require('../models/Application');
const Notification = require('../models/Notification');
const ClubRequest = require('../models/ClubRequest');
const SupportTicket = require('../models/SupportTicket');

async function resetUsers() {
  if (String(process.env.RESET_USERS_CONFIRM || '').toUpperCase() !== 'YES') {
    throw new Error('Safety check: set RESET_USERS_CONFIRM=YES before running this one-time reset.');
  }

  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || '');
  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error('ADMIN_EMAIL and a 12+ character ADMIN_PASSWORD must be configured first.');
  }

  await connectDB();

  // Remove every previous account, then create exactly one fresh College Admin.
  await User.deleteMany({});

  // Remove user-owned/history data so the new accounts start from a clean state.
  await Promise.all([
    Booking.deleteMany({}),
    Waitlist.deleteMany({}),
    SavedEvent.deleteMany({}),
    Application.deleteMany({}),
    Notification.deleteMany({}),
    ClubRequest.deleteMany({}),
    SupportTicket.deleteMany({})
  ]);

  // Keep the seeded clubs/events, but remove all stale user references.
  await Club.updateMany({}, {
    $set: { clubHeads: [], followerIds: [], memberIds: [], organizerIds: [] },
    $unset: { createdBy: 1 }
  });
  await Event.updateMany({}, { $unset: { organizer: 1 } });
  await Opportunity.updateMany({}, { $unset: { createdBy: 1 } });
  await Announcement.updateMany({}, { $unset: { createdBy: 1 } });

  const password = await bcrypt.hash(adminPassword, 12);
  await User.create({
    name: 'College Admin',
    email: adminEmail,
    password,
    role: 'admin',
    status: 'active',
    emailVerified: true
  });

  console.log('User reset complete. All previous users/organizers were removed and a fresh College Admin was created.');
  await mongoose.connection.close();
}

resetUsers().catch(async (err) => {
  console.error(`USER RESET FAILED: ${err.message}`);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});
