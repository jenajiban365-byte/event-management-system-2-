jest.mock('../../utils/email', () => ({ sendContactFormEmail: jest.fn() }));
jest.mock('../../middleware/rateLimiter', () => ({
  contactLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next()
}));

const request = require('supertest');
const { sendContactFormEmail } = require('../../utils/email');
const contactRoutes = require('../../routes/contactRoutes');
const { createApp } = require('../helpers/testApp');

const app = createApp('/api/contact', contactRoutes);
const validBody = { name: 'Bob', email: 'bob@example.com', subject: 'Hello', message: 'Hi there' };

beforeEach(() => {
  sendContactFormEmail.mockResolvedValue(undefined);
});

describe('POST /api/contact', () => {
  it('sends the message with trimmed fields', async () => {
    const res = await request(app).post('/api/contact').send({
      name: '  Bob  ',
      email: 'bob@example.com',
      subject: ' Hello ',
      message: ' Hi there '
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Thanks for reaching out/);
    expect(sendContactFormEmail).toHaveBeenCalledWith('Bob', 'bob@example.com', 'Hello', 'Hi there');
  });

  it.each(['name', 'email', 'subject', 'message'])('rejects a missing %s', async (field) => {
    const body = { ...validBody };
    delete body[field];

    const res = await request(app).post('/api/contact').send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Name, email, subject, and message are all required.');
    expect(sendContactFormEmail).not.toHaveBeenCalled();
  });

  // Email is validated before trimming, so surrounding whitespace is rejected.
  it.each(['not-an-email', 'missing@domain', 'spaced @example.com', ' bob@example.com '])('rejects invalid email %s', async (email) => {
    const res = await request(app).post('/api/contact').send({ ...validBody, email });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Please enter a valid email address.');
  });

  it('rejects a message longer than 5000 characters', async () => {
    const res = await request(app).post('/api/contact').send({ ...validBody, message: 'a'.repeat(5001) });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Message is too long/);
  });

  it.each(['name', 'subject'])('rejects a %s longer than 200 characters', async (field) => {
    const res = await request(app).post('/api/contact').send({ ...validBody, [field]: 'a'.repeat(201) });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Name/subject is too long.');
  });

  it('returns 500 when the email transport fails', async () => {
    sendContactFormEmail.mockRejectedValue(new Error('brevo down'));

    const res = await request(app).post('/api/contact').send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('brevo down');
  });
});
