jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => { req.user = { ...global.__testUser }; next(); },
  adminOnly: (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Admin access required.' }))
}));
jest.mock('../../models/User', () => ({ findById: jest.fn(), findOne: jest.fn(), find: jest.fn() }));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const userRoutes = require('../../routes/userRoutes');
const { createApp, queryStub, rejectingQueryStub } = require('../helpers/testApp');

const app = createApp('/api/users', userRoutes);
const CURRENT_PASSWORD_HASH = bcrypt.hashSync('current-password', 4);

function userDoc(overrides = {}) {
  return {
    id: 'user-1',
    name: 'Ann',
    email: 'ann@example.com',
    role: 'user',
    status: 'active',
    avatarUrl: '',
    password: CURRENT_PASSWORD_HASH,
    save: jest.fn().mockResolvedValue(undefined),
    deleteOne: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

beforeEach(() => {
  global.__testUser = { id: 'user-1', name: 'Ann', email: 'ann@example.com', role: 'user' };
});

describe('GET /api/users/me', () => {
  it('returns the caller profile', async () => {
    User.findById.mockResolvedValue(userDoc());

    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ann@example.com');
  });

  it('404s when the account has disappeared', async () => {
    User.findById.mockResolvedValue(null);

    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(404);
  });

  it('500s when the lookup fails', async () => {
    User.findById.mockRejectedValue(new Error('db down'));

    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/users/me', () => {
  it('trims the new name', async () => {
    const user = userDoc();
    User.findById.mockResolvedValue(user);

    const res = await request(app).put('/api/users/me').send({ name: '  Annabel  ' });

    expect(res.status).toBe(200);
    expect(user.name).toBe('Annabel');
    expect(user.save).toHaveBeenCalled();
  });

  it('400s on a blank name', async () => {
    User.findById.mockResolvedValue(userDoc());

    const res = await request(app).put('/api/users/me').send({ name: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Name cannot be empty.');
  });

  it('normalizes a new email to lowercase', async () => {
    const user = userDoc();
    User.findById.mockResolvedValue(user);
    User.findOne.mockResolvedValue(null);

    const res = await request(app).put('/api/users/me').send({ email: '  NEW@Example.COM ' });

    expect(res.status).toBe(200);
    expect(user.email).toBe('new@example.com');
    expect(User.findOne).toHaveBeenCalledWith({ email: 'new@example.com', _id: { $ne: 'user-1' } });
  });

  it('skips the uniqueness check when the email is unchanged', async () => {
    User.findById.mockResolvedValue(userDoc());

    await request(app).put('/api/users/me').send({ email: 'ANN@example.com' });

    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('409s when the new email is taken', async () => {
    User.findById.mockResolvedValue(userDoc());
    User.findOne.mockResolvedValue({ id: 'other' });

    const res = await request(app).put('/api/users/me').send({ email: 'taken@example.com' });

    expect(res.status).toBe(409);
  });

  it.each(['pixel', 'berry', 'hacker', 'ocean'])('persists the independent chat avatar %s', async (chatAvatarId) => {
    const user = userDoc({ chatAvatarId: '' });
    User.findById.mockResolvedValue(user);

    const res = await request(app).put('/api/users/me').send({ chatAvatarId });

    expect(res.status).toBe(200);
    expect(user.chatAvatarId).toBe(chatAvatarId);
    expect(user.avatarUrl).toBe('');
    expect(user.chatAvatarUrl).toBe('');
    expect(res.body.user.chatAvatarId).toBe(chatAvatarId);
  });

  it('rejects an unknown chat avatar without changing the normal profile photo', async () => {
    const user = userDoc({ avatarUrl: 'https://cdn.example.com/profile.jpg', chatAvatarId: '' });
    User.findById.mockResolvedValue(user);

    const res = await request(app).put('/api/users/me').send({ chatAvatarId: 'not-a-campus-character' });

    expect(res.status).toBe(400);
    expect(user.chatAvatarId).toBe('');
    expect(user.avatarUrl).toBe('https://cdn.example.com/profile.jpg');
  });

  it.each([
    'https://cdn.example.com/a.png',
    'data:image/png;base64,iVBORw0KGgo=',
    ''
  ])('accepts avatar %s', async (avatarUrl) => {
    const user = userDoc();
    User.findById.mockResolvedValue(user);

    const res = await request(app).put('/api/users/me').send({ avatarUrl });

    expect(res.status).toBe(200);
    expect(user.avatarUrl).toBe(avatarUrl);
  });

  it.each(['javascript:alert(1)', 'data:image/gif;base64,AAAA', 'not a url'])(
    'rejects avatar %s',
    async (avatarUrl) => {
      User.findById.mockResolvedValue(userDoc());

      const res = await request(app).put('/api/users/me').send({ avatarUrl });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Avatar must be/);
    }
  );

  it('rejects an avatar larger than 2 MB', async () => {
    User.findById.mockResolvedValue(userDoc());
    const avatarUrl = `data:image/png;base64,${'A'.repeat(2 * 1024 * 1024)}`;

    const res = await request(app).put('/api/users/me').send({ avatarUrl });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/2 MB or smaller/);
  });

  it('hashes a new password after checking the current one', async () => {
    const user = userDoc();
    User.findById.mockResolvedValue(user);

    const res = await request(app)
      .put('/api/users/me')
      .send({ password: 'new-password', currentPassword: 'current-password' });

    expect(res.status).toBe(200);
    expect(user.password).not.toBe(CURRENT_PASSWORD_HASH);
    expect(bcrypt.compareSync('new-password', user.password)).toBe(true);
  });

  it('400s when the account has no password yet', async () => {
    User.findById.mockResolvedValue(userDoc({ password: undefined }));

    const res = await request(app).put('/api/users/me').send({ password: 'new-password' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/reset-password flow/);
  });

  it('400s when the current password is missing', async () => {
    User.findById.mockResolvedValue(userDoc());

    const res = await request(app).put('/api/users/me').send({ password: 'new-password' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Current password is required/);
  });

  it('401s when the current password is wrong', async () => {
    User.findById.mockResolvedValue(userDoc());

    const res = await request(app)
      .put('/api/users/me')
      .send({ password: 'new-password', currentPassword: 'wrong' });

    expect(res.status).toBe(401);
  });

  it('400s when the new password is too short', async () => {
    User.findById.mockResolvedValue(userDoc());

    const res = await request(app)
      .put('/api/users/me')
      .send({ password: 'abc', currentPassword: 'current-password' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least 6 characters/);
  });

  it('404s when the account has disappeared', async () => {
    User.findById.mockResolvedValue(null);

    const res = await request(app).put('/api/users/me').send({ name: 'Ann' });

    expect(res.status).toBe(404);
  });

  it('500s when saving fails', async () => {
    const user = userDoc();
    user.save.mockRejectedValue(new Error('db down'));
    User.findById.mockResolvedValue(user);

    const res = await request(app).put('/api/users/me').send({ name: 'Ann' });

    expect(res.status).toBe(500);
  });
});

describe('admin user management', () => {
  beforeEach(() => {
    global.__testUser = { id: 'admin-1', name: 'Root', email: 'root@x.com', role: 'admin' };
  });

  it('lists users newest first', async () => {
    const stub = queryStub([{ id: 'u1' }]);
    User.find.mockReturnValue(stub);

    const res = await request(app).get('/api/users');

    expect(res.status).toBe(200);
    expect(stub.sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('403s listing users for a non-admin', async () => {
    global.__testUser = { id: 'user-1', name: 'Ann', email: 'ann@example.com', role: 'user' };

    const res = await request(app).get('/api/users');

    expect(res.status).toBe(403);
  });

  it('500s when listing fails', async () => {
    User.find.mockReturnValue(rejectingQueryStub(new Error('db down')));

    const res = await request(app).get('/api/users');

    expect(res.status).toBe(500);
  });

  it('updates role and status', async () => {
    const target = userDoc({ id: 'user-2' });
    User.findById.mockResolvedValue(target);

    const res = await request(app).put('/api/users/user-2').send({ role: 'organizer', status: 'blocked' });

    expect(res.status).toBe(200);
    expect(target.role).toBe('organizer');
    expect(target.status).toBe('blocked');
  });

  it('ignores unsupported role and status values', async () => {
    const target = userDoc({ id: 'user-2' });
    User.findById.mockResolvedValue(target);

    await request(app).put('/api/users/user-2').send({ role: 'superuser', status: 'frozen' });

    expect(target.role).toBe('user');
    expect(target.status).toBe('active');
  });

  it('404s updating an unknown user', async () => {
    User.findById.mockResolvedValue(null);

    const res = await request(app).put('/api/users/ghost').send({ role: 'admin' });

    expect(res.status).toBe(404);
  });

  it('500s when the update fails', async () => {
    const target = userDoc({ id: 'user-2' });
    target.save.mockRejectedValue(new Error('db down'));
    User.findById.mockResolvedValue(target);

    const res = await request(app).put('/api/users/user-2').send({ role: 'admin' });

    expect(res.status).toBe(500);
  });

  it('deletes another user', async () => {
    const target = userDoc({ id: 'user-2' });
    User.findById.mockResolvedValue(target);

    const res = await request(app).delete('/api/users/user-2');

    expect(res.status).toBe(200);
    expect(target.deleteOne).toHaveBeenCalled();
  });

  it('refuses to delete the caller own account', async () => {
    const target = userDoc({ id: 'admin-1' });
    User.findById.mockResolvedValue(target);

    const res = await request(app).delete('/api/users/admin-1');

    expect(res.status).toBe(400);
    expect(target.deleteOne).not.toHaveBeenCalled();
  });

  it('404s deleting an unknown user', async () => {
    User.findById.mockResolvedValue(null);

    const res = await request(app).delete('/api/users/ghost');

    expect(res.status).toBe(404);
  });

  it('500s when the delete fails', async () => {
    const target = userDoc({ id: 'user-2' });
    target.deleteOne.mockRejectedValue(new Error('db down'));
    User.findById.mockResolvedValue(target);

    const res = await request(app).delete('/api/users/user-2');

    expect(res.status).toBe(500);
  });
});
