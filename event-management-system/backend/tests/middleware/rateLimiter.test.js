const express = require('express');
const request = require('supertest');
const { authLimiter, contactLimiter } = require('../../middleware/rateLimiter');

function appWith(limiter) {
  const app = express();
  app.post('/', limiter, (req, res) => res.json({ ok: true }));
  return app;
}

async function hit(app, times) {
  const responses = [];
  for (let i = 0; i < times; i++) responses.push(await request(app).post('/'));
  return responses;
}

describe('authLimiter', () => {
  it('allows 10 attempts then blocks the 11th with a friendly message', async () => {
    const app = appWith(authLimiter);

    const allowed = await hit(app, 10);
    expect(allowed.every((res) => res.status === 200)).toBe(true);

    const blocked = await request(app).post('/');
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/Too many attempts/);
  });

  it('exposes standard RateLimit headers and no legacy ones', async () => {
    const res = await request(appWith(authLimiter)).post('/');
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });
});

describe('contactLimiter', () => {
  it('allows 5 submissions then blocks the 6th', async () => {
    const app = appWith(contactLimiter);

    const allowed = await hit(app, 5);
    expect(allowed.every((res) => res.status === 200)).toBe(true);

    const blocked = await request(app).post('/');
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/Too many messages/);
  });
});
