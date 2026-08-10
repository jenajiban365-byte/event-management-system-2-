jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => { req.user = { id: 'user-1', name: 'Ann', email: 'ann@example.com', role: 'user' }; next(); },
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
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const { sendWelcomeEmail, sendVerificationEmail, sendPasswordResetEmail } = require('../../utils/email');
const { verifyToken } = require('../../utils/auth');
const authRoutes = require('../../routes/authRoutes');
const { createApp, queryStub } = require('../helpers/testApp');

const app = createApp('/api/auth', authRoutes);
const PASSWORD_HASH = bcrypt.hashSync('secret123', 4);

function userDoc(overrides = {}) {
  return {
    id: 'user-1',
    name: 'Ann',
    email: 'ann@example.com',
    password: PASSWORD_HASH,
    role: 'user',
    status: 'active',
    emailVerified: true,
    authProvider: 'local',
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  sendWelcomeEmail.mockResolvedValue(undefined);
  sendVerificationEmail.mockResolvedValue(undefined);
  sendPasswordResetEmail.mockResolvedValue(undefined);
});

describe('POST /api/auth/register', () => {
  it('creates an unverified local account and triggers both emails', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockImplementation(async (doc) => ({ id: 'user-9', ...doc }));

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '  Ann  ', email: '  ANN@Example.com ', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body.requiresVerification).toBe(true);
    expect(res.body.token).toBeUndefined();

    const created = User.create.mock.calls[0][0];
    expect(created).toMatchObject({ name: 'Ann', email: 'ann@example.com', emailVerified: false, role: 'user', authProvider: 'local' });
    expect(created.password).not.toBe('secret123');
    expect(bcrypt.compareSync('secret123', created.password)).toBe(true);
    expect(created.emailVerificationToken).toHaveLength(64);
    expect(created.emailVerificationExpires.getTime()).toBeGreaterThan(Date.now());

    expect(sendWelcomeEmail).toHaveBeenCalledWith('Ann', 'ann@example.com');
    expect(sendVerificationEmail).toHaveBeenCalledWith('Ann', 'ann@example.com', created.emailVerificationToken);
  });

  it('still registers when the emails fail to send', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockImplementation(async (doc) => ({ id: 'user-9', ...doc }));
    sendWelcomeEmail.mockRejectedValue(new Error('brevo down'));
    sendVerificationEmail.mockRejectedValue(new Error('brevo down'));

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ann', email: 'ann@example.com', password: 'secret123' });

    expect(res.status).toBe(201);
  });

  it.each([
    [{ email: 'a@b.com', password: 'secret123' }],
    [{ name: 'Ann', password: 'secret123' }],
    [{ name: 'Ann', email: 'a@b.com' }]
  ])('400s on incomplete payload %#', async (body) => {
    const res = await request(app).post('/api/auth/register').send(body);

    expect(res.status).toBe(400);
    expect(User.create).not.toHaveBeenCalled();
  });

  it('400s for a password shorter than 6 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ann', email: 'a@b.com', password: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least 6 characters/);
  });

  it('409s when the email is already registered', async () => {
    User.findOne.mockResolvedValue(userDoc());

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ann', email: 'ann@example.com', password: 'secret123' });

    expect(res.status).toBe(409);
  });

  it('500s when the insert fails', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockRejectedValue(new Error('db down'));

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ann', email: 'ann@example.com', password: 'secret123' });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/auth/login', () => {
  it('returns a signed token and the public user for valid credentials', async () => {
    User.findOne.mockResolvedValue(userDoc());

    const res = await request(app).post('/api/auth/login').send({ email: 'ANN@example.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(User.findOne).toHaveBeenCalledWith({ email: 'ann@example.com' });
    expect(verifyToken(res.body.token)).toMatchObject({ id: 'user-1', email: 'ann@example.com', role: 'user' });
    expect(res.body.user).toEqual({
      id: 'user-1',
      name: 'Ann',
      email: 'ann@example.com',
      role: 'user',
      avatarUrl: '',
      emailVerified: true,
      authProvider: 'local'
    });
    expect(res.body.user.password).toBeUndefined();
  });

  it('400s when credentials are missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ann@example.com' });

    expect(res.status).toBe(400);
  });

  it('401s for an unknown email', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'secret123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password.');
  });

  it('401s for a wrong password, with the same message as an unknown email', async () => {
    User.findOne.mockResolvedValue(userDoc());

    const res = await request(app).post('/api/auth/login').send({ email: 'ann@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password.');
  });

  it('403s for a blocked account', async () => {
    User.findOne.mockResolvedValue(userDoc({ status: 'blocked' }));

    const res = await request(app).post('/api/auth/login').send({ email: 'ann@example.com', password: 'secret123' });

    expect(res.status).toBe(403);
  });

  it('400s for a Google-only account with no password', async () => {
    User.findOne.mockResolvedValue(userDoc({ authProvider: 'google', password: undefined }));

    const res = await request(app).post('/api/auth/login').send({ email: 'ann@example.com', password: 'secret123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Google Sign-In/);
  });

  it('403s and flags verification for an unverified account', async () => {
    User.findOne.mockResolvedValue(userDoc({ emailVerified: false }));

    const res = await request(app).post('/api/auth/login').send({ email: 'ann@example.com', password: 'secret123' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ requiresVerification: true, email: 'ann@example.com' });
  });

  it('500s when the lookup fails', async () => {
    User.findOne.mockRejectedValue(new Error('db down'));

    const res = await request(app).post('/api/auth/login').send({ email: 'ann@example.com', password: 'secret123' });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/auth/google', () => {
  it('500s when Google Sign-In is not configured', async () => {
    const res = await request(app).post('/api/auth/google').send({ credential: 'abc' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/not configured/);
  });
});

describe('GET /api/auth/me', () => {
  it('echoes the authenticated user', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: 'user-1', email: 'ann@example.com' });
  });
});

describe('GET /api/auth/verify-email', () => {
  it('marks the account verified and clears the token', async () => {
    const user = userDoc({ emailVerified: false, emailVerificationToken: 'tok', emailVerificationExpires: new Date() });
    User.findOne.mockReturnValue(queryStub(user));

    const res = await request(app).get('/api/auth/verify-email').query({ token: 'tok' });

    expect(res.status).toBe(200);
    expect(user.emailVerified).toBe(true);
    expect(user.emailVerificationToken).toBe('');
    expect(user.emailVerificationExpires).toBeNull();
    expect(User.findOne.mock.calls[0][0].emailVerificationToken).toBe('tok');
  });

  it('400s without a token', async () => {
    const res = await request(app).get('/api/auth/verify-email');

    expect(res.status).toBe(400);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('400s for an expired or unknown token', async () => {
    User.findOne.mockReturnValue(queryStub(null));

    const res = await request(app).get('/api/auth/verify-email').query({ token: 'stale' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or expired/);
  });

  it('500s when saving fails', async () => {
    const user = userDoc({ emailVerified: false });
    user.save.mockRejectedValue(new Error('db down'));
    User.findOne.mockReturnValue(queryStub(user));

    const res = await request(app).get('/api/auth/verify-email').query({ token: 'tok' });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/auth/resend-verification', () => {
  it('issues a fresh token for an unverified local account', async () => {
    const user = userDoc({ emailVerified: false });
    User.findOne.mockResolvedValue(user);

    const res = await request(app).post('/api/auth/resend-verification').send({ email: 'ann@example.com' });

    expect(res.status).toBe(200);
    expect(user.emailVerificationToken).toHaveLength(64);
    expect(sendVerificationEmail).toHaveBeenCalledWith('Ann', 'ann@example.com', user.emailVerificationToken);
  });

  it.each([
    ['unknown email', null],
    ['already verified account', userDoc()],
    ['google account', userDoc({ authProvider: 'google', emailVerified: false })]
  ])('stays generic and sends nothing for an %s', async (_label, found) => {
    User.findOne.mockResolvedValue(found);

    const res = await request(app).post('/api/auth/resend-verification').send({ email: 'ann@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an unverified account exists/);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('still responds generically when the lookup fails', async () => {
    User.findOne.mockRejectedValue(new Error('db down'));

    const res = await request(app).post('/api/auth/resend-verification').send({ email: 'ann@example.com' });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('stores a reset token that expires in an hour', async () => {
    const user = userDoc();
    User.findOne.mockResolvedValue(user);

    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'ann@example.com' });

    expect(res.status).toBe(200);
    expect(user.passwordResetToken).toHaveLength(64);
    expect(user.passwordResetExpires.getTime()).toBeGreaterThan(Date.now());
    expect(sendPasswordResetEmail).toHaveBeenCalledWith('Ann', 'ann@example.com', user.passwordResetToken);
  });

  it('does not leak whether the account exists', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/If an account exists/);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('skips google accounts', async () => {
    User.findOne.mockResolvedValue(userDoc({ authProvider: 'google' }));

    await request(app).post('/api/auth/forgot-password').send({ email: 'ann@example.com' });

    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('still responds generically when the lookup fails', async () => {
    User.findOne.mockRejectedValue(new Error('db down'));

    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'ann@example.com' });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('hashes the new password, clears the token and restores local auth', async () => {
    const user = userDoc({ authProvider: 'google', passwordResetToken: 'tok' });
    User.findOne.mockReturnValue(queryStub(user));

    const res = await request(app).post('/api/auth/reset-password').send({ token: 'tok', password: 'brand-new' });

    expect(res.status).toBe(200);
    expect(bcrypt.compareSync('brand-new', user.password)).toBe(true);
    expect(user.authProvider).toBe('local');
    expect(user.passwordResetToken).toBe('');
    expect(user.passwordResetExpires).toBeNull();
  });

  it.each([
    [{ password: 'brand-new' }],
    [{ token: 'tok', password: 'abc' }],
    [{}]
  ])('400s on invalid payload %#', async (body) => {
    const res = await request(app).post('/api/auth/reset-password').send(body);

    expect(res.status).toBe(400);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('400s for an expired or unknown reset token', async () => {
    User.findOne.mockReturnValue(queryStub(null));

    const res = await request(app).post('/api/auth/reset-password').send({ token: 'stale', password: 'brand-new' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or expired/);
  });

  it('500s when saving fails', async () => {
    const user = userDoc();
    user.save.mockRejectedValue(new Error('db down'));
    User.findOne.mockReturnValue(queryStub(user));

    const res = await request(app).post('/api/auth/reset-password').send({ token: 'tok', password: 'brand-new' });

    expect(res.status).toBe(500);
  });
});
