const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// @route  GET /api/users/me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching profile.', error: err.message });
  }
});

// @route  PUT /api/users/me
router.put('/me', protect, async (req, res) => {
  try {
    const { name, email, password, currentPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (name) user.name = name;
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const taken = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user.id } });
      if (taken) return res.status(409).json({ message: 'Email already in use.' });
      user.email = email;
    }

    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to set a new password.' });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters.' });
      }
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();
    res.json({ message: 'Profile updated.', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error updating profile.', error: err.message });
  }
});

// @route  GET /api/users
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching users.', error: err.message });
  }
});

// @route  PUT /api/users/:id
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { role, status } = req.body;
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found.' });

    if (role && ['user', 'admin'].includes(role)) target.role = role;
    if (status && ['active', 'blocked'].includes(status)) target.status = status;

    await target.save();
    res.json({ message: 'User updated.', user: target });
  } catch (err) {
    res.status(500).json({ message: 'Server error updating user.', error: err.message });
  }
});

// @route  DELETE /api/users/:id
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    if (target.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }
    await target.deleteOne();
    res.json({ message: 'User deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error deleting user.', error: err.message });
  }
});

module.exports = router;
