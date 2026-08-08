const express = require('express');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { generateToken } = require('../utils/auth');
const { protect } = require('../middleware/authMiddleware');
const { sendWelcomeEmail } = require('../utils/email');

const router = express.Router();
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

// @route  POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'user',
      status: 'active'
    });
    sendWelcomeEmail(name, email).catch(err => {
  console.error('WELCOME EMAIL ERROR:', err);
});
    const token = generateToken(newUser);
    res.status(201).json({
      message: 'Registration successful.',
      token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
    });
  } catch (err) {
  console.error('REGISTRATION ERROR:', err);
  res.status(500).json({ message: 'Server error during registration.' });
}
});

// @route  POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ message: 'Your account has been blocked. Contact admin.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    res.json({
      message: 'Login successful.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error during login.', error: err.message });
  }
});

// @route  POST /api/auth/google
// @desc   Sign in (or auto-register) using a Google ID token from Google Identity Services
router.post('/google', async (req, res) => {
  try {
    if (!googleClient) {
      return res.status(500).json({ message: 'Google Sign-In is not configured on this server.' });
    }

    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: 'Missing Google credential.' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, email_verified: emailVerified } = payload;

    if (!emailVerified) {
      return res.status(401).json({ message: 'Google account email is not verified.' });
    }

    // Match an existing account by googleId first, then by email (to link accounts)
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        // An account with this email already exists (e.g. registered normally) — link it
        user.googleId = googleId;
        user.authProvider = 'google';
        await user.save();
      }
    }

    if (!user) {
      user = await User.create({
        name: name || email.split('@')[0],
        email,
        googleId,
        authProvider: 'google',
        role: 'user',
        status: 'active'
      });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ message: 'Your account has been blocked. Contact admin.' });
    }

    const token = generateToken(user);
    res.json({
      message: 'Google sign-in successful.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(401).json({ message: 'Google sign-in failed.', error: err.message });
  }
});

// @route  GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
