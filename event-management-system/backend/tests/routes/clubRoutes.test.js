jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => { req.user = { ...global.__testUser }; next(); },
  adminOnly: (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Admin access required.' }))
}));
jest.mock('../../models/Club', () => ({ find: jest.fn(), findOne: jest.fn(), findById: jest.fn(), create: jest.fn() }));
jest.mock('../../models/User', () => ({ find: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../../models/Notification', () => ({ create: jest.fn(), insertMany: jest.fn() }));

const request = require('supertest');
const Club = require('../../models/Club');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const clubRoutes = require('../../routes/clubRoutes');
const { createApp, queryStub, rejectingQueryStub } = require('../helpers/testApp');

const app = createApp('/api/clubs', clubRoutes);

function clubDoc(overrides = {}) {
  const doc = {
    _id: 'club-1',
    name: 'Robotics',
    followerIds: [],
    organizerIds: [],
    createdBy: 'owner-1',
    status: 'approved',
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
  doc.toObject = () => ({ ...doc });
  return doc;
}

beforeEach(() => {
  global.__testUser = { id: 'user-1', name: 'Ann', email: 'ann@example.com', role: 'user' };
  Notification.create.mockResolvedValue({});
  Notification.insertMany.mockResolvedValue([]);
  User.findByIdAndUpdate.mockResolvedValue({});
});

describe('GET /api/clubs', () => {
  it('returns approved clubs with a follower count', async () => {
    const stub = queryStub([clubDoc({ followerIds: ['a', 'b'] })]);
    Club.find.mockReturnValue(stub);

    const res = await request(app).get('/api/clubs');

    expect(res.status).toBe(200);
    expect(Club.find).toHaveBeenCalledWith({ status: 'approved' });
    expect(stub.sort).toHaveBeenCalledWith({ name: 1 });
    expect(res.body.clubs[0].followerCount).toBe(2);
  });

  it('500s when the query fails', async () => {
    Club.find.mockReturnValue(rejectingQueryStub(new Error('db down')));

    const res = await request(app).get('/api/clubs');

    expect(res.status).toBe(500);
  });
});

describe('POST /api/clubs/request', () => {
  it('creates a pending club and notifies admins', async () => {
    Club.create.mockImplementation(async (doc) => ({ id: 'club-1', ...doc }));
    User.find.mockReturnValue(queryStub([{ _id: 'admin-1' }]));

    const res = await request(app).post('/api/clubs/request').send({ name: ' Robotics ', description: ' Bots ' });

    expect(res.status).toBe(201);
    expect(Club.create).toHaveBeenCalledWith({
      name: 'Robotics',
      description: 'Bots',
      category: 'Club',
      contactEmail: 'ann@example.com',
      createdBy: 'user-1'
    });
    expect(Notification.insertMany).toHaveBeenCalledWith([expect.objectContaining({ user: 'admin-1', type: 'club' })]);
  });

  it('400s without a name', async () => {
    const res = await request(app).post('/api/clubs/request').send({ name: '   ' });

    expect(res.status).toBe(400);
    expect(Club.create).not.toHaveBeenCalled();
  });

  it('409s on a duplicate club name', async () => {
    const err = new Error('dup');
    err.code = 11000;
    Club.create.mockRejectedValue(err);

    const res = await request(app).post('/api/clubs/request').send({ name: 'Robotics' });

    expect(res.status).toBe(409);
  });

  it('500s on any other failure', async () => {
    Club.create.mockRejectedValue(new Error('db down'));

    const res = await request(app).post('/api/clubs/request').send({ name: 'Robotics' });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/clubs/:id/follow', () => {
  it('follows a club the caller does not follow yet', async () => {
    const club = clubDoc();
    Club.findOne.mockResolvedValue(club);

    const res = await request(app).post('/api/clubs/club-1/follow');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ following: true, followerCount: 1 });
    expect(club.followerIds).toEqual(['user-1']);
  });

  it('unfollows a club the caller already follows', async () => {
    const club = clubDoc({ followerIds: ['other', 'user-1'] });
    Club.findOne.mockResolvedValue(club);

    const res = await request(app).post('/api/clubs/club-1/follow');

    expect(res.body).toEqual({ following: false, followerCount: 1 });
    expect(club.followerIds).toEqual(['other']);
  });

  it('404s for an unapproved or unknown club', async () => {
    Club.findOne.mockResolvedValue(null);

    const res = await request(app).post('/api/clubs/club-9/follow');

    expect(res.status).toBe(404);
    expect(Club.findOne).toHaveBeenCalledWith({ _id: 'club-9', status: 'approved' });
  });

  it('500s when saving fails', async () => {
    const club = clubDoc();
    club.save.mockRejectedValue(new Error('db down'));
    Club.findOne.mockResolvedValue(club);

    const res = await request(app).post('/api/clubs/club-1/follow');

    expect(res.status).toBe(500);
  });
});

describe('GET /api/clubs/admin/all', () => {
  it('returns every club for an admin', async () => {
    global.__testUser = { id: 'admin-1', name: 'Root', email: 'root@x.com', role: 'admin' };
    const stub = queryStub([clubDoc()]);
    Club.find.mockReturnValue(stub);

    const res = await request(app).get('/api/clubs/admin/all');

    expect(res.status).toBe(200);
    expect(stub.populate).toHaveBeenCalledWith('createdBy', 'name email');
  });

  it('403s for a non-admin', async () => {
    const res = await request(app).get('/api/clubs/admin/all');

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/clubs/admin/:id/status', () => {
  beforeEach(() => {
    global.__testUser = { id: 'admin-1', name: 'Root', email: 'root@x.com', role: 'admin' };
  });

  it('approving adds the creator as organizer and promotes their role', async () => {
    const club = clubDoc({ status: 'pending', organizerIds: ['owner-1'] });
    Club.findById.mockResolvedValue(club);

    const res = await request(app).put('/api/clubs/admin/club-1/status').send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(club.status).toBe('approved');
    expect(club.organizerIds).toEqual(['owner-1']);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('owner-1', { role: 'organizer' });
    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({ user: 'owner-1', type: 'club' }));
  });

  it('blocking leaves the creator role untouched', async () => {
    const club = clubDoc();
    Club.findById.mockResolvedValue(club);

    await request(app).put('/api/clubs/admin/club-1/status').send({ status: 'blocked' });

    expect(club.status).toBe('blocked');
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('400s for an unsupported status', async () => {
    const res = await request(app).put('/api/clubs/admin/club-1/status').send({ status: 'deleted' });

    expect(res.status).toBe(400);
    expect(Club.findById).not.toHaveBeenCalled();
  });

  it('404s for an unknown club', async () => {
    Club.findById.mockResolvedValue(null);

    const res = await request(app).put('/api/clubs/admin/club-9/status').send({ status: 'approved' });

    expect(res.status).toBe(404);
  });

  it('403s for a non-admin', async () => {
    global.__testUser = { id: 'user-1', name: 'Ann', email: 'ann@example.com', role: 'user' };

    const res = await request(app).put('/api/clubs/admin/club-1/status').send({ status: 'approved' });

    expect(res.status).toBe(403);
  });

  it('500s when saving fails', async () => {
    const club = clubDoc();
    club.save.mockRejectedValue(new Error('db down'));
    Club.findById.mockResolvedValue(club);

    const res = await request(app).put('/api/clubs/admin/club-1/status').send({ status: 'blocked' });

    expect(res.status).toBe(500);
  });
});
