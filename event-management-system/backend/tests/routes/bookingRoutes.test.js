jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => { req.user = { ...global.__testUser }; next(); },
  adminOnly: (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Admin access required.' }))
}));
jest.mock('../../models/Booking', () => ({ create: jest.fn(), find: jest.fn(), findOne: jest.fn(), findById: jest.fn() }));
jest.mock('../../models/Event', () => ({ findById: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() }));
jest.mock('../../models/Waitlist', () => ({ findOne: jest.fn(), updateMany: jest.fn() }));
jest.mock('../../models/User', () => ({ findById: jest.fn() }));
jest.mock('../../models/Notification', () => ({ create: jest.fn() }));
jest.mock('../../utils/email', () => ({ sendWaitlistPromotedEmail: jest.fn() }));

const request = require('supertest');
const Booking = require('../../models/Booking');
const Event = require('../../models/Event');
const Waitlist = require('../../models/Waitlist');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const { sendWaitlistPromotedEmail } = require('../../utils/email');
const bookingRoutes = require('../../routes/bookingRoutes');
const { createApp, queryStub, rejectingQueryStub } = require('../helpers/testApp');

const app = createApp('/api/bookings', bookingRoutes);

const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

function eventDoc(overrides = {}) {
  return {
    id: 'event-1',
    title: 'Hack Night',
    status: 'published',
    capacity: 10,
    bookedCount: 1,
    registrationDeadline: tomorrow,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

beforeEach(() => {
  global.__testUser = { id: 'user-1', name: 'Ann', email: 'ann@example.com', role: 'user' };
  Notification.create.mockResolvedValue({});
  Waitlist.updateMany.mockResolvedValue({});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/bookings', () => {
  it('claims a seat atomically and creates a confirmed booking with a check-in code', async () => {
    const event = eventDoc();
    Event.findById.mockResolvedValue(event);
    Booking.findOne.mockResolvedValue(null);
    Event.findOneAndUpdate.mockResolvedValue({ ...event, bookedCount: 2 });
    Booking.create.mockImplementation(async (doc) => ({ id: 'b1', ...doc }));

    const res = await request(app).post('/api/bookings').send({ eventId: 'event-1' });

    expect(res.status).toBe(201);
    expect(Event.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'event-1', status: 'published', $expr: { $lt: ['$bookedCount', '$capacity'] } },
      { $inc: { bookedCount: 1 } },
      { new: true }
    );
    expect(res.body.booking).toMatchObject({ user: 'user-1', event: 'event-1', status: 'confirmed' });
    expect(res.body.booking.checkInCode).toMatch(/^[0-9A-F]{10}$/);
    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({ user: 'user-1', type: 'booking' }));
  });

  it('400s without an eventId', async () => {
    const res = await request(app).post('/api/bookings').send({});

    expect(res.status).toBe(400);
    expect(Event.findById).not.toHaveBeenCalled();
  });

  it('404s for an unknown event', async () => {
    Event.findById.mockResolvedValue(null);

    const res = await request(app).post('/api/bookings').send({ eventId: 'nope' });

    expect(res.status).toBe(404);
  });

  it('400s for an event that is not published', async () => {
    Event.findById.mockResolvedValue(eventDoc({ status: 'draft' }));

    const res = await request(app).post('/api/bookings').send({ eventId: 'event-1' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('This event is not open for booking.');
  });

  it('400s once the registration deadline has passed', async () => {
    Event.findById.mockResolvedValue(eventDoc({ registrationDeadline: yesterday }));

    const res = await request(app).post('/api/bookings').send({ eventId: 'event-1' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/registration deadline/);
  });

  it('409s when the caller already has an active booking', async () => {
    Event.findById.mockResolvedValue(eventDoc());
    Booking.findOne.mockResolvedValue({ id: 'b0' });

    const res = await request(app).post('/api/bookings').send({ eventId: 'event-1' });

    expect(res.status).toBe(409);
    expect(Event.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('400s when the atomic seat claim finds the event full', async () => {
    Event.findById.mockResolvedValue(eventDoc({ bookedCount: 10 }));
    Booking.findOne.mockResolvedValue(null);
    Event.findOneAndUpdate.mockResolvedValue(null);

    const res = await request(app).post('/api/bookings').send({ eventId: 'event-1' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/fully booked/);
  });

  it('releases the claimed seat and 409s when the duplicate index fires', async () => {
    Event.findById.mockResolvedValue(eventDoc());
    Booking.findOne.mockResolvedValue(null);
    Event.findOneAndUpdate.mockResolvedValue(eventDoc({ bookedCount: 2 }));
    Booking.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    Event.updateOne.mockResolvedValue({});

    const res = await request(app).post('/api/bookings').send({ eventId: 'event-1' });

    expect(res.status).toBe(409);
    expect(Event.updateOne).toHaveBeenCalledWith({ _id: 'event-1', bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } });
  });

  it('releases the claimed seat and 500s on any other booking failure', async () => {
    Event.findById.mockResolvedValue(eventDoc());
    Booking.findOne.mockResolvedValue(null);
    Event.findOneAndUpdate.mockResolvedValue(eventDoc({ bookedCount: 2 }));
    Booking.create.mockRejectedValue(new Error('write failed'));
    Event.updateOne.mockResolvedValue({});

    const res = await request(app).post('/api/bookings').send({ eventId: 'event-1' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('write failed');
    expect(Event.updateOne).toHaveBeenCalled();
  });
});

describe('GET /api/bookings/my', () => {
  it('returns the caller bookings newest first', async () => {
    const stub = queryStub([{ id: 'b1' }]);
    Booking.find.mockReturnValue(stub);

    const res = await request(app).get('/api/bookings/my');

    expect(res.body.bookings).toEqual([{ id: 'b1' }]);
    expect(Booking.find).toHaveBeenCalledWith({ user: 'user-1' });
    expect(stub.sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('500s when the query fails', async () => {
    Booking.find.mockReturnValue(rejectingQueryStub(new Error('db down')));

    const res = await request(app).get('/api/bookings/my');

    expect(res.status).toBe(500);
  });
});

describe('GET /api/bookings (admin)', () => {
  it('returns every booking for an admin', async () => {
    global.__testUser = { id: 'admin-1', name: 'Root', email: 'root@x.com', role: 'admin' };
    Booking.find.mockReturnValue(queryStub([{ id: 'b1' }, { id: 'b2' }]));

    const res = await request(app).get('/api/bookings');

    expect(res.status).toBe(200);
    expect(res.body.bookings).toHaveLength(2);
  });

  it('403s for a non-admin', async () => {
    const res = await request(app).get('/api/bookings');

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/bookings/:id/cancel', () => {
  function bookingDoc(overrides = {}) {
    return {
      id: 'b1',
      user: { toString: () => 'user-1' },
      event: 'event-1',
      status: 'confirmed',
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides
    };
  }

  it('cancels the booking, frees a seat and promotes the next waitlist entry', async () => {
    const booking = bookingDoc();
    const event = eventDoc({ bookedCount: 5 });
    Booking.findById.mockResolvedValue(booking);
    Event.findById.mockResolvedValue(event);
    const next = { user: 'user-2', position: 1, status: 'waiting', save: jest.fn().mockResolvedValue(undefined) };
    Waitlist.findOne.mockReturnValue(queryStub(next));
    Booking.create.mockResolvedValue({ id: 'b2' });
    User.findById.mockResolvedValue({ name: 'Bea', email: 'bea@example.com' });
    sendWaitlistPromotedEmail.mockResolvedValue(undefined);

    const res = await request(app).put('/api/bookings/b1/cancel');

    expect(res.status).toBe(200);
    expect(booking.status).toBe('cancelled');
    // one seat released by the cancellation, one re-taken by the promotion
    expect(event.bookedCount).toBe(5);
    expect(next.status).toBe('fulfilled');
    expect(Waitlist.updateMany).toHaveBeenCalledWith(
      { event: 'event-1', status: 'waiting', position: { $gt: 1 } },
      { $inc: { position: -1 } }
    );
  });

  it('does not promote anyone when the waitlist is empty', async () => {
    const event = eventDoc({ bookedCount: 3 });
    Booking.findById.mockResolvedValue(bookingDoc());
    Event.findById.mockResolvedValue(event);
    Waitlist.findOne.mockReturnValue(queryStub(null));

    const res = await request(app).put('/api/bookings/b1/cancel');

    expect(res.status).toBe(200);
    expect(event.bookedCount).toBe(2);
    expect(Booking.create).not.toHaveBeenCalled();
  });

  it('never lets bookedCount go negative', async () => {
    const event = eventDoc({ bookedCount: 0 });
    Booking.findById.mockResolvedValue(bookingDoc());
    Event.findById.mockResolvedValue(event);
    Waitlist.findOne.mockReturnValue(queryStub(null));

    await request(app).put('/api/bookings/b1/cancel');

    expect(event.bookedCount).toBe(0);
  });

  it('does not free a seat when cancelling a rejected booking', async () => {
    const booking = bookingDoc({ status: 'rejected' });
    Booking.findById.mockResolvedValue(booking);

    const res = await request(app).put('/api/bookings/b1/cancel');

    expect(res.status).toBe(200);
    expect(Event.findById).not.toHaveBeenCalled();
  });

  it('404s for an unknown booking', async () => {
    Booking.findById.mockResolvedValue(null);

    const res = await request(app).put('/api/bookings/b1/cancel');

    expect(res.status).toBe(404);
  });

  it("403s when cancelling someone else's booking", async () => {
    Booking.findById.mockResolvedValue(bookingDoc({ user: { toString: () => 'user-9' } }));

    const res = await request(app).put('/api/bookings/b1/cancel');

    expect(res.status).toBe(403);
  });

  it("allows an admin to cancel someone else's booking", async () => {
    global.__testUser = { id: 'admin-1', name: 'Root', email: 'root@x.com', role: 'admin' };
    const booking = bookingDoc({ user: { toString: () => 'user-9' }, status: 'pending' });
    Booking.findById.mockResolvedValue(booking);
    Event.findById.mockResolvedValue(null);

    const res = await request(app).put('/api/bookings/b1/cancel');

    expect(res.status).toBe(200);
    expect(booking.status).toBe('cancelled');
  });

  it('400s when the booking is already cancelled', async () => {
    Booking.findById.mockResolvedValue(bookingDoc({ status: 'cancelled' }));

    const res = await request(app).put('/api/bookings/b1/cancel');

    expect(res.status).toBe(400);
  });

  it('500s when the lookup fails', async () => {
    Booking.findById.mockRejectedValue(new Error('db down'));

    const res = await request(app).put('/api/bookings/b1/cancel');

    expect(res.status).toBe(500);
  });

  it('still cancels when the waitlist promotion fails', async () => {
    const event = eventDoc({ bookedCount: 4 });
    Booking.findById.mockResolvedValue(bookingDoc());
    Event.findById.mockResolvedValue(event);
    Waitlist.findOne.mockReturnValue(queryStub({ user: 'user-2', position: 1, save: jest.fn() }));
    Booking.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));

    const res = await request(app).put('/api/bookings/b1/cancel');

    expect(res.status).toBe(200);
  });
});

describe('PUT /api/bookings/:id/status', () => {
  beforeEach(() => {
    global.__testUser = { id: 'admin-1', name: 'Root', email: 'root@x.com', role: 'admin' };
  });

  function bookingDoc(status) {
    return { id: 'b1', user: 'user-1', event: 'event-1', status, save: jest.fn().mockResolvedValue(undefined) };
  }

  it('rejects an unsupported status', async () => {
    const res = await request(app).put('/api/bookings/b1/status').send({ status: 'maybe' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Status must be one of/);
  });

  it('403s for a non-admin caller', async () => {
    global.__testUser = { id: 'user-1', name: 'Ann', email: 'ann@example.com', role: 'user' };

    const res = await request(app).put('/api/bookings/b1/status').send({ status: 'confirmed' });

    expect(res.status).toBe(403);
  });

  it('404s for an unknown booking', async () => {
    Booking.findById.mockResolvedValue(null);

    const res = await request(app).put('/api/bookings/b1/status').send({ status: 'confirmed' });

    expect(res.status).toBe(404);
  });

  it('takes a seat when moving a rejected booking back to confirmed', async () => {
    const booking = bookingDoc('rejected');
    const event = eventDoc({ bookedCount: 2 });
    Booking.findById.mockResolvedValue(booking);
    Event.findById.mockResolvedValue(event);

    const res = await request(app).put('/api/bookings/b1/status').send({ status: 'confirmed' });

    expect(res.status).toBe(200);
    expect(event.bookedCount).toBe(3);
    expect(booking.status).toBe('confirmed');
  });

  it('400s when there is no free seat for the status change', async () => {
    Booking.findById.mockResolvedValue(bookingDoc('rejected'));
    Event.findById.mockResolvedValue(eventDoc({ bookedCount: 10, capacity: 10 }));

    const res = await request(app).put('/api/bookings/b1/status').send({ status: 'confirmed' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/No available seat/);
  });

  it('frees a seat and promotes the waitlist when rejecting a confirmed booking', async () => {
    const booking = bookingDoc('confirmed');
    const event = eventDoc({ bookedCount: 6 });
    Booking.findById.mockResolvedValue(booking);
    Event.findById.mockResolvedValue(event);
    Waitlist.findOne.mockReturnValue(queryStub(null));

    const res = await request(app).put('/api/bookings/b1/status').send({ status: 'rejected' });

    expect(res.status).toBe(200);
    expect(event.bookedCount).toBe(5);
    expect(booking.status).toBe('rejected');
  });

  it('leaves the seat count alone when the counted state does not change', async () => {
    const booking = bookingDoc('confirmed');
    const event = eventDoc({ bookedCount: 6 });
    Booking.findById.mockResolvedValue(booking);
    Event.findById.mockResolvedValue(event);

    const res = await request(app).put('/api/bookings/b1/status').send({ status: 'pending' });

    expect(res.status).toBe(200);
    expect(event.bookedCount).toBe(6);
    expect(event.save).not.toHaveBeenCalled();
  });

  it('500s when saving fails', async () => {
    const booking = bookingDoc('confirmed');
    booking.save.mockRejectedValue(new Error('db down'));
    Booking.findById.mockResolvedValue(booking);
    Event.findById.mockResolvedValue(null);

    const res = await request(app).put('/api/bookings/b1/status').send({ status: 'pending' });

    expect(res.status).toBe(500);
  });
});
