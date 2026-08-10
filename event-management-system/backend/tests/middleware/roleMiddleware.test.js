const { organizerOnly } = require('../../middleware/roleMiddleware');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('organizerOnly', () => {
  it.each(['organizer', 'admin'])('allows role %s through', (role) => {
    const res = mockRes();
    const next = jest.fn();

    organizerOnly({ user: { role } }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a plain user with 403', () => {
    const res = mockRes();
    const next = jest.fn();

    organizerOnly({ user: { role: 'user' } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Organizer access required.' });
  });

  it('rejects an unauthenticated request', () => {
    const res = mockRes();
    const next = jest.fn();

    organizerOnly({}, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
