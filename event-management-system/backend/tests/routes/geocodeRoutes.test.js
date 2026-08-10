jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, res, next) => { req.user = { id: 'admin-1', role: 'admin' }; next(); },
  adminOnly: (req, res, next) => next()
}));

const request = require('supertest');
const geocodeRoutes = require('../../routes/geocodeRoutes');
const { createApp } = require('../helpers/testApp');

const app = createApp('/api/geocode', geocodeRoutes);

// The route throttles itself to one upstream call per 1.1s, so uncached lookups
// are intentionally slow.
jest.setTimeout(20000);

function nominatimResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

beforeEach(() => {
  global.fetch = jest.fn();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  delete global.fetch;
});

describe('GET /api/geocode validation', () => {
  it('400s without an address', async () => {
    const res = await request(app).get('/api/geocode');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Please enter an event location.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('400s for an address shorter than 3 characters', async () => {
    const res = await request(app).get('/api/geocode').query({ address: 'ab' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Please enter a more complete event location.');
  });
});

describe('GET /api/geocode lookups', () => {
  it('returns normalized coordinates from the first Nominatim match', async () => {
    global.fetch.mockResolvedValue(nominatimResponse([{ lat: '12.5', lon: '-70.25', display_name: 'Aruba' }]));

    const res = await request(app).get('/api/geocode').query({ address: 'Aruba Beach' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ latitude: 12.5, longitude: -70.25, displayName: 'Aruba', source: 'OpenStreetMap' });

    const [url, options] = global.fetch.mock.calls[0];
    expect(String(url)).toContain('q=Aruba+Beach');
    expect(String(url)).toContain('format=jsonv2');
    expect(options.headers['User-Agent']).toMatch(/^EventHub/);
  });

  it('serves a repeat lookup from cache without calling Nominatim again', async () => {
    global.fetch.mockResolvedValue(nominatimResponse([{ lat: '1', lon: '2', display_name: 'Cached Place' }]));
    await request(app).get('/api/geocode').query({ address: 'Cached Place' });
    global.fetch.mockClear();

    const res = await request(app).get('/api/geocode').query({ address: '  cached   PLACE ' });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Cached Place');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to the requested address when Nominatim omits display_name', async () => {
    global.fetch.mockResolvedValue(nominatimResponse([{ lat: '3', lon: '4' }]));

    const res = await request(app).get('/api/geocode').query({ address: 'No Display Name' });

    expect(res.body.displayName).toBe('No Display Name');
  });

  it('404s when Nominatim has no match', async () => {
    global.fetch.mockResolvedValue(nominatimResponse([]));

    const res = await request(app).get('/api/geocode').query({ address: 'Nowhere At All' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Location not found/);
  });

  it('502s when Nominatim returns an error status', async () => {
    global.fetch.mockResolvedValue(nominatimResponse(null, false, 503));

    const res = await request(app).get('/api/geocode').query({ address: 'Service Down Street' });

    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/temporarily unavailable/);
  });

  it('502s when the returned coordinates are not numbers', async () => {
    global.fetch.mockResolvedValue(nominatimResponse([{ lat: 'abc', lon: 'def' }]));

    const res = await request(app).get('/api/geocode').query({ address: 'Bad Coordinates Road' });

    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/invalid coordinates/);
  });

  it('502s when the upstream request throws', async () => {
    global.fetch.mockRejectedValue(new Error('network unreachable'));

    const res = await request(app).get('/api/geocode').query({ address: 'Offline Avenue' });

    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/Could not look up this location/);
  });
});
