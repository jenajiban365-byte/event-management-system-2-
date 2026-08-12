jest.mock('../../utils/auth', () => ({ verifyToken: jest.fn() }));
jest.mock('../../models/User', () => ({ findById: jest.fn() }));

const { verifyToken } = require('../../utils/auth');
const User = require('../../models/User');
const { protect, adminOnly } = require('../../middleware/authMiddleware');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const activeUser = {
  id: 'u1',
  name: 'Ann',
  email: 'ann@example.com',
  role: 'user',
  status: 'active',
  avatarUrl: '',
  emailVerified: true
};

describe('protect', () => {
  it('populates req.user for a valid bearer token', async () => {
    verifyToken.mockReturnValue({ id: 'u1' });
    User.findById.mockResolvedValue(activeUser);
    const req = { headers: { authorization: 'Bearer good.token' } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(verifyToken).toHaveBeenCalledWith('good.token');
    expect(User.findById).toHaveBeenCalledWith('u1');
    expect(req.user).toEqual({
      id: 'u1',
      name: 'Ann',
      email: 'ann@example.com',
      role: 'user',
      avatarUrl: '',
      emailVerified: true
    });
    expect(next).toHaveBeenCalled();
  });

  it('defaults avatarUrl and emailVerified when absent on the user document', async () => {
    verifyToken.mockReturnValue({ id: 'u2' });
    User.findById.mockResolvedValue({ id: 'u2', name: 'B', email: 'b@x.com', role: 'admin', status: 'active' });
    const req = { headers: { authorization: 'Bearer t' } };

    await protect(req, mockRes(), jest.fn());

    expect(req.user.avatarUrl).toBe('');
    expect(req.user.emailVerified).toBe(true);
  });

  it('marks emailVerified false only when it is explicitly false', async () => {
    verifyToken.mockReturnValue({ id: 'u3' });
    User.findById.mockResolvedValue({ ...activeUser, emailVerified: false });
    const req = { headers: { authorization: 'Bearer t' } };

    await protect(req, mockRes(), jest.fn());

    expect(req.user.emailVerified).toBe(false);
  });

  it('401s when no Authorization header is present', async () => {
    const res = mockRes();
    const next = jest.fn();

    await protect({ headers: {} }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized. No token provided.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('401s when the Authorization scheme is not Bearer', async () => {
    const res = mockRes();

    await protect({ headers: { authorization: 'Basic abc' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('401s when the user behind a valid token no longer exists', async () => {
    verifyToken.mockReturnValue({ id: 'gone' });
    User.findById.mockResolvedValue(null);
    const res = mockRes();

    await protect({ headers: { authorization: 'Bearer t' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'User no longer exists.' });
  });

  it('403s for a blocked account', async () => {
    verifyToken.mockReturnValue({ id: 'u1' });
    User.findById.mockResolvedValue({ ...activeUser, status: 'blocked' });
    const res = mockRes();
    const next = jest.fn();

    await protect({ headers: { authorization: 'Bearer t' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Your account has been blocked. Contact admin.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('401s when the token cannot be verified', async () => {
    verifyToken.mockImplementation(() => { throw new Error('bad token'); });
    const res = mockRes();

    await protect({ headers: { authorization: 'Bearer t' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token.' });
  });

  it('401s when the user lookup fails', async () => {
    verifyToken.mockReturnValue({ id: 'u1' });
    User.findById.mockRejectedValue(new Error('db down'));
    const res = mockRes();

    await protect({ headers: { authorization: 'Bearer t' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('adminOnly', () => {
  it('allows admins', () => {
    const next = jest.fn();
    adminOnly({ user: { role: 'admin' } }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it.each([[{ user: { role: 'organizer' } }], [{ user: { role: 'user' } }], [{}]])(
    'rejects non-admin request %#',
    (req) => {
      const res = mockRes();
      const next = jest.fn();

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Admin access required.' });
      expect(next).not.toHaveBeenCalled();
    }
  );
});
