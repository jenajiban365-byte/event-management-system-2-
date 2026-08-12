const {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWaitlistPromotedEmail,
  sendContactFormEmail
} = require('../../utils/email');

const ORIGINAL_ENV = process.env;

function okResponse() {
  return { ok: true, status: 200, text: async () => '' };
}

function lastPayload() {
  return JSON.parse(global.fetch.mock.calls[0][1].body);
}

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    BREVO_API_KEY: 'key-123',
    EMAIL_FROM: 'support@eventhub.test',
    APP_URL: 'https://eventhub.test/'
  };
  global.fetch = jest.fn().mockResolvedValue(okResponse());
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  delete global.fetch;
});

describe('Brevo transport', () => {
  it('posts to the Brevo API with the configured sender and api key', async () => {
    await sendWelcomeEmail('Ann', 'ann@example.com');

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(options.method).toBe('POST');
    expect(options.headers['api-key']).toBe('key-123');
    expect(lastPayload()).toMatchObject({
      sender: { name: 'EventHub', email: 'support@eventhub.test' },
      to: [{ email: 'ann@example.com', name: 'Ann' }],
      subject: 'Welcome to EventHub'
    });
  });

  it('throws when BREVO_API_KEY is missing', async () => {
    delete process.env.BREVO_API_KEY;
    await expect(sendWelcomeEmail('Ann', 'ann@example.com')).rejects.toThrow(/Brevo email configuration is missing/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws when EMAIL_FROM is missing', async () => {
    delete process.env.EMAIL_FROM;
    await expect(sendWelcomeEmail('Ann', 'ann@example.com')).rejects.toThrow(/Brevo email configuration is missing/);
  });

  it('surfaces the Brevo error body when the API rejects the request', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 402, text: async () => 'credits exhausted' });

    await expect(sendWelcomeEmail('Ann', 'ann@example.com')).rejects.toThrow('Brevo API error (402): credits exhausted');
  });
});

describe('link building', () => {
  it('strips the trailing slash from APP_URL', async () => {
    await sendWelcomeEmail('Ann', 'ann@example.com');
    expect(lastPayload().htmlContent).toContain('https://eventhub.test/events.html');
  });

  it('falls back to localhost when APP_URL is unset', async () => {
    delete process.env.APP_URL;
    await sendWelcomeEmail('Ann', 'ann@example.com');
    expect(lastPayload().htmlContent).toContain('http://localhost:5000/events.html');
  });

  it('url-encodes the verification token', async () => {
    await sendVerificationEmail('Ann', 'ann@example.com', 'a b/c+d');

    const payload = lastPayload();
    expect(payload.subject).toBe('Verify your EventHub email');
    expect(payload.htmlContent).toContain('verify-email.html?token=a%20b%2Fc%2Bd');
  });

  it('url-encodes the password reset token', async () => {
    await sendPasswordResetEmail('Ann', 'ann@example.com', 'tok/en');

    const payload = lastPayload();
    expect(payload.subject).toBe('Reset your EventHub password');
    expect(payload.htmlContent).toContain('reset-password.html?token=tok%2Fen');
  });

  it('links the waitlist promotion email to the event details page', async () => {
    await sendWaitlistPromotedEmail('Ann', 'ann@example.com', { id: 'evt 1', title: 'Hack Night' });

    const payload = lastPayload();
    expect(payload.subject).toBe("You're confirmed: Hack Night");
    expect(payload.htmlContent).toContain('event-details.html?id=evt%201');
    expect(payload.htmlContent).toContain('Hack Night');
  });
});

describe('html escaping', () => {
  it('escapes user-supplied values so they cannot inject markup', async () => {
    await sendWelcomeEmail('<script>alert(1)</script>', 'ann+"x"@example.com');

    const html = lastPayload().htmlContent;
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('ann+&quot;x&quot;@example.com');
  });

  it('escapes the event title in the waitlist email', async () => {
    await sendWaitlistPromotedEmail('Ann', 'ann@example.com', { id: '1', title: "Ann's <b>Party</b>" });

    const html = lastPayload().htmlContent;
    expect(html).toContain('Ann&#39;s &lt;b&gt;Party&lt;/b&gt;');
  });
});

describe('sendContactFormEmail', () => {
  it('sends to the support inbox with the visitor as reply-to', async () => {
    await sendContactFormEmail('Bob', 'bob@example.com', 'Need help', 'Line one\nLine two');

    const payload = lastPayload();
    expect(payload.to).toEqual([{ email: 'support@eventhub.test', name: 'EventHub Support' }]);
    expect(payload.replyTo).toEqual({ email: 'bob@example.com', name: 'Bob' });
    expect(payload.subject).toBe('[Contact Form] Need help');
    expect(payload.htmlContent).toContain('Line one<br>Line two');
  });
});
