jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => { req.user = { id: 'user-1', role: 'user' }; next(); },
  adminOnly: (req, res, next) => next()
}));
jest.mock('../../models/Notification', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  updateMany: jest.fn(),
  findOneAndUpdate: jest.fn()
}));

const request = require('supertest');
const Notification = require('../../models/Notification');
const notificationRoutes = require('../../routes/notificationRoutes');
const { createApp, queryStub, rejectingQueryStub } = require('../helpers/testApp');

const app = createApp('/api/notifications', notificationRoutes);

describe('GET /api/notifications/my', () => {
  it('returns the caller notifications with the unread count', async () => {
    Notification.find.mockReturnValue(queryStub([{ id: 'n1' }]));
    Notification.countDocuments.mockResolvedValue(1);

    const res = await request(app).get('/api/notifications/my');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ notifications: [{ id: 'n1' }], unreadCount: 1 });
    expect(Notification.find).toHaveBeenCalledWith({ user: 'user-1' });
    expect(Notification.countDocuments).toHaveBeenCalledWith({ user: 'user-1', readAt: null });
  });

  it('500s when the query fails', async () => {
    Notification.find.mockReturnValue(rejectingQueryStub(new Error('db down')));

    const res = await request(app).get('/api/notifications/my');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Could not load notifications.');
  });
});

describe('PUT /api/notifications/read-all', () => {
  it('stamps readAt on every unread notification', async () => {
    Notification.updateMany.mockResolvedValue({ modifiedCount: 3 });

    const res = await request(app).put('/api/notifications/read-all');

    expect(res.status).toBe(200);
    const [filter, update] = Notification.updateMany.mock.calls[0];
    expect(filter).toEqual({ user: 'user-1', readAt: null });
    expect(update.readAt).toBeInstanceOf(Date);
  });

  it('500s when the update fails', async () => {
    Notification.updateMany.mockRejectedValue(new Error('db down'));

    const res = await request(app).put('/api/notifications/read-all');

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/notifications/:id/read', () => {
  it('marks one notification owned by the caller as read', async () => {
    Notification.findOneAndUpdate.mockResolvedValue({ id: 'n1', readAt: new Date() });

    const res = await request(app).put('/api/notifications/n1/read');

    expect(res.status).toBe(200);
    expect(res.body.notification.id).toBe('n1');
    expect(Notification.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: 'n1', user: 'user-1' });
  });

  it('404s for a notification the caller does not own', async () => {
    Notification.findOneAndUpdate.mockResolvedValue(null);

    const res = await request(app).put('/api/notifications/n1/read');

    expect(res.status).toBe(404);
  });

  it('500s when the update fails', async () => {
    Notification.findOneAndUpdate.mockRejectedValue(new Error('db down'));

    const res = await request(app).put('/api/notifications/n1/read');

    expect(res.status).toBe(500);
  });
});
