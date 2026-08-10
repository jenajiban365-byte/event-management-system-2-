jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => { req.user = { ...global.__testUser }; next(); },
  adminOnly: (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Admin access required.' }))
}));
jest.mock('../../models/Event', () => ({ countDocuments: jest.fn(), find: jest.fn() }));
jest.mock('../../models/User', () => ({ countDocuments: jest.fn() }));
jest.mock('../../models/Booking', () => ({ countDocuments: jest.fn(), find: jest.fn(), aggregate: jest.fn() }));
jest.mock('../../models/Club', () => ({ countDocuments: jest.fn(), find: jest.fn() }));

const request = require('supertest');
const Event = require('../../models/Event');
const User = require('../../models/User');
const Booking = require('../../models/Booking');
const Club = require('../../models/Club');
const adminRoutes = require('../../routes/adminRoutes');
const { createApp, queryStub, rejectingQueryStub } = require('../helpers/testApp');

const app = createApp('/api/admin', adminRoutes);

function today() {
  return new Date().toISOString().split('T')[0];
}

beforeEach(() => {
  global.__testUser = { id: 'admin-1', role: 'admin' };
  Event.countDocuments.mockResolvedValue(0);
  User.countDocuments.mockResolvedValue(0);
  Booking.countDocuments.mockResolvedValue(0);
  Club.countDocuments.mockResolvedValue(0);
  Booking.find.mockReturnValue(queryStub([]));
  Booking.aggregate.mockResolvedValue([]);
});

describe('GET /api/admin/dashboard', () => {
  it('aggregates the totals and flattens recent bookings', async () => {
    Event.countDocuments.mockResolvedValueOnce(12).mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    User.countDocuments.mockResolvedValue(30);
    Booking.countDocuments.mockResolvedValueOnce(40).mockResolvedValueOnce(35);
    Club.countDocuments.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    Booking.find.mockReturnValue(queryStub([
      { id: 'b1', status: 'confirmed', createdAt: '2026-01-01', user: { name: 'Ann' }, event: { title: 'Hack Night' } },
      { id: 'b2', status: 'pending', createdAt: '2026-01-02', user: null, event: null }
    ]));

    const res = await request(app).get('/api/admin/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({
      totalEvents: 12,
      upcomingEvents: 5,
      totalUsers: 30,
      totalBookings: 40,
      activeBookings: 35,
      totalClubs: 3,
      pendingClubs: 1,
      pendingEvents: 2
    });
    expect(res.body.recentBookings).toEqual([
      { id: 'b1', status: 'confirmed', createdAt: '2026-01-01', userName: 'Ann', eventTitle: 'Hack Night' },
      { id: 'b2', status: 'pending', createdAt: '2026-01-02', userName: 'Unknown', eventTitle: 'Unknown' }
    ]);
    expect(Event.countDocuments).toHaveBeenNthCalledWith(2, { date: { $gte: today() }, status: 'published' });
  });

  it('returns a dense 14-day booking trend, zero-filling missing days', async () => {
    const yesterday = new Date();
    yesterday.setUTCHours(0, 0, 0, 0);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const key = yesterday.toISOString().slice(0, 10);
    Booking.aggregate.mockResolvedValue([{ _id: key, count: 7 }]);

    const res = await request(app).get('/api/admin/dashboard');

    expect(res.body.bookingTrend).toHaveLength(14);
    expect(res.body.bookingTrend[res.body.bookingTrend.length - 1].date).toBe(today());
    expect(res.body.bookingTrend.find((d) => d.date === key).count).toBe(7);
    expect(res.body.bookingTrend.filter((d) => d.count === 0)).toHaveLength(13);
  });

  it('403s for a non-admin', async () => {
    global.__testUser = { id: 'user-1', role: 'user' };

    const res = await request(app).get('/api/admin/dashboard');

    expect(res.status).toBe(403);
  });

  it('500s when a count fails', async () => {
    Event.countDocuments.mockRejectedValue(new Error('db down'));

    const res = await request(app).get('/api/admin/dashboard');

    expect(res.status).toBe(500);
  });
});

describe('GET /api/admin/pending-events', () => {
  it('returns events awaiting approval', async () => {
    Event.find.mockReturnValue(queryStub([{ id: 'e1' }]));

    const res = await request(app).get('/api/admin/pending-events');

    expect(res.status).toBe(200);
    expect(Event.find).toHaveBeenCalledWith({ status: 'pending_approval' });
  });

  it('500s when the query fails', async () => {
    Event.find.mockReturnValue(rejectingQueryStub(new Error('db down')));

    const res = await request(app).get('/api/admin/pending-events');

    expect(res.status).toBe(500);
  });
});

describe('GET /api/admin/clubs', () => {
  it('returns every club with its owners populated', async () => {
    const stub = queryStub([{ id: 'c1' }]);
    Club.find.mockReturnValue(stub);

    const res = await request(app).get('/api/admin/clubs');

    expect(res.status).toBe(200);
    expect(stub.populate).toHaveBeenCalledWith('createdBy', 'name email');
    expect(stub.sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('500s when the query fails', async () => {
    Club.find.mockReturnValue(rejectingQueryStub(new Error('db down')));

    const res = await request(app).get('/api/admin/clubs');

    expect(res.status).toBe(500);
  });
});
