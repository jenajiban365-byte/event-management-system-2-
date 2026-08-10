jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => { req.user = { ...global.__testUser }; next(); },
  adminOnly: (req, res, next) => next()
}));
jest.mock('../../models/SupportTicket', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn()
}));
jest.mock('../../models/User', () => ({ find: jest.fn() }));
jest.mock('../../models/Notification', () => ({ create: jest.fn(), insertMany: jest.fn() }));

const request = require('supertest');
const SupportTicket = require('../../models/SupportTicket');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const supportRoutes = require('../../routes/supportRoutes');
const { createApp, queryStub, rejectingQueryStub } = require('../helpers/testApp');

const app = createApp('/api/support', supportRoutes);

beforeEach(() => {
  global.__testUser = { id: 'user-1', name: 'Ann', email: 'ann@example.com', role: 'user' };
  Notification.create.mockResolvedValue({});
  Notification.insertMany.mockResolvedValue([]);
});

describe('POST /api/support', () => {
  it('opens a ticket and notifies every active staff member', async () => {
    SupportTicket.create.mockImplementation(async (doc) => ({ id: 't1', ...doc }));
    User.find.mockReturnValue(queryStub([{ _id: 'admin-1' }, { _id: 'org-1' }]));

    const res = await request(app).post('/api/support').send({ subject: ' Help ', message: ' It broke ' });

    expect(res.status).toBe(201);
    expect(SupportTicket.create).toHaveBeenCalledWith(expect.objectContaining({
      requester: 'user-1',
      email: 'ann@example.com',
      subject: 'Help',
      messages: [{ sender: 'user-1', senderName: 'Ann', body: 'It broke' }]
    }));
    expect(User.find).toHaveBeenCalledWith({ role: { $in: ['admin', 'organizer'] }, status: 'active' });
    expect(Notification.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ user: 'admin-1', type: 'support' }),
      expect.objectContaining({ user: 'org-1', type: 'support' })
    ]);
  });

  it('skips notifications when there is no staff', async () => {
    SupportTicket.create.mockResolvedValue({ id: 't1' });
    User.find.mockReturnValue(queryStub([]));

    const res = await request(app).post('/api/support').send({ subject: 'Help', message: 'It broke' });

    expect(res.status).toBe(201);
    expect(Notification.insertMany).not.toHaveBeenCalled();
  });

  it.each([
    [{ message: 'It broke' }],
    [{ subject: 'Help' }],
    [{ subject: '  ', message: '  ' }]
  ])('400s on incomplete payload %#', async (body) => {
    const res = await request(app).post('/api/support').send(body);

    expect(res.status).toBe(400);
    expect(SupportTicket.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ subject: 'a'.repeat(201), message: 'ok' }],
    [{ subject: 'ok', message: 'a'.repeat(5001) }]
  ])('400s on oversized payload %#', async (body) => {
    const res = await request(app).post('/api/support').send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Message is too long.');
  });

  it('500s when the insert fails', async () => {
    SupportTicket.create.mockRejectedValue(new Error('db down'));

    const res = await request(app).post('/api/support').send({ subject: 'Help', message: 'It broke' });

    expect(res.status).toBe(500);
  });
});

describe('GET /api/support/mine', () => {
  it('returns the caller conversations', async () => {
    const stub = queryStub([{ id: 't1' }]);
    SupportTicket.find.mockReturnValue(stub);

    const res = await request(app).get('/api/support/mine');

    expect(res.status).toBe(200);
    expect(SupportTicket.find).toHaveBeenCalledWith({ requester: 'user-1' });
    expect(stub.sort).toHaveBeenCalledWith({ updatedAt: -1 });
  });

  it('500s when the query fails', async () => {
    SupportTicket.find.mockReturnValue(rejectingQueryStub(new Error('db down')));

    const res = await request(app).get('/api/support/mine');

    expect(res.status).toBe(500);
  });
});

