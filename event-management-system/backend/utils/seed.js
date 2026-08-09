const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Category = require('../models/Category');
const Event = require('../models/Event');

async function seedDatabase() {
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    await User.create({
      name: 'System Admin',
      email: 'admin@events.com',
      password: passwordHash,
      role: 'admin',
      status: 'active',
      emailVerified: true
    });
    console.log('Seeded default admin account (admin@events.com / Admin@123).');
  }

  const categoryCount = await Category.countDocuments();
  if (categoryCount === 0) {
    await Category.insertMany([
      { name: 'Conference' },
      { name: 'Workshop' },
      { name: 'Concert' },
      { name: 'Sports' },
      { name: 'Networking' }
    ]);
    console.log('Seeded default categories.');
  }

  const eventCount = await Event.countDocuments();
  if (eventCount === 0) {
    await Event.insertMany([
      {
        title: 'Tech Innovators Summit 2026',
        description: 'A full-day conference bringing together industry leaders to discuss the latest in technology, AI, and innovation.',
        category: 'Conference',
        date: '2026-09-15',
        time: '09:00',
        location: 'Bhubaneswar Convention Center',
        capacity: 200,
        bookedCount: 0,
        status: 'published'
      },
      {
        title: 'Modern Web Development Workshop',
        description: 'Hands-on workshop covering React, Node.js and modern deployment practices.',
        category: 'Workshop',
        date: '2026-08-25',
        time: '10:30',
        location: 'Tech Hub, Sector 5',
        capacity: 50,
        bookedCount: 0,
        status: 'published'
      },
      {
        title: 'Sunset Live Music Festival',
        description: 'An evening of live bands, food trucks, and good vibes as the sun sets over the city.',
        category: 'Concert',
        date: '2026-09-05',
        time: '17:00',
        location: 'Riverside Amphitheatre',
        capacity: 500,
        bookedCount: 0,
        status: 'published'
      },
      {
        title: 'City Marathon 2026',
        description: 'Join thousands of runners for the annual city marathon. 5K, 10K, and full marathon categories available.',
        category: 'Sports',
        date: '2026-10-12',
        time: '06:00',
        location: 'City Stadium Grounds',
        capacity: 1000,
        bookedCount: 0,
        status: 'published'
      },
      {
        title: 'Startup Founders Meetup',
        description: 'Casual evening networking event for startup founders, investors, and aspiring entrepreneurs to connect.',
        category: 'Networking',
        date: '2026-08-30',
        time: '18:30',
        location: 'The Rooftop Lounge',
        capacity: 80,
        bookedCount: 0,
        status: 'published'
      },
      {
        title: 'Weekend Photography Walk',
        description: 'A relaxed weekend workshop for beginners and hobbyists to learn street photography basics while exploring the old town.',
        category: 'Workshop',
        date: '2026-09-20',
        time: '08:00',
        location: 'Old Town Square',
        capacity: 25,
        bookedCount: 0,
        status: 'published'
      },
      {
        title: 'Local Basketball Championship Finals',
        description: 'Cheer on the top two teams as they battle it out for the city championship trophy.',
        category: 'Sports',
        date: '2026-09-27',
        time: '19:00',
        location: 'Downtown Sports Arena',
        capacity: 300,
        bookedCount: 0,
        status: 'published'
      }
    ]);
    console.log('Seeded sample events.');
  }
}

module.exports = seedDatabase;
