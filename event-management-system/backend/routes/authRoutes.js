const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { generateToken } = require('../utils/auth');
const { protect } = require('../middleware/authMiddleware');
const {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail
} = require('../utils/email');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl || '',
    emailVerified: user.emailVerified !== false,
    authProvider: user.authProvider || 'local'
  };
}

router.post('/register', authLimiter, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required.' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'An account with this email already exists.' });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      emailVerified: false,
      authProvider: 'local',
      role: 'user',
      status: 'active'
    });

    sendWelcomeEmail(name, email).catch((err) => console.error('WELCOME EMAIL ERROR:', err.message));
    sendVerificationEmail(name, email, verificationToken).catch((err) => console.error('VERIFICATION EMAIL ERROR:', err.message));

    // Do not establish a logged-in session until the email is verified.
    res.status(201).json({
      message: 'Registration successful. Check your inbox to verify your email.',
      requiresVerification: true,
      user: publicUser(newUser)
    });
  } catch (err) {
    console.error('REGISTRATION ERROR:', err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password.' });
    if (user.status === 'blocked') return res.status(403).json({ message: 'Your account has been blocked. Contact admin.' });
    if (user.authProvider === 'google' && !user.password) return res.status(400).json({ message: 'This account uses Google Sign-In. Please continue with Google.' });
    if (user.emailVerified === false) {
      return res.status(403).json({
        message: 'Please verify your email before signing in.',
        requiresVerification: true,
        email: user.email
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password.' });

    const token = generateToken(user);
    res.json({ message: 'Login successful.', token, user: publicUser(user) });
  } catch (err) {
    console.error(req.method, req.originalUrl, err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

router.post('/google', authLimiter, async (req, res) => {
  try {
    if (!googleClient) return res.status(500).json({ message: 'Google Sign-In is not configured on this server.' });
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: 'Missing Google credential.' });

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const { sub: googleId, email: googleEmail, name, email_verified: googleEmailVerified } = payload;
    const email = String(googleEmail || '').trim().toLowerCase();
    if (!email || !googleEmailVerified) return res.status(401).json({ message: 'Google account email is not verified.' });

    let user = await User.findOne({ googleId });
    if (!user) user = await User.findOne({ email });
    if (user) {
      user.googleId = googleId;
      user.authProvider = 'google';
      user.emailVerified = true;
      await user.save();
    } else {
      user = await User.create({
        name: String(name || email.split('@')[0]).trim(),
        email,
        googleId,
        authProvider: 'google',
        emailVerified: true,
        role: 'user',
        status: 'active'
      });
    }

    if (user.status === 'blocked') return res.status(403).json({ message: 'Your account has been blocked. Contact admin.' });
    const token = generateToken(user);
    res.json({ message: 'Google sign-in successful.', token, user: publicUser(user) });
  } catch (err) {
    res.status(401).json({ message: 'Google sign-in failed.' });
  }
});

router.get('/me', protect, (req, res) => res.json({ user: req.user }));

router.get('/verify-email', async (req, res) => {
  try {
    const token = String(req.query.token || '');
    if (!token) return res.status(400).json({ message: 'This verification link is invalid or expired.' });
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    }).select('+emailVerificationToken +emailVerificationExpires');
    if (!user) return res.status(400).json({ message: 'This verification link is invalid or expired.' });
    user.emailVerified = true;
    user.emailVerificationToken = '';
    user.emailVerificationExpires = null;
    await user.save();
    res.json({ message: 'Email verified. You can now sign in.' });
  } catch (err) {
    console.error(req.method, req.originalUrl, err);
    res.status(500).json({ message: 'Server error verifying email.' });
  }
});

router.post('/resend-verification', authLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email });
    if (user && user.authProvider !== 'google' && user.emailVerified === false) {
      const token = crypto.randomBytes(32).toString('hex');
      user.emailVerificationToken = token;
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save();
      sendVerificationEmail(user.name, user.email, token).catch((err) => console.error('VERIFICATION EMAIL ERROR:', err.message));
    }
    res.json({ message: 'If an unverified account exists, a new verification email has been sent.' });
  } catch (err) {
    res.json({ message: 'If an unverified account exists, a new verification email has been sent.' });
  }
});

router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email });
    if (user && user.authProvider !== 'google') {
      const token = crypto.randomBytes(32).toString('hex');
      user.passwordResetToken = token;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      sendPasswordResetEmail(user.name, user.email, token).catch((err) => console.error('PASSWORD RESET EMAIL ERROR:', err.message));
    }
    res.json({ message: 'If an account exists for that email, reset instructions have been sent.' });
  } catch (err) {
    res.json({ message: 'If an account exists for that email, reset instructions have been sent.' });
  }
});

router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (!token || password.length < 6) return res.status(400).json({ message: 'A valid token and password of at least 6 characters are required.' });
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    }).select('+passwordResetToken +passwordResetExpires');
    if (!user) return res.status(400).json({ message: 'This reset link is invalid or expired.' });
    user.password = await bcrypt.hash(password, 10);
    user.authProvider = 'local';
    user.passwordResetToken = '';
    user.passwordResetExpires = null;
    await user.save();
    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    console.error(req.method, req.originalUrl, err);
    res.status(500).json({ message: 'Server error resetting password.' });
  }
});

module.exports = router;
