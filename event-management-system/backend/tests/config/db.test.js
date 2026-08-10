jest.mock('mongoose', () => ({ connect: jest.fn() }));

const mongoose = require('mongoose');
const connectDB = require('../../config/db');

let exitSpy;
let logSpy;
let errorSpy;

beforeEach(() => {
  exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
});

afterEach(() => {
  exitSpy.mockRestore();
  logSpy.mockRestore();
  errorSpy.mockRestore();
  delete process.env.MONGODB_URI;
});

it('connects with a bounded server selection timeout', async () => {
  mongoose.connect.mockResolvedValue(undefined);

  await connectDB();

  expect(mongoose.connect).toHaveBeenCalledWith('mongodb://localhost:27017/test', { serverSelectionTimeoutMS: 8000 });
  expect(exitSpy).not.toHaveBeenCalled();
});

it('exits when MONGODB_URI is missing', async () => {
  delete process.env.MONGODB_URI;

  mongoose.connect.mockResolvedValue(undefined);

  await connectDB();

  expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('MONGODB_URI is not set'));
  expect(exitSpy).toHaveBeenCalledWith(1);
});

it('exits when the connection fails', async () => {
  mongoose.connect.mockRejectedValue(new Error('unreachable'));

  await connectDB();

  expect(errorSpy).toHaveBeenCalledWith('MongoDB connection failed:', 'unreachable');
  expect(exitSpy).toHaveBeenCalledWith(1);
});
