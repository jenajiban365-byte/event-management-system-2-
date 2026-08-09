const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const router = express.Router();

function validAvatar(value) {
  if (!value) return true;
  return /^(https?:\/\/[^\s]+|data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+)$/i.test(value);
}

router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user });
  } catch (err) { res.status(500).json({ message: 'Server error fetching profile.', error: err.message }); }
});

router.put('/me', protect, async (req, res) => {
  try {
    const { name, email, password, currentPassword, avatarUrl } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ message: 'Name cannot be empty.' });
      user.name = trimmed;
    }
    if (email && email.toLowerCase().trim() !== user.email.toLowerCase()) {
      const normalized = email.toLowerCase().trim();
      const taken = await User.findOne({ email: normalized, _id: { $ne: user.id } });
      if (taken) return res.status(409).json({ message: 'Email already in use.' });
      user.email = normalized;
    }
    if (avatarUrl !== undefined) {
      const avatar = String(avatarUrl || '');
      if (!validAvatar(avatar)) return res.status(400).json({ message: 'Avatar must be an image URL or an encoded PNG, JPG, or WebP image.' });
      if (avatar.length > 2 * 1024 * 1024) {
  return res.status(400).json({ message: 'Avatar image must be 2 MB or smaller.' });
}
      user.avatarUrl = avatar;
    }
    if (password) {
      if (!user.password) return res.status(400).json({ message: 'Set a password using the reset-password flow first.' });
      if (!currentPassword) return res.status(400).json({ message: 'Current password is required to set a new password.' });
      if (!(await bcrypt.compare(currentPassword, user.password))) return res.status(401).json({ message: 'Current password is incorrect.' });
      if (password.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters.' });
      user.password = await bcrypt.hash(password, 10);
    }
    await user.save();
    res.json({ message: 'Profile updated.', user });
  } catch (err) { res.status(500).json({ message: 'Server error updating profile.', error: err.message }); }
});

router.get('/', protect, adminOnly, async (req, res) => {
  try { res.json({ users: await User.find().sort({ createdAt: -1 }) }); }
  catch (err) { res.status(500).json({ message: 'Server error fetching users.', error: err.message }); }
});
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { role, status } = req.body; const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    if (role && ['user', 'admin'].includes(role)) target.role = role;
    if (status && ['active', 'blocked'].includes(status)) target.status = status;
    await target.save(); res.json({ message: 'User updated.', user: target });
  } catch (err) { res.status(500).json({ message: 'Server error updating user.', error: err.message }); }
});
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const target = await User.findById(req.params.id); if (!target) return res.status(404).json({ message: 'User not found.' });
    if (target.id === req.user.id) return res.status(400).json({ message: 'You cannot delete your own account.' });
    await target.deleteOne(); res.json({ message: 'User deleted.' });
  } catch (err) { res.status(500).json({ message: 'Server error deleting user.', error: err.message }); }
});
module.exports = router;
