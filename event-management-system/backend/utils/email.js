const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function appUrl() {
  return String(process.env.APP_URL || 'http://localhost:5000').replace(/\/$/, '');
}

function htmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function sendEmail({ to, toName, subject, htmlContent }) {
  if (!process.env.BREVO_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error('Brevo email configuration is missing. Set BREVO_API_KEY and EMAIL_FROM.');
  }
  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'api-key': process.env.BREVO_API_KEY },
    body: JSON.stringify({ sender: { name: 'EventHub', email: process.env.EMAIL_FROM }, to: [{ email: to, name: toName }], subject, htmlContent })
  });
  if (!response.ok) throw new Error(`Brevo API error (${response.status}): ${await response.text()}`);
}

const baseEmail = (eyebrow, title, body, ctaText, ctaUrl) => `
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${htmlEscape(title)}</title></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;background:#f4f4f5"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#111;padding:28px 36px"><div style="font-size:24px;font-weight:700;color:#fff">Event<span style="color:#f59e0b">Hub</span></div></td></tr>
<tr><td style="padding:42px 36px 36px"><p style="margin:0 0 8px;font-size:12px;color:#71717a;letter-spacing:.08em">${htmlEscape(eyebrow)}</p>
<h1 style="margin:0 0 20px;font-size:28px;line-height:1.2">${htmlEscape(title)}</h1>
<div style="font-size:16px;line-height:1.7;color:#3f3f46">${body}</div>
<table cellpadding="0" cellspacing="0" style="margin-top:28px"><tr><td style="background:#f59e0b;border-radius:7px"><a href="${htmlEscape(ctaUrl)}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:600;color:#111;text-decoration:none">${htmlEscape(ctaText)}</a></td></tr></table>
<p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#71717a">If you did not request this, you can safely ignore this email.</p></td></tr>
<tr><td style="border-top:1px solid #e4e4e7;padding:24px 36px;background:#fafafa"><strong>EventHub</strong><p style="margin:8px 0 0;font-size:12px;color:#71717a">Discover. Connect. Experience.</p></td></tr>
</table></td></tr></table></body></html>`;

const sendWelcomeEmail = async (name, email) => {
  const safeName = htmlEscape(name); const safeEmail = htmlEscape(email);
  const htmlContent = baseEmail('ACCOUNT CREATED', 'Welcome to EventHub.', `<p>Hello ${safeName},</p><p>Your account has been created successfully. Verify your email to unlock sign-in and start booking events.</p><p style="font-size:14px;color:#52525b">Registered email: ${safeEmail}</p>`, 'Open EventHub', `${appUrl()}/events.html`);
  await sendEmail({ to: email, toName: name, subject: 'Welcome to EventHub', htmlContent });
};

const sendVerificationEmail = async (name, email, token) => {
  const url = `${appUrl()}/verify-email.html?token=${encodeURIComponent(token)}`;
  const htmlContent = baseEmail('EMAIL VERIFICATION', 'Confirm your email address', `<p>Hello ${htmlEscape(name)},</p><p>Please confirm your email address to activate your EventHub sign-in.</p><p style="font-size:13px;color:#71717a;word-break:break-all">${htmlEscape(url)}</p>`, 'Verify email', url);
  await sendEmail({ to: email, toName: name, subject: 'Verify your EventHub email', htmlContent });
};

const sendPasswordResetEmail = async (name, email, token) => {
  const url = `${appUrl()}/reset-password.html?token=${encodeURIComponent(token)}`;
  const htmlContent = baseEmail('PASSWORD RESET', 'Choose a new password', `<p>Hello ${htmlEscape(name)},</p><p>We received a request to reset your EventHub password. This link expires in 1 hour.</p><p style="font-size:13px;color:#71717a;word-break:break-all">${htmlEscape(url)}</p>`, 'Reset password', url);
  await sendEmail({ to: email, toName: name, subject: 'Reset your EventHub password', htmlContent });
};

const sendWaitlistPromotedEmail = async (name, email, event) => {
  const url = `${appUrl()}/event-details.html?id=${encodeURIComponent(event.id)}`;
  const safeTitle = htmlEscape(event.title);
  const htmlContent = baseEmail('GOOD NEWS', 'A spot opened up!', `<p>Hello ${htmlEscape(name)},</p><p>You were on the waitlist for <strong>${safeTitle}</strong>, and a spot just became available. You're now confirmed — we look forward to seeing you there!</p>`, 'View Event', url);
  await sendEmail({ to: email, toName: name, subject: `You're confirmed: ${event.title}`, htmlContent });
};

module.exports = { sendWelcomeEmail, sendVerificationEmail, sendPasswordResetEmail, sendWaitlistPromotedEmail };
