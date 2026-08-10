const express = require('express');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { logError } = require('../utils/errors');

const router = express.Router();

// Nominatim's public service asks clients to keep usage light (max ~1 request/sec),
// identify the application, and cache results. This small server-side cache helps
// avoid duplicate lookups while admins are editing an event.
const cache = new Map();
let lastRequestAt = 0;

function normalizeAddress(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

router.get('/', protect, adminOnly, async (req, res) => {
  const address = String(req.query.address || '').trim();

  if (!address) {
    return res.status(400).json({ message: 'Please enter an event location.' });
  }

  if (address.length < 3) {
    return res.status(400).json({ message: 'Please enter a more complete event location.' });
  }

  const key = normalizeAddress(address);
  const cached = cache.get(key);
  if (cached) return res.json(cached);

  try {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < 1100) await wait(1100 - elapsed);
    lastRequestAt = Date.now();

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', address);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');

    const response = await fetch(url, {
      headers: {
        // Nominatim asks clients to identify themselves with a valid User-Agent.
        'User-Agent': 'EventHub/1.0 (event management website)'
      }
    });

    if (!response.ok) {
      return res.status(502).json({ message: 'Location lookup service is temporarily unavailable.' });
    }

    const results = await response.json();

    if (!Array.isArray(results) || !results.length) {
      return res.status(404).json({
        message: 'Location not found. Try adding the city, state, or country.'
      });
    }

    const result = {
      latitude: Number(results[0].lat),
      longitude: Number(results[0].lon),
      displayName: results[0].display_name || address,
      source: 'OpenStreetMap'
    };

    if (!Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
      return res.status(502).json({ message: 'The location service returned invalid coordinates.' });
    }

    cache.set(key, result);
    // Keep the small in-memory cache bounded.
    if (cache.size > 500) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    res.json(result);
  } catch (err) {
    logError('GET /api/geocode', err);
    res.status(502).json({ message: 'Could not look up this location right now.' });
  }
});

module.exports = router;
