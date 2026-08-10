jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => { req.user = { ...global.__testUser }; next(); },
  adminOnly: (req, res, next) => (req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Admin access required.' }))
}));
jest.mock('../../models/Category', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn()
}));

const request = require('supertest');
const Category = require('../../models/Category');
const categoryRoutes = require('../../routes/categoryRoutes');
const { createApp, queryStub, rejectingQueryStub } = require('../helpers/testApp');

const app = createApp('/api/categories', categoryRoutes);

function categoryDoc(overrides = {}) {
  return { id: 'c1', name: 'Music', save: jest.fn().mockResolvedValue(undefined), deleteOne: jest.fn().mockResolvedValue(undefined), ...overrides };
}

beforeEach(() => {
  global.__testUser = { id: 'admin-1', role: 'admin' };
});

describe('GET /api/categories', () => {
  it('is public and returns categories sorted by name', async () => {
    const stub = queryStub([{ id: 'c1', name: 'Music' }]);
    Category.find.mockReturnValue(stub);

    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(1);
    expect(stub.sort).toHaveBeenCalledWith({ name: 1 });
  });

  it('500s when the query fails', async () => {
    Category.find.mockReturnValue(rejectingQueryStub(new Error('db down')));

    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(500);
  });
});

describe('POST /api/categories', () => {
  it('creates a trimmed category', async () => {
    Category.findOne.mockResolvedValue(null);
    Category.create.mockImplementation(async (doc) => ({ id: 'c2', ...doc }));

    const res = await request(app).post('/api/categories').send({ name: '  Sports  ' });

    expect(res.status).toBe(201);
    expect(Category.create).toHaveBeenCalledWith({ name: 'Sports' });
  });

  it('matches existing names case-insensitively', async () => {
    Category.findOne.mockResolvedValue(categoryDoc());

    const res = await request(app).post('/api/categories').send({ name: 'music' });

    expect(res.status).toBe(409);
    expect(Category.findOne.mock.calls[0][0].name).toEqual(new RegExp('^music$', 'i'));
    expect(Category.create).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '   '])('400s for name %p', async (name) => {
    const res = await request(app).post('/api/categories').send({ name });

    expect(res.status).toBe(400);
  });

  it('403s for a non-admin', async () => {
    global.__testUser = { id: 'user-1', role: 'user' };

    const res = await request(app).post('/api/categories').send({ name: 'Sports' });

    expect(res.status).toBe(403);
  });

  it('500s when the insert fails', async () => {
    Category.findOne.mockResolvedValue(null);
    Category.create.mockRejectedValue(new Error('db down'));

    const res = await request(app).post('/api/categories').send({ name: 'Sports' });

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/categories/:id', () => {
  it('renames a category', async () => {
    const category = categoryDoc();
    Category.findById.mockResolvedValue(category);

    const res = await request(app).put('/api/categories/c1').send({ name: '  Arts ' });

    expect(res.status).toBe(200);
    expect(category.name).toBe('Arts');
    expect(category.save).toHaveBeenCalled();
  });

  it('400s for a blank name', async () => {
    const res = await request(app).put('/api/categories/c1').send({ name: ' ' });

    expect(res.status).toBe(400);
    expect(Category.findById).not.toHaveBeenCalled();
  });

  it('404s for an unknown category', async () => {
    Category.findById.mockResolvedValue(null);

    const res = await request(app).put('/api/categories/c9').send({ name: 'Arts' });

    expect(res.status).toBe(404);
  });

  it('500s when saving fails', async () => {
    const category = categoryDoc();
    category.save.mockRejectedValue(new Error('db down'));
    Category.findById.mockResolvedValue(category);

    const res = await request(app).put('/api/categories/c1').send({ name: 'Arts' });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/categories/:id', () => {
  it('deletes a category', async () => {
    const category = categoryDoc();
    Category.findById.mockResolvedValue(category);

    const res = await request(app).delete('/api/categories/c1');

    expect(res.status).toBe(200);
    expect(category.deleteOne).toHaveBeenCalled();
  });

  it('404s for an unknown category', async () => {
    Category.findById.mockResolvedValue(null);

    const res = await request(app).delete('/api/categories/c9');

    expect(res.status).toBe(404);
  });

  it('500s when the delete fails', async () => {
    const category = categoryDoc();
    category.deleteOne.mockRejectedValue(new Error('db down'));
    Category.findById.mockResolvedValue(category);

    const res = await request(app).delete('/api/categories/c1');

    expect(res.status).toBe(500);
  });
});
