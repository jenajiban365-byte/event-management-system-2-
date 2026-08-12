jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => { req.user = { id: 'user-1', role: 'user' }; next(); },
  adminOnly: (req, res, next) => next()
}));
jest.mock('../../models/SavedEvent', () => ({
  find: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn()
}));
jest.mock('../../models/Event', () => ({ findOne: jest.fn() }));

const request = require('supertest');
const SavedEvent = require('../../models/SavedEvent');
const Event = require('../../models/Event');
const savedEventRoutes = require('../../routes/savedEventRoutes');
const { createApp, queryStub, rejectingQueryStub } = require('../helpers/testApp');

const app = createApp('/api/saved-events', savedEventRoutes);

describe('GET /api/saved-events', () => {
  it('returns only saved entries whose event is still published', async () => {
    SavedEvent.find.mockReturnValue(queryStub([
      { id: 's1', event: { id: 'e1', status: 'published' } },
      { id: 's2', event: { id: 'e2', status: 'draft' } },
      { id: 's3', event: null }
    ]));

    const res = await request(app).get('/api/saved-events');

    expect(res.status).toBe(200);
    expect(res.body.savedEvents).toHaveLength(1);
    expect(res.body.savedEvents[0].id).toBe('s1');
    expect(SavedEvent.find).toHaveBeenCalledWith({ user: 'user-1' });
  });

  it('500s when the query fails', async () => {
    SavedEvent.find.mockReturnValue(rejectingQueryStub(new Error('db down')));

    const res = await request(app).get('/api/saved-events');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('db down');
  });
});

describe('GET /api/saved-events/ids', () => {
  it('returns the saved event ids as strings', async () => {
    SavedEvent.find.mockReturnValue(queryStub([{ event: 'e1' }, { event: 'e2' }]));

    const res = await request(app).get('/api/saved-events/ids');

    expect(res.body).toEqual({ eventIds: ['e1', 'e2'] });
  });

  it('500s when the query fails', async () => {
    SavedEvent.find.mockReturnValue(rejectingQueryStub(new Error('db down')));

    const res = await request(app).get('/api/saved-events/ids');

    expect(res.status).toBe(500);
  });
});

describe('POST /api/saved-events/:eventId', () => {
  it('upserts the save so repeat calls stay idempotent', async () => {
    Event.findOne.mockResolvedValue({ id: 'e1' });
    SavedEvent.updateOne.mockResolvedValue({ upsertedCount: 1 });

    const res = await request(app).post('/api/saved-events/e1');

    expect(res.status).toBe(201);
    expect(Event.findOne).toHaveBeenCalledWith({ _id: 'e1', status: 'published' });
    expect(SavedEvent.updateOne).toHaveBeenCalledWith(
      { user: 'user-1', event: 'e1' },
      { $setOnInsert: { user: 'user-1', event: 'e1' } },
      { upsert: true }
    );
  });

  it('404s for an event that is missing or unpublished', async () => {
    Event.findOne.mockResolvedValue(null);

    const res = await request(app).post('/api/saved-events/e1');

    expect(res.status).toBe(404);
    expect(SavedEvent.updateOne).not.toHaveBeenCalled();
  });

  it('500s when the upsert fails', async () => {
    Event.findOne.mockResolvedValue({ id: 'e1' });
    SavedEvent.updateOne.mockRejectedValue(new Error('db down'));

    const res = await request(app).post('/api/saved-events/e1');

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/saved-events/:eventId', () => {
  it('removes the saved event', async () => {
    SavedEvent.deleteOne.mockResolvedValue({ deletedCount: 1 });

    const res = await request(app).delete('/api/saved-events/e1');

    expect(res.status).toBe(200);
    expect(SavedEvent.deleteOne).toHaveBeenCalledWith({ user: 'user-1', event: 'e1' });
  });

  it('500s when the delete fails', async () => {
    SavedEvent.deleteOne.mockRejectedValue(new Error('db down'));

    const res = await request(app).delete('/api/saved-events/e1');

    expect(res.status).toBe(500);
  });
});
