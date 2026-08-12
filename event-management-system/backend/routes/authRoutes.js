const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Club = require('../models/Club');
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
    id: user.id || user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    clubId: user.clubId ? String(user.clubId) : null,
    department: user.department || '',
    year: user.year || '',
    studentId: user.studentId || '',
    avatarUrl: user.avatarUrl || '',
    emailVerified: user.emailVerified !== false,
    authProvider: user.authProvider || 'local'
  };
}

function normalizeRequestedRole(value) {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'student' || role === 'user') return 'user';
  if (role === 'organizer') return 'organizer';
  if (role === 'club_head' || role === 'club head' || role === 'clubhead') return 'club_head';
  if (role === 'college_admin' || role === 'college admin' || role === 'admin') return 'admin';
  return role;
}

function roleLabel(role) {
  if (role === 'user') return 'Student';
  if (role === 'organizer') return 'Organizer';
  if (role === 'club_head') return 'Club Head';
  if (role === 'admin') return 'College Admin';
  return role;
}

router.post('/register', authLimiter, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const studentId = String(req.body.studentId || '').trim();
    const department = String(req.body.department || '').trim();
    const year = String(req.body.year || '').trim();

    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required.' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });

    // Public registration is Student-only. Privileged roles are assigned by College Admin.
    const requestedRole = normalizeRequestedRole(req.body.role);
    if (requestedRole && requestedRole !== 'user') {
      return res.status(403).json({ message: `${roleLabel(requestedRole)} accounts cannot be created publicly. Create a Student account first and contact College Admin for role assignment.` });
    }
    const role = 'user';

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'An account with this email already exists.' });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      studentId,
      department,
      year,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      emailVerified: false,
      authProvider: 'local',
      role,
      status: 'active'
    });

    sendWelcomeEmail(name, email).catch((err) => console.error('WELCOME EMAIL ERROR:', err.message));
    sendVerificationEmail(name, email, verificationToken).catch((err) => console.error('VERIFICATION EMAIL ERROR:', err.message));

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
    const requestedRole = normalizeRequestedRole(req.body.requestedRole);
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

    if (requestedRole && !['user', 'organizer', 'club_head', 'admin'].includes(requestedRole)) {
      return res.status(400).json({ message: 'Invalid login role selected.' });
    }

    // Role strict check requirement from prompt:
    if (requestedRole && user.role !== requestedRole) {
      return res.status(403).json({
        message: `This account is registered as ${roleLabel(user.role)}. Please choose ${roleLabel(user.role)} to continue.`,
        roleMismatch: true,
        actualRole: user.role
      });
    }

    const token = generateToken(user);
    res.json({ message: 'Login successful.', token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Server error during login.' });
  }
});

router.post('/google', authLimiter, async (req, res) => {
  try {
    if (!googleClient) return res.status(500).json({ message: 'Google Sign-In is not configured on this server.' });
    const { credential } = req.body;
    const requestedRole = normalizeRequestedRole(req.body.requestedRole);
    if (!credential) return res.status(400).json({ message: 'Missing Google credential.' });

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const { sub: googleId, email: googleEmail, name, email_verified: googleEmailVerified } = payload;
    const email = String(googleEmail || '').trim().toLowerCase();
    if (!email || !googleEmailVerified) return res.status(401).json({ message: 'Google account email is not verified.' });

    let user = await User.findOne({ googleId });
    if (!user) user = await User.findOne({ email });
    if (user) {
      if (requestedRole && user.role !== requestedRole) {
        return res.status(403).json({
          message: `This account is registered as ${roleLabel(user.role)}. Please choose ${roleLabel(user.role)} to continue.`,
          roleMismatch: true,
          actualRole: user.role
        });
      }
      user.googleId = googleId;
      user.authProvider = 'google';
      user.emailVerified = true;
      await user.save();
    } else {
      if (requestedRole && requestedRole !== 'user') {
        return res.status(403).json({
          message: 'New accounts start as Student. An admin can assign Organizer, Club Head, or Admin access after your account is created.',
          roleMismatch: true,
          actualRole: 'user'
        });
      }
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
    res.status(401).json({ message: 'Google sign-in failed.', error: err.message });
  }
});

router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json({ user: publicUser(user) });
});

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
    res.status(500).json({ message: 'Server error resetting password.' });
  }
});

module.exports = router;
