const express = require('express');

// Builds a minimal Express app around a single router so route handlers can be
// exercised in isolation with supertest.
function createApp(mountPath, router) {
  const app = express();
  app.use(express.json({ limit: '3mb' })); // matches server.js
  app.use(mountPath, router);
  app.use((err, req, res, next) => res.status(500).json({ message: err.message }));
  return app;
}

// Mongoose query objects are chainable; this returns a thenable stub whose
// chained calls (sort/limit/populate/select) all resolve to the same result.
function queryStub(result) {
  const stub = {
    sort: jest.fn(() => stub),
    limit: jest.fn(() => stub),
    skip: jest.fn(() => stub),
    select: jest.fn(() => stub),
    populate: jest.fn(() => stub),
    lean: jest.fn(() => stub),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (reject) => Promise.resolve(result).catch(reject)
  };
  return stub;
}

function rejectingQueryStub(error) {
  const stub = {
    sort: jest.fn(() => stub),
    limit: jest.fn(() => stub),
    skip: jest.fn(() => stub),
    select: jest.fn(() => stub),
    populate: jest.fn(() => stub),
    lean: jest.fn(() => stub),
    then: (resolve, reject) => Promise.reject(error).then(resolve, reject),
    catch: (reject) => Promise.reject(error).catch(reject)
  };
  return stub;
}

module.exports = { createApp, queryStub, rejectingQueryStub };
