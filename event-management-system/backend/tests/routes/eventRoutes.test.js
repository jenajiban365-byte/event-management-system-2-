jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => { req.user = { ...global.__testUser }; next(); },
  adminOnly: (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Admin access required.' }))
}));
jest.mock('../../models/Event', () => ({ find: jest.fn(), findById: jest.fn(), create: jest.fn() }));
jest.mock('../../models/Booking', () => ({ updateMany: jest.fn() }));
jest.mock('../../models/Waitlist', () => ({ countDocuments: jest.fn(), deleteMany: jest.fn() }));
jest.mock('../../models/Notification', () => ({ create: jest.fn() }));

const request = require('supertest');
const Event = require('../../models/Event');
const Booking = require('../../models/Booking');
const Waitlist = require('../../models/Waitlist');
const Notification = require('../../models/Notification');
const eventRoutes = require('../../routes/eventRoutes');
const { createApp, queryStub, rejectingQueryStub } = require('../helpers/testApp');

const app = createApp('/api/events', eventRoutes);

function eventDoc(overrides = {}) {
  return {
    id: 'event-1',
    title: 'Hack Night',
    capacity: 10,
    bookedCount: 2,
    status: 'published',
    toObject() { return { ...this }; },
    save: jest.fn().mockResolvedValue(undefined),
    deleteOne: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function findQuery(result) {
  const stub = queryStub(result);
  Event.find.mockReturnValue(stub);
  return stub;
}

beforeEach(() => {
  global.__testUser = { id: 'admin-1', role: 'admin' };
  Waitlist.countDocuments.mockResolvedValue(0);
});

describe('GET /api/events filters', () => {
  it('lists published events with their waitlist counts', async () => {
    findQuery([eventDoc()]);
    Waitlist.countDocuments.mockResolvedValue(4);

    const res = await request(app).get('/api/events');

    expect(res.status).toBe(200);
    expect(res.body.events[0].waitlistCount).toBe(4);
    expect(Event.find).toHaveBeenCalledWith({ status: 'published' });
  });

  it('escapes regex metacharacters in the search term', async () => {
    findQuery([]);

    await request(app).get('/api/events').query({ search: 'C++ (intro)' });

    const query = Event.find.mock.calls[0][0];
    expect(query.$or).toHaveLength(3);
    expect(query.$or[0].title.test('c++ (intro) workshop')).toBe(true);
    expect(query.$or[0].title.test('cxx intro')).toBe(false);
  });

  it.each([
    [{ category: 'Music' }, { category: 'Music' }],
    [{ eventType: 'workshop' }, { eventType: 'workshop' }],
    [{ price: 'free' }, { price: { $eq: 0 } }],
    [{ price: 'paid' }, { price: { $gt: 0 } }],
    [{ availability: 'available' }, { $expr: { $lt: ['$bookedCount', '$capacity'] } }],
    [{ date: '2030-01-01' }, { date: '2030-01-01' }],
    [{ excludeId: 'e9' }, { _id: { $ne: 'e9' } }]
  ])('translates query %p into a mongo filter', async (params, expected) => {
    findQuery([]);

    await request(app).get('/api/events').query(params);

    expect(Event.find.mock.calls[0][0]).toMatchObject(expected);
  });

  it('restricts upcoming=true to today onwards', async () => {
    findQuery([]);

    await request(app).get('/api/events').query({ upcoming: 'true' });

    const today = new Date().toISOString().split('T')[0];
    expect(Event.find.mock.calls[0][0].date).toEqual({ $gte: today });
  });

  it('keeps an exact date alongside upcoming=true', async () => {
    findQuery([]);

    await request(app).get('/api/events').query({ upcoming: 'true', date: '2030-01-01' });

    expect(Event.find.mock.calls[0][0].date).toMatchObject({ $eq: '2030-01-01' });
  });

  it('sorts by booking count when sort=popular', async () => {
    const stub = findQuery([]);

    await request(app).get('/api/events').query({ sort: 'popular' });

    expect(stub.sort).toHaveBeenCalledWith({ bookedCount: -1, date: 1 });
  });

  it('sorts by date and time by default', async () => {
    const stub = findQuery([]);

    await request(app).get('/api/events');

    expect(stub.sort).toHaveBeenCalledWith({ date: 1, time: 1 });
  });

  it.each([
    ['5', 5],
    ['500', 50],
    ['abc', 20]
  ])('caps limit %s at %i', async (limit, expected) => {
    const stub = findQuery([]);

    await request(app).get('/api/events').query({ limit });

    expect(stub.limit).toHaveBeenCalledWith(expected);
  });

  it('500s when the query fails', async () => {
    Event.find.mockReturnValue(rejectingQueryStub(new Error('db down')));

    const res = await request(app).get('/api/events');

    expect(res.status).toBe(500);
  });
});

describe('GET /api/events/all', () => {
  it('returns every event for an admin', async () => {
    findQuery([eventDoc(), eventDoc({ id: 'event-2', status: 'draft' })]);

    const res = await request(app).get('/api/events/all');

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
  });

  it('403s for a non-admin', async () => {
    global.__testUser = { id: 'user-1', role: 'user' };

    const res = await request(app).get('/api/events/all');

    expect(res.status).toBe(403);
  });
});

describe('GET /api/events/:id', () => {
  it('returns a single event with its waitlist count', async () => {
    Event.findById.mockReturnValue(queryStub(eventDoc()));
    Waitlist.countDocuments.mockResolvedValue(2);

    const res = await request(app).get('/api/events/event-1');

    expect(res.status).toBe(200);
    expect(res.body.event.waitlistCount).toBe(2);
  });

  it('404s for an unknown event', async () => {
    Event.findById.mockReturnValue(queryStub(null));

    const res = await request(app).get('/api/events/nope');

    expect(res.status).toBe(404);
  });

  it('404s when the id is not a valid ObjectId', async () => {
    Event.findById.mockReturnValue(rejectingQueryStub(new Error('CastError')));

    const res = await request(app).get('/api/events/garbage');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/events', () => {
  const validBody = {
    title: 'Hack Night',
    description: 'Build things',
    category: 'Tech',
    date: '2030-01-01',
    time: '18:00',
    location: 'Lab 1',
    capacity: '25'
  };

  it('creates a published event with numeric capacity', async () => {
    Event.create.mockImplementation(async (doc) => ({ id: 'event-9', ...doc }));

    const res = await request(app).post('/api/events').send(validBody);

    expect(res.status).toBe(201);
    expect(Event.create).toHaveBeenCalledWith(expect.objectContaining({ capacity: 25, bookedCount: 0, status: 'published', imageUrl: '' }));
  });

  it.each([['', null], [null, null], ['12.5', 12.5]])(
    'normalizes latitude %p to %p',
    async (latitude, expected) => {
      Event.create.mockImplementation(async (doc) => doc);

      await request(app).post('/api/events').send({ ...validBody, latitude, longitude: latitude });

      expect(Event.create.mock.calls[0][0].latitude).toBe(expected);
      expect(Event.create.mock.calls[0][0].longitude).toBe(expected);
    }
  );

  it('400s when a required field is missing', async () => {
    const res = await request(app).post('/api/events').send({ ...validBody, title: undefined });

    expect(res.status).toBe(400);
    expect(Event.create).not.toHaveBeenCalled();
  });

  it('403s for a non-admin', async () => {
    global.__testUser = { id: 'user-1', role: 'user' };

    const res = await request(app).post('/api/events').send(validBody);

    expect(res.status).toBe(403);
  });

  it('500s when the insert fails', async () => {
    Event.create.mockRejectedValue(new Error('db down'));

    const res = await request(app).post('/api/events').send(validBody);

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/events/:id', () => {
  it('applies only the supplied fields', async () => {
    const event = eventDoc();
    Event.findById.mockResolvedValue(event);

    const res = await request(app).put('/api/events/event-1').send({ title: 'Renamed', capacity: '30' });

    expect(res.status).toBe(200);
    expect(event.title).toBe('Renamed');
    expect(event.capacity).toBe(30);
    expect(event.save).toHaveBeenCalled();
  });

  it('rejects a capacity below the current booking count', async () => {
    const event = eventDoc({ bookedCount: 5 });
    Event.findById.mockResolvedValue(event);

    const res = await request(app).put('/api/events/event-1').send({ capacity: '3' });

    expect(res.status).toBe(400);
    expect(event.save).not.toHaveBeenCalled();
  });

  it('404s for an unknown event', async () => {
    Event.findById.mockResolvedValue(null);

    const res = await request(app).put('/api/events/nope').send({ title: 'x' });

    expect(res.status).toBe(404);
  });

  it('500s when saving fails', async () => {
    const event = eventDoc();
    event.save.mockRejectedValue(new Error('db down'));
    Event.findById.mockResolvedValue(event);

    const res = await request(app).put('/api/events/event-1').send({ title: 'x' });

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/events/:id/approval', () => {
  it('publishes an event and notifies its organizer', async () => {
    const event = eventDoc({ status: 'pending_approval', organizer: 'user-7' });
    Event.findById.mockResolvedValue(event);
    Notification.create.mockResolvedValue({});

    const res = await request(app).put('/api/events/event-1/approval').send({ status: 'published', note: ' looks good ' });

    expect(res.status).toBe(200);
    expect(event.status).toBe('published');
    expect(event.approvalNote).toBe('looks good');
    expect(event.publishedAt).toBeInstanceOf(Date);
    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({ user: 'user-7', type: 'event' }));
  });

  it('does not set publishedAt when rejecting', async () => {
    const event = eventDoc({ status: 'pending_approval', organizer: null });
    Event.findById.mockResolvedValue(event);

    await request(app).put('/api/events/event-1/approval').send({ status: 'rejected' });

    expect(event.publishedAt).toBeUndefined();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  it('400s for an unsupported approval status', async () => {
    const res = await request(app).put('/api/events/event-1/approval').send({ status: 'approved' });

    expect(res.status).toBe(400);
    expect(Event.findById).not.toHaveBeenCalled();
  });

  it('404s for an unknown event', async () => {
    Event.findById.mockResolvedValue(null);

    const res = await request(app).put('/api/events/nope/approval').send({ status: 'published' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/events/:id', () => {
  it('cancels bookings and clears the waitlist before deleting', async () => {
    const event = eventDoc();
    Event.findById.mockResolvedValue(event);
    Booking.updateMany.mockResolvedValue({});
    Waitlist.deleteMany.mockResolvedValue({});

    const res = await request(app).delete('/api/events/event-1');

    expect(res.status).toBe(200);
    expect(Booking.updateMany).toHaveBeenCalledWith({ event: 'event-1' }, { status: 'cancelled' });
    expect(Waitlist.deleteMany).toHaveBeenCalledWith({ event: 'event-1' });
    expect(event.deleteOne).toHaveBeenCalled();
  });

  it('404s for an unknown event', async () => {
    Event.findById.mockResolvedValue(null);

    const res = await request(app).delete('/api/events/nope');

    expect(res.status).toBe(404);
    expect(Booking.updateMany).not.toHaveBeenCalled();
  });

  it('500s when the delete fails', async () => {
    const event = eventDoc();
    event.deleteOne.mockRejectedValue(new Error('db down'));
    Event.findById.mockResolvedValue(event);
    Booking.updateMany.mockResolvedValue({});
    Waitlist.deleteMany.mockResolvedValue({});

    const res = await request(app).delete('/api/events/event-1');

    expect(res.status).toBe(500);
  });
});
