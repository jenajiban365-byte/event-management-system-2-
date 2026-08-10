jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => { req.user = { id: 'user-1', name: 'Ann', email: 'ann@example.com', role: 'user' }; next(); },
  adminOnly: (req, res, next) => next()
}));
jest.mock('../../models/Event', () => ({ findById: jest.fn() }));
jest.mock('../../models/Booking', () => ({ findOne: jest.fn() }));
jest.mock('../../models/Waitlist', () => ({
  findOne: jest.fn(),
  countDocuments: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateMany: jest.fn()
}));

const request = require('supertest');
const Event = require('../../models/Event');
const Booking = require('../../models/Booking');
const Waitlist = require('../../models/Waitlist');
const waitlistRoutes = require('../../routes/waitlistRoutes');
const { createApp } = require('../helpers/testApp');

const app = createApp('/api/waitlist', waitlistRoutes);
const fullEvent = { id: 'event-1', status: 'published', capacity: 10, bookedCount: 10 };

describe('GET /api/waitlist/status/:eventId', () => {
  it('reports the caller position and total waiting count', async () => {
    Waitlist.findOne.mockResolvedValue({ position: 3 });
    Waitlist.countDocuments.mockResolvedValue(7);

    const res = await request(app).get('/api/waitlist/status/event-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ joined: true, position: 3, count: 7 });
    expect(Waitlist.findOne).toHaveBeenCalledWith({ event: 'event-1', user: 'user-1', status: 'waiting' });
  });

  it('reports a null position when the caller has not joined', async () => {
    Waitlist.findOne.mockResolvedValue(null);
    Waitlist.countDocuments.mockResolvedValue(2);

    const res = await request(app).get('/api/waitlist/status/event-1');

    expect(res.body).toEqual({ joined: false, position: null, count: 2 });
  });

  it('returns 500 when the lookup fails', async () => {
    Waitlist.findOne.mockRejectedValue(new Error('db down'));

    const res = await request(app).get('/api/waitlist/status/event-1');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error checking waitlist.');
  });
});

describe('POST /api/waitlist', () => {
  it('appends the caller to the end of the queue', async () => {
    Event.findById.mockResolvedValue(fullEvent);
    Booking.findOne.mockResolvedValue(null);
    Waitlist.findOne.mockResolvedValue(null);
    Waitlist.countDocuments.mockResolvedValue(4);
    Waitlist.create.mockResolvedValue({ id: 'w1', position: 5 });

    const res = await request(app).post('/api/waitlist').send({ eventId: 'event-1' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ message: 'You joined the waitlist.', count: 5 });
    expect(Waitlist.create).toHaveBeenCalledWith({ event: 'event-1', user: 'user-1', position: 5 });
  });

  it('404s for an unknown event', async () => {
    Event.findById.mockResolvedValue(null);

    const res = await request(app).post('/api/waitlist').send({ eventId: 'nope' });

    expect(res.status).toBe(404);
  });

  it('404s for an event that is not published', async () => {
    Event.findById.mockResolvedValue({ ...fullEvent, status: 'draft' });

    const res = await request(app).post('/api/waitlist').send({ eventId: 'event-1' });

    expect(res.status).toBe(404);
  });

  it('400s while seats are still available', async () => {
    Event.findById.mockResolvedValue({ ...fullEvent, bookedCount: 2 });

    const res = await request(app).post('/api/waitlist').send({ eventId: 'event-1' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('This event still has available seats.');
  });

  it('409s when the caller already holds a booking', async () => {
    Event.findById.mockResolvedValue(fullEvent);
    Booking.findOne.mockResolvedValue({ id: 'b1' });

    const res = await request(app).post('/api/waitlist').send({ eventId: 'event-1' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('You already have a booking for this event.');
  });

  it('409s with the existing position when already waiting', async () => {
    Event.findById.mockResolvedValue(fullEvent);
    Booking.findOne.mockResolvedValue(null);
    Waitlist.findOne.mockResolvedValue({ position: 2 });

    const res = await request(app).post('/api/waitlist').send({ eventId: 'event-1' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('You are already on the waitlist at position 2.');
  });

  it('409s when the unique index rejects a concurrent join', async () => {
    Event.findById.mockResolvedValue(fullEvent);
    Booking.findOne.mockResolvedValue(null);
    Waitlist.findOne.mockResolvedValue(null);
    Waitlist.countDocuments.mockResolvedValue(0);
    Waitlist.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));

    const res = await request(app).post('/api/waitlist').send({ eventId: 'event-1' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('You are already on the waitlist.');
  });

  it('500s on unexpected errors', async () => {
    Event.findById.mockRejectedValue(new Error('db down'));

    const res = await request(app).post('/api/waitlist').send({ eventId: 'event-1' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error joining waitlist.');
  });
});

describe('DELETE /api/waitlist/:eventId', () => {
  it('cancels the entry and shifts everyone behind it forward', async () => {
    Waitlist.findOneAndUpdate.mockResolvedValue({ position: 3 });
    Waitlist.updateMany.mockResolvedValue({ modifiedCount: 2 });

    const res = await request(app).delete('/api/waitlist/event-1');

    expect(res.status).toBe(200);
    expect(Waitlist.findOneAndUpdate).toHaveBeenCalledWith(
      { event: 'event-1', user: 'user-1', status: 'waiting' },
      { status: 'cancelled' },
      { new: true }
    );
    expect(Waitlist.updateMany).toHaveBeenCalledWith(
      { event: 'event-1', status: 'waiting', position: { $gt: 3 } },
      { $inc: { position: -1 } }
    );
  });

  it('404s when the caller is not on the waitlist', async () => {
    Waitlist.findOneAndUpdate.mockResolvedValue(null);

    const res = await request(app).delete('/api/waitlist/event-1');

    expect(res.status).toBe(404);
    expect(Waitlist.updateMany).not.toHaveBeenCalled();
  });

  it('500s when the update fails', async () => {
    Waitlist.findOneAndUpdate.mockRejectedValue(new Error('db down'));

    const res = await request(app).delete('/api/waitlist/event-1');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error leaving waitlist.');
  });
});
