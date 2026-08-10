jest.mock('../../models/User', () => ({ countDocuments: jest.fn(), create: jest.fn() }));
jest.mock('../../models/Category', () => ({ countDocuments: jest.fn(), insertMany: jest.fn() }));
jest.mock('../../models/Event', () => ({ countDocuments: jest.fn(), insertMany: jest.fn() }));

const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Category = require('../../models/Category');
const Event = require('../../models/Event');
const seedDatabase = require('../../utils/seed');

let logSpy;

beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  User.countDocuments.mockResolvedValue(0);
  Category.countDocuments.mockResolvedValue(0);
  Event.countDocuments.mockResolvedValue(0);
  User.create.mockResolvedValue({});
  Category.insertMany.mockResolvedValue([]);
  Event.insertMany.mockResolvedValue([]);
});

afterEach(() => {
  logSpy.mockRestore();
});

it('creates a hashed default admin on an empty database', async () => {
  await seedDatabase();

  expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
    email: 'admin@events.com',
    role: 'admin',
    status: 'active',
    emailVerified: true
  }));
  const { password } = User.create.mock.calls[0][0];
  expect(password).not.toBe('Admin@123');
  expect(bcrypt.compareSync('Admin@123', password)).toBe(true);
});

it('seeds the default categories and sample events', async () => {
  await seedDatabase();

  expect(Category.insertMany.mock.calls[0][0].map((c) => c.name)).toEqual(['Conference', 'Workshop', 'Concert', 'Sports', 'Networking']);
  const events = Event.insertMany.mock.calls[0][0];
  expect(events).toHaveLength(7);
  events.forEach((event) => {
    expect(event).toMatchObject({ status: 'published', bookedCount: 0 });
    expect(event.capacity).toBeGreaterThan(0);
    expect(Category.insertMany.mock.calls[0][0].map((c) => c.name)).toContain(event.category);
  });
});

it('is idempotent once data exists', async () => {
  User.countDocuments.mockResolvedValue(1);
  Category.countDocuments.mockResolvedValue(5);
  Event.countDocuments.mockResolvedValue(7);

  await seedDatabase();

  expect(User.create).not.toHaveBeenCalled();
  expect(Category.insertMany).not.toHaveBeenCalled();
  expect(Event.insertMany).not.toHaveBeenCalled();
});

it('seeds only the collections that are empty', async () => {
  User.countDocuments.mockResolvedValue(1);

  await seedDatabase();

  expect(User.create).not.toHaveBeenCalled();
  expect(Category.insertMany).toHaveBeenCalled();
  expect(Event.insertMany).toHaveBeenCalled();
});
