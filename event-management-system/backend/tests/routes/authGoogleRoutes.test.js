process.env.GOOGLE_CLIENT_ID = 'google-client-id';

const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken: mockVerifyIdToken }))
}));
jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => { req.user = { id: 'user-1' }; next(); },
  adminOnly: (req, res, next) => next()
}));
jest.mock('../../middleware/rateLimiter', () => ({
  authLimiter: (req, res, next) => next(),
  contactLimiter: (req, res, next) => next()
}));
jest.mock('../../models/User', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../../utils/email', () => ({
  sendWelcomeEmail: jest.fn(),
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn()
}));

const request = require('supertest');
const User = require('../../models/User');
const { verifyToken } = require('../../utils/auth');
const authRoutes = require('../../routes/authRoutes');
const { createApp } = require('../helpers/testApp');

const app = createApp('/api/auth', authRoutes);

function payload(overrides = {}) {
  return { sub: 'google-1', email: ' Ann@Example.com ', name: 'Ann', email_verified: true, ...overrides };
}

function userDoc(overrides = {}) {
  return {
    id: 'user-1',
    name: 'Ann',
    email: 'ann@example.com',
    role: 'user',
    status: 'active',
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

beforeEach(() => {
  mockVerifyIdToken.mockReset();
});

it('verifies the credential against the configured client id', async () => {
  mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload() });
  User.findOne.mockResolvedValue(userDoc());

  const res = await request(app).post('/api/auth/google').send({ credential: 'id-token' });

  expect(res.status).toBe(200);
  expect(mockVerifyIdToken).toHaveBeenCalledWith({ idToken: 'id-token', audience: 'google-client-id' });
  expect(verifyToken(res.body.token)).toMatchObject({ id: 'user-1', email: 'ann@example.com' });
});

it('links an existing local account to Google and marks the email verified', async () => {
  mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload() });
  const user = userDoc({ authProvider: 'local', emailVerified: false });
  User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(user);

  const res = await request(app).post('/api/auth/google').send({ credential: 'id-token' });

  expect(res.status).toBe(200);
  expect(User.findOne).toHaveBeenNthCalledWith(1, { googleId: 'google-1' });
  expect(User.findOne).toHaveBeenNthCalledWith(2, { email: 'ann@example.com' });
  expect(user).toMatchObject({ googleId: 'google-1', authProvider: 'google', emailVerified: true });
  expect(user.save).toHaveBeenCalled();
});

it('creates a new verified account for a first-time Google user', async () => {
  mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload({ name: '' }) });
  User.findOne.mockResolvedValue(null);
  User.create.mockImplementation(async (doc) => userDoc(doc));

  const res = await request(app).post('/api/auth/google').send({ credential: 'id-token' });

  expect(res.status).toBe(200);
  expect(User.create).toHaveBeenCalledWith({
    name: 'ann',
    email: 'ann@example.com',
    googleId: 'google-1',
    authProvider: 'google',
    emailVerified: true,
    role: 'user',
    status: 'active'
  });
});

it('400s without a credential', async () => {
  const res = await request(app).post('/api/auth/google').send({});

  expect(res.status).toBe(400);
  expect(mockVerifyIdToken).not.toHaveBeenCalled();
});

it.each([
  ['the Google email is unverified', payload({ email_verified: false })],
  ['Google returns no email', payload({ email: '' })]
])('401s when %s', async (_label, value) => {
  mockVerifyIdToken.mockResolvedValue({ getPayload: () => value });

  const res = await request(app).post('/api/auth/google').send({ credential: 'id-token' });

  expect(res.status).toBe(401);
});

it('401s when the credential cannot be verified', async () => {
  mockVerifyIdToken.mockRejectedValue(new Error('bad token'));

  const res = await request(app).post('/api/auth/google').send({ credential: 'id-token' });

  expect(res.status).toBe(401);
  expect(res.body.message).toBe('Google sign-in failed.');
});

it('403s for a blocked account', async () => {
  mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload() });
  User.findOne.mockResolvedValue(userDoc({ status: 'blocked' }));

  const res = await request(app).post('/api/auth/google').send({ credential: 'id-token' });

  expect(res.status).toBe(403);
});
