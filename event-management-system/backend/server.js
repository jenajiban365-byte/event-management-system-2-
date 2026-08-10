require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const connectDB = require('./config/db');
const seedDatabase = require('./utils/seed');

const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const waitlistRoutes = require('./routes/waitlistRoutes');
const contactRoutes = require('./routes/contactRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const supportRoutes = require('./routes/supportRoutes');
const clubRoutes = require('./routes/clubRoutes');
const organizerRoutes = require('./routes/organizerRoutes');
const savedEventRoutes = require('./routes/savedEventRoutes');
const geocodeRoutes = require('./routes/geocodeRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Render (and most hosts) sit behind a reverse proxy — this tells Express to trust
// the X-Forwarded-For header so rate limiting and logging see the real visitor IP,
// not the proxy's IP for every request.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cors());
app.use(express.json({ limit: '3mb' }));

// Lightweight security headers without adding a runtime dependency. These
// protect the public app while keeping Google Sign-In and remote event images
// compatible with the existing frontend.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/organizer', organizerRoutes);
app.use('/api/saved-events', savedEventRoutes);
app.use('/api/geocode', geocodeRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Event Management API is running.' });
});

// Public, non-secret config the frontend needs (Google Client IDs are meant to be public)
app.get('/api/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null });
});

// Serve the frontend (static files) so the whole app can run from one server
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Fallback 404 handler for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found.' });
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

async function start() {
  await connectDB();
  await seedDatabase();

  app.listen(PORT, () => {
    console.log(`Event Management API server running on http://localhost:${PORT}`);
    console.log(`Frontend available at http://localhost:${PORT}`);
    console.log(`Default admin login -> email: admin@events.com | password: Admin@123`);
  });
}

start();
