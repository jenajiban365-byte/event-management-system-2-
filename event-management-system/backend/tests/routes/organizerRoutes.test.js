jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => { req.user = { ...global.__testUser }; next(); }
}));
jest.mock('../../models/Event', () => ({ find: jest.fn(), findOne: jest.fn(), create: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../../models/Club', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../../models/Booking', () => ({ find: jest.fn(), findOne: jest.fn(), findById: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../../models/Notification', () => ({ create: jest.fn(), insertMany: jest.fn() }));

const request = require('supertest');
const Event = require('../../models/Event');
const Club = require('../../models/Club');
const Booking = require('../../models/Booking');
const Notification = require('../../models/Notification');
const organizerRoutes = require('../../routes/organizerRoutes');
const { createApp, queryStub, rejectingQueryStub } = require('../helpers/testApp');

const app = createApp('/api/organizer', organizerRoutes);

// Club.find(...).select('_id') yields documents whose toString() is a debug
// representation, not the id, so membership must compare against _id.
function clubDoc(id) {
  return { _id: id, toString: () => `{ _id: new ObjectId("${id}") }` };
}

function distinctStub(values) {
  return { distinct: jest.fn().mockResolvedValue(values) };
}

function eventDoc(overrides = {}) {
  return {
    id: 'event-1',
    club: 'club-1',
    organizer: 'org-1',
    title: 'Hack Night',
    capacity: 10,
    bookedCount: 2,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

beforeEach(() => {
  global.__testUser = { id: 'org-1', name: 'Olive', email: 'olive@example.com', role: 'organizer' };
  Notification.create.mockResolvedValue({});
  Notification.insertMany.mockResolvedValue([]);
});

describe('GET /api/organizer/dashboard', () => {
  it('summarises the clubs, events and registrations the organizer owns', async () => {
    Club.find.mockReturnValue(queryStub([{ _id: 'club-1' }, { _id: 'club-2' }]));
    Event.countDocuments.mockResolvedValueOnce(6).mockResolvedValueOnce(2);
    Event.find.mockReturnValue(distinctStub(['event-1']));
    Booking.countDocuments.mockResolvedValue(9);

    const res = await request(app).get('/api/organizer/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({ clubs: 2, events: 6, upcomingEvents: 2, registrations: 9 });
    expect(Booking.countDocuments).toHaveBeenCalledWith({ event: { $in: ['event-1'] }, status: { $in: ['confirmed', 'pending'] } });
  });

  it('403s for a plain user', async () => {
    global.__testUser = { id: 'user-1', role: 'user' };

    const res = await request(app).get('/api/organizer/dashboard');

    expect(res.status).toBe(403);
    expect(Club.find).not.toHaveBeenCalled();
  });

  it('500s when a lookup fails', async () => {
    Club.find.mockReturnValue(rejectingQueryStub(new Error('db down')));

    const res = await request(app).get('/api/organizer/dashboard');

    expect(res.status).toBe(500);
  });
});

describe('GET /api/organizer/clubs', () => {
  it('lists only the approved clubs the organizer runs', async () => {
    const stub = queryStub([{ _id: 'club-1', name: 'Robotics' }]);
    Club.find.mockReturnValue(stub);

    const res = await request(app).get('/api/organizer/clubs');

    expect(res.status).toBe(200);
    expect(Club.find).toHaveBeenCalledWith({ organizerIds: 'org-1', status: 'approved' });
    expect(stub.sort).toHaveBeenCalledWith({ name: 1 });
    expect(res.body.clubs).toHaveLength(1);
  });

  it('403s for a plain user', async () => {
    global.__testUser = { id: 'user-1', role: 'user' };

    const res = await request(app).get('/api/organizer/clubs');

    expect(res.status).toBe(403);
    expect(Club.find).not.toHaveBeenCalled();
  });

  it('500s when the lookup fails', async () => {
    Club.find.mockReturnValue(rejectingQueryStub(new Error('db down')));

    const res = await request(app).get('/api/organizer/clubs');

    expect(res.status).toBe(500);
  });
});

describe('GET /api/organizer/events', () => {
  it('lists only events of the clubs the organizer runs', async () => {
    Club.find.mockReturnValue(queryStub([{ _id: 'club-1' }]));
    const stub = queryStub([eventDoc()]);
    Event.find.mockReturnValue(stub);

    const res = await request(app).get('/api/organizer/events');

    expect(res.status).toBe(200);
    expect(Event.find).toHaveBeenCalledWith({ club: { $in: ['club-1'] }, organizer: 'org-1' });
    expect(stub.sort).toHaveBeenCalledWith({ date: 1, time: 1 });
  });

  it('500s when the query fails', async () => {
    Club.find.mockReturnValue(queryStub([{ _id: 'club-1' }]));
    Event.find.mockReturnValue(rejectingQueryStub(new Error('db down')));

    const res = await request(app).get('/api/organizer/events');

    expect(res.status).toBe(500);
  });
});

describe('POST /api/organizer/events', () => {
  const payload = {
    clubId: 'club-1',
    title: '  Hack Night  ',
    description: '  Build things  ',
    category: ' Tech ',
    date: '2026-01-01',
    time: '18:00',
    location: '  Lab 2 ',
    capacity: '40'
  };

  it('creates an event awaiting admin approval with normalised values', async () => {
    Club.findOne.mockResolvedValue({ _id: 'club-1' });
    Event.create.mockImplementation(async (doc) => ({ id: 'event-1', ...doc }));

    const res = await request(app).post('/api/organizer/events').send({ ...payload, latitude: '', longitude: '12.5', price: '30', approvalRequired: 1 });

    expect(res.status).toBe(201);
    expect(Event.create).toHaveBeenCalledWith(expect.objectContaining({
      club: 'club-1',
      organizer: 'org-1',
      title: 'Hack Night',
      description: 'Build things',
      category: 'Tech',
      location: 'Lab 2',
      capacity: 40,
      latitude: null,
      longitude: 12.5,
      price: 30,
      approvalRequired: true,
      eligibility: 'All students',
      eventType: 'event',
      status: 'pending_approval'
    }));
  });

  it('400s when a required field is missing', async () => {
    const res = await request(app).post('/api/organizer/events').send({ ...payload, capacity: undefined });

    expect(res.status).toBe(400);
    expect(Club.findOne).not.toHaveBeenCalled();
  });

  it('403s when the organizer does not run the club', async () => {
    Club.findOne.mockResolvedValue(null);

    const res = await request(app).post('/api/organizer/events').send(payload);

    expect(res.status).toBe(403);
    expect(Club.findOne).toHaveBeenCalledWith({ _id: 'club-1', status: 'approved', organizerIds: 'org-1' });
    expect(Event.create).not.toHaveBeenCalled();
  });

  it('500s when the insert fails', async () => {
    Club.findOne.mockResolvedValue({ _id: 'club-1' });
    Event.create.mockRejectedValue(new Error('db down'));

    const res = await request(app).post('/api/organizer/events').send(payload);

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/organizer/events/:id', () => {
  beforeEach(() => {
    Club.find.mockReturnValue(queryStub([{ _id: 'club-1' }]));
  });

  it('applies editable fields, coerces numbers and resets the approval status', async () => {
    const event = eventDoc({ status: 'published' });
    Event.findOne.mockResolvedValue(event);

    const res = await request(app).put('/api/organizer/events/event-1').send({ title: 'New title', capacity: '20', latitude: '', organizer: 'someone-else' });

    expect(res.status).toBe(200);
    expect(event.title).toBe('New title');
    expect(event.capacity).toBe(20);
    expect(event.latitude).toBeNull();
    expect(event.organizer).toBe('org-1');
    expect(event.status).toBe('pending_approval');
    expect(event.save).toHaveBeenCalled();
  });

  it('400s when the new capacity is below the current registrations', async () => {
    const event = eventDoc({ bookedCount: 8 });
    Event.findOne.mockResolvedValue(event);

    const res = await request(app).put('/api/organizer/events/event-1').send({ capacity: '4' });

    expect(res.status).toBe(400);
    expect(event.save).not.toHaveBeenCalled();
  });

  it('404s for an event outside the organizer clubs', async () => {
    Event.findOne.mockResolvedValue(null);

    const res = await request(app).put('/api/organizer/events/event-9').send({ title: 'x' });

    expect(res.status).toBe(404);
  });

  it('500s when saving fails', async () => {
    const event = eventDoc();
    event.save.mockRejectedValue(new Error('db down'));
    Event.findOne.mockResolvedValue(event);

    const res = await request(app).put('/api/organizer/events/event-1').send({ title: 'x' });

    expect(res.status).toBe(500);
  });
});

describe('GET /api/organizer/events/:id/registrations', () => {
  beforeEach(() => {
    Club.find.mockReturnValue(queryStub([{ _id: 'club-1' }]));
  });

  it('returns the active registrations with attendee details', async () => {
    Event.findOne.mockResolvedValue(eventDoc());
    const stub = queryStub([{ id: 'booking-1' }]);
    Booking.find.mockReturnValue(stub);

    const res = await request(app).get('/api/organizer/events/event-1/registrations');

    expect(res.status).toBe(200);
    expect(Booking.find).toHaveBeenCalledWith({ event: 'event-1', status: { $in: ['confirmed', 'pending'] } });
    expect(stub.populate).toHaveBeenCalledWith('user', 'name email studentId department');
  });

  it('404s for an event the organizer does not own', async () => {
    Event.findOne.mockResolvedValue(null);

    const res = await request(app).get('/api/organizer/events/event-9/registrations');

    expect(res.status).toBe(404);
  });

  it('500s when the query fails', async () => {
    Event.findOne.mockResolvedValue(eventDoc());
    Booking.find.mockReturnValue(rejectingQueryStub(new Error('db down')));

    const res = await request(app).get('/api/organizer/events/event-1/registrations');

    expect(res.status).toBe(500);
  });
});

describe('POST /api/organizer/events/:id/announce', () => {
  beforeEach(() => {
    Club.find.mockReturnValue(queryStub([{ _id: 'club-1', followerIds: ['follower-1', 'user-1'] }]));
    Event.findOne.mockResolvedValue(eventDoc());
  });

  it('notifies registrants by default', async () => {
    Booking.find.mockReturnValue(queryStub([{ user: 'user-1' }, { user: 'user-2' }]));

    const res = await request(app).post('/api/organizer/events/event-1/announce').send({ title: ' Update ', message: ' Room moved ' });

    expect(res.status).toBe(200);
    expect(res.body.recipientCount).toBe(2);
    expect(Notification.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ user: 'user-1', type: 'announcement', title: 'Update', message: 'Room moved', link: 'event-details.html?id=event-1' }),
      expect.objectContaining({ user: 'user-2' })
    ]);
  });

  it('notifies club followers only when the audience is followers', async () => {
    const res = await request(app).post('/api/organizer/events/event-1/announce').send({ title: 'Update', message: 'Room moved', audience: 'followers' });

    expect(res.body.recipientCount).toBe(2);
    expect(Booking.find).not.toHaveBeenCalled();
  });

  it('deduplicates recipients across registrants and followers', async () => {
    Booking.find.mockReturnValue(queryStub([{ user: 'user-1' }]));

    const res = await request(app).post('/api/organizer/events/event-1/announce').send({ title: 'Update', message: 'Room moved', audience: 'both' });

    expect(res.body.recipientCount).toBe(2);
  });

  it('sends nothing when there are no recipients', async () => {
    Booking.find.mockReturnValue(queryStub([]));

    const res = await request(app).post('/api/organizer/events/event-1/announce').send({ title: 'Update', message: 'Room moved' });

    expect(res.body.recipientCount).toBe(0);
    expect(Notification.insertMany).not.toHaveBeenCalled();
  });

  it('400s without a title or message', async () => {
    const res = await request(app).post('/api/organizer/events/event-1/announce').send({ title: ' ', message: 'Room moved' });

    expect(res.status).toBe(400);
  });

  it('404s for an event the organizer does not own', async () => {
    Event.findOne.mockResolvedValue(null);

    const res = await request(app).post('/api/organizer/events/event-9/announce').send({ title: 'Update', message: 'Room moved' });

    expect(res.status).toBe(404);
  });

  it('500s when the notification insert fails', async () => {
    Booking.find.mockReturnValue(queryStub([{ user: 'user-1' }]));
    Notification.insertMany.mockRejectedValue(new Error('db down'));

    const res = await request(app).post('/api/organizer/events/event-1/announce').send({ title: 'Update', message: 'Room moved' });

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/organizer/registrations/:id/status', () => {
  function bookingDoc(overrides = {}) {
    return {
      id: 'booking-1',
      status: 'pending',
      user: { _id: 'user-1' },
      event: eventDoc(),
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides
    };
  }

  beforeEach(() => {
    Club.find.mockReturnValue(queryStub([clubDoc('club-1')]));
  });

  it('releases a seat when an active registration is rejected', async () => {
    const booking = bookingDoc();
    Booking.findById.mockReturnValue(queryStub(booking));

    const res = await request(app).put('/api/organizer/registrations/booking-1/status').send({ status: 'rejected' });

    expect(res.status).toBe(200);
    expect(booking.status).toBe('rejected');
    expect(booking.event.bookedCount).toBe(1);
    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({ user: 'user-1', type: 'booking' }));
  });

  it('claims a seat when an inactive registration is confirmed', async () => {
    const booking = bookingDoc({ status: 'cancelled' });
    Booking.findById.mockReturnValue(queryStub(booking));

    const res = await request(app).put('/api/organizer/registrations/booking-1/status').send({ status: 'confirmed' });

    expect(res.status).toBe(200);
    expect(booking.event.bookedCount).toBe(3);
  });

  it('400s when confirming would exceed the capacity', async () => {
    const booking = bookingDoc({ status: 'cancelled', event: eventDoc({ capacity: 2, bookedCount: 2 }) });
    Booking.findById.mockReturnValue(queryStub(booking));

    const res = await request(app).put('/api/organizer/registrations/booking-1/status').send({ status: 'confirmed' });

    expect(res.status).toBe(400);
    expect(booking.save).not.toHaveBeenCalled();
  });

  it('never lets the seat count fall below zero', async () => {
    const booking = bookingDoc({ event: eventDoc({ bookedCount: 0 }) });
    Booking.findById.mockReturnValue(queryStub(booking));

    await request(app).put('/api/organizer/registrations/booking-1/status').send({ status: 'cancelled' });

    expect(booking.event.bookedCount).toBe(0);
  });

  it('400s for an unsupported status', async () => {
    const res = await request(app).put('/api/organizer/registrations/booking-1/status').send({ status: 'attended' });

    expect(res.status).toBe(400);
    expect(Booking.findById).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown registration', null],
    ['a registration whose event was removed', { id: 'booking-1', event: null }]
  ])('404s for %s', async (_label, value) => {
    Booking.findById.mockReturnValue(queryStub(value));

    const res = await request(app).put('/api/organizer/registrations/booking-1/status').send({ status: 'confirmed' });

    expect(res.status).toBe(404);
  });

  it('403s when the event belongs to another organizer', async () => {
    Booking.findById.mockReturnValue(queryStub(bookingDoc({ event: eventDoc({ organizer: 'org-2' }) })));

    const res = await request(app).put('/api/organizer/registrations/booking-1/status').send({ status: 'confirmed' });

    expect(res.status).toBe(403);
  });

  it('403s when the event club is not one the organizer runs', async () => {
    Club.find.mockReturnValue(queryStub([clubDoc('club-9')]));
    Booking.findById.mockReturnValue(queryStub(bookingDoc()));

    const res = await request(app).put('/api/organizer/registrations/booking-1/status').send({ status: 'confirmed' });

    expect(res.status).toBe(403);
  });

  it('500s when saving fails', async () => {
    const booking = bookingDoc();
    booking.save.mockRejectedValue(new Error('db down'));
    Booking.findById.mockReturnValue(queryStub(booking));

    const res = await request(app).put('/api/organizer/registrations/booking-1/status').send({ status: 'rejected' });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/organizer/check-in', () => {
  function bookingDoc(overrides = {}) {
    return {
      id: 'booking-1',
      status: 'confirmed',
      checkedInAt: null,
      user: { _id: 'user-1' },
      event: eventDoc(),
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides
    };
  }

  beforeEach(() => {
    Club.find.mockReturnValue(queryStub([clubDoc('club-1')]));
  });

  it('checks the attendee in with an upper-cased code and notifies them', async () => {
    const booking = bookingDoc();
    Booking.findOne.mockReturnValue(queryStub(booking));

    const res = await request(app).post('/api/organizer/check-in').send({ code: ' ab12cd ' });

    expect(res.status).toBe(200);
    expect(Booking.findOne).toHaveBeenCalledWith({ checkInCode: 'AB12CD' });
    expect(booking.attendanceStatus).toBe('checked_in');
    expect(booking.checkedInAt).toBeInstanceOf(Date);
    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({ user: 'user-1', type: 'checkin' }));
  });

  it('400s without a code', async () => {
    const res = await request(app).post('/api/organizer/check-in').send({ code: '  ' });

    expect(res.status).toBe(400);
    expect(Booking.findOne).not.toHaveBeenCalled();
  });

  it('404s for an unknown pass', async () => {
    Booking.findOne.mockReturnValue(queryStub(null));

    const res = await request(app).post('/api/organizer/check-in').send({ code: 'AB12CD' });

    expect(res.status).toBe(404);
  });

  it('403s for an event outside the organizer clubs', async () => {
    Club.find.mockReturnValue(queryStub([clubDoc('club-9')]));
    Booking.findOne.mockReturnValue(queryStub(bookingDoc()));

    const res = await request(app).post('/api/organizer/check-in').send({ code: 'AB12CD' });

    expect(res.status).toBe(403);
  });

  it('400s when the registration is not confirmed', async () => {
    Booking.findOne.mockReturnValue(queryStub(bookingDoc({ status: 'pending' })));

    const res = await request(app).post('/api/organizer/check-in').send({ code: 'AB12CD' });

    expect(res.status).toBe(400);
  });

  it('409s when the attendee is already checked in', async () => {
    Booking.findOne.mockReturnValue(queryStub(bookingDoc({ checkedInAt: new Date() })));

    const res = await request(app).post('/api/organizer/check-in').send({ code: 'AB12CD' });

    expect(res.status).toBe(409);
  });

  it('500s when saving fails', async () => {
    const booking = bookingDoc();
    booking.save.mockRejectedValue(new Error('db down'));
    Booking.findOne.mockReturnValue(queryStub(booking));

    const res = await request(app).post('/api/organizer/check-in').send({ code: 'AB12CD' });

    expect(res.status).toBe(500);
  });
});
