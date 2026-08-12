const jwt = require('jsonwebtoken');

const ORIGINAL_ENV = process.env;

function loadAuth(env = {}) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env };
  return require('../../utils/auth');
}

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('generateToken', () => {
  it('embeds the public user claims in the token', () => {
    const { generateToken } = loadAuth({ JWT_SECRET: 'test_secret' });
    const token = generateToken({ id: 'u1', email: 'a@b.com', role: 'admin', name: 'Ann' });

    const decoded = jwt.verify(token, 'test_secret');
    expect(decoded).toMatchObject({ id: 'u1', email: 'a@b.com', role: 'admin', name: 'Ann' });
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
  });

  it('honours JWT_EXPIRES_IN', () => {
    const { generateToken } = loadAuth({ JWT_SECRET: 'test_secret', JWT_EXPIRES_IN: '1h' });
    const decoded = jwt.verify(generateToken({ id: 'u1' }), 'test_secret');
    expect(decoded.exp - decoded.iat).toBe(3600);
  });

  it('falls back to the development secret when JWT_SECRET is unset', () => {
    const env = { ...ORIGINAL_ENV };
    delete env.JWT_SECRET;
    jest.resetModules();
    process.env = env;
    const { generateToken } = require('../../utils/auth');

    expect(jwt.verify(generateToken({ id: 'u1' }), 'dev_secret_change_me').id).toBe('u1');
  });
});

describe('verifyToken', () => {
  it('round-trips a generated token', () => {
    const { generateToken, verifyToken } = loadAuth({ JWT_SECRET: 'test_secret' });
    expect(verifyToken(generateToken({ id: 'u9', role: 'user' })).id).toBe('u9');
  });

  it('rejects a token signed with a different secret', () => {
    const { verifyToken } = loadAuth({ JWT_SECRET: 'test_secret' });
    const foreign = jwt.sign({ id: 'u1' }, 'other_secret');
    expect(() => verifyToken(foreign)).toThrow('invalid signature');
  });

  it('rejects an expired token', () => {
    const { verifyToken } = loadAuth({ JWT_SECRET: 'test_secret' });
    const expired = jwt.sign({ id: 'u1' }, 'test_secret', { expiresIn: -10 });
    expect(() => verifyToken(expired)).toThrow('jwt expired');
  });

  it('rejects a malformed token', () => {
    const { verifyToken } = loadAuth({ JWT_SECRET: 'test_secret' });
    expect(() => verifyToken('not-a-token')).toThrow();
  });
});