describe('GET /api/support (staff inbox)', () => {
  it.each(['admin', 'organizer'])('is readable by %s', async (role) => {
    global.__testUser = { id: 's1', name: 'Staff', email: 's@x.com', role };
    SupportTicket.find.mockReturnValue(queryStub([{ id: 't1' }]));

    const res = await request(app).get('/api/support');

    expect(res.status).toBe(200);
  });

  it('403s for a plain user', async () => {
    const res = await request(app).get('/api/support');

    expect(res.status).toBe(403);
    expect(SupportTicket.find).not.toHaveBeenCalled();
  });
});

describe('POST /api/support/:id/reply', () => {
  beforeEach(() => {
    global.__testUser = { id: 'admin-1', name: 'Root', email: 'root@x.com', role: 'admin' };
  });

  function ticketDoc(overrides = {}) {
    return { id: 't1', subject: 'Help', requester: 'user-1', status: 'resolved', messages: [], save: jest.fn().mockResolvedValue(undefined), ...overrides };
  }

  it('appends the reply, reopens the ticket and notifies the requester', async () => {
    const ticket = ticketDoc();
    SupportTicket.findById.mockResolvedValue(ticket);

    const res = await request(app).post('/api/support/t1/reply').send({ message: ' On it ' });

    expect(res.status).toBe(200);
    expect(ticket.messages).toEqual([{ sender: 'admin-1', senderName: 'Root', body: 'On it' }]);
    expect(ticket.status).toBe('open');
    expect(Notification.create).toHaveBeenCalledWith(expect.objectContaining({ user: 'user-1', type: 'support' }));
  });

  it('403s for a plain user', async () => {
    global.__testUser = { id: 'user-1', name: 'Ann', email: 'ann@example.com', role: 'user' };

    const res = await request(app).post('/api/support/t1/reply').send({ message: 'hi' });

    expect(res.status).toBe(403);
  });

  it.each(['', '  ', 'a'.repeat(5001)])('400s for reply %#', async (message) => {
    const res = await request(app).post('/api/support/t1/reply').send({ message });

    expect(res.status).toBe(400);
  });

  it('404s for an unknown conversation', async () => {
    SupportTicket.findById.mockResolvedValue(null);

    const res = await request(app).post('/api/support/t9/reply').send({ message: 'hi' });

    expect(res.status).toBe(404);
  });

  it('500s when saving fails', async () => {
    const ticket = ticketDoc();
    ticket.save.mockRejectedValue(new Error('db down'));
    SupportTicket.findById.mockResolvedValue(ticket);

    const res = await request(app).post('/api/support/t1/reply').send({ message: 'hi' });

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/support/:id/status', () => {
  beforeEach(() => {
    global.__testUser = { id: 'admin-1', name: 'Root', email: 'root@x.com', role: 'admin' };
  });

  it('resolves a conversation', async () => {
    SupportTicket.findByIdAndUpdate.mockResolvedValue({ id: 't1', status: 'resolved' });

    const res = await request(app).put('/api/support/t1/status').send({ status: 'resolved' });

    expect(res.status).toBe(200);
    expect(SupportTicket.findByIdAndUpdate).toHaveBeenCalledWith('t1', { status: 'resolved' }, { new: true });
  });

  it('treats any other value as reopening the conversation', async () => {
    SupportTicket.findByIdAndUpdate.mockResolvedValue({ id: 't1', status: 'open' });

    await request(app).put('/api/support/t1/status').send({ status: 'archived' });

    expect(SupportTicket.findByIdAndUpdate).toHaveBeenCalledWith('t1', { status: 'open' }, { new: true });
  });

  it('403s for a plain user', async () => {
    global.__testUser = { id: 'user-1', name: 'Ann', email: 'ann@example.com', role: 'user' };

    const res = await request(app).put('/api/support/t1/status').send({ status: 'resolved' });

    expect(res.status).toBe(403);
  });

  it('404s for an unknown conversation', async () => {
    SupportTicket.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app).put('/api/support/t9/status').send({ status: 'resolved' });

    expect(res.status).toBe(404);
  });

  it('500s when the update fails', async () => {
    SupportTicket.findByIdAndUpdate.mockRejectedValue(new Error('db down'));

    const res = await request(app).put('/api/support/t1/status').send({ status: 'resolved' });

    expect(res.status).toBe(500);
  });
});
