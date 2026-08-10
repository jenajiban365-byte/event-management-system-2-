const express = require('express');
const { sendContactFormEmail } = require('../utils/email');
const { contactLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// @route  POST /api/contact
// @desc   Public: submit the contact form, emails the site owner
router.post('/', contactLimiter, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'Name, email, subject, and message are all required.' });
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }
    if (message.length > 5000) {
      return res.status(400).json({ message: 'Message is too long (max 5000 characters).' });
    }
    if (name.length > 200 || subject.length > 200) {
      return res.status(400).json({ message: 'Name/subject is too long.' });
    }

    await sendContactFormEmail(name.trim(), email.trim(), subject.trim(), message.trim());
    res.json({ message: "Thanks for reaching out — we'll get back to you soon." });
  } catch (err) {
    console.error(req.method, req.originalUrl, err);
    res.status(500).json({ message: 'Something went wrong sending your message. Please try again later.' });
  }
});

module.exports = router;
