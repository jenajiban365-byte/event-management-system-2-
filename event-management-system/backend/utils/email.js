// Sends transactional email via Brevo's HTTPS API (https://api.brevo.com).
//
// Why not SMTP/nodemailer? Render's FREE tier blocks all outbound SMTP ports
// (25, 465, 587) at the network level as an anti-spam measure — this is a
// platform policy, not a bug in this code, and it means Gmail SMTP can never
// work reliably from a free Render service. Brevo's API runs over normal
// HTTPS (port 443), which is never blocked, so it works everywhere: locally,
// on Render's free tier, or anywhere else.

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const sendWelcomeEmail = async (name, email) => {
  if (!process.env.BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is not set — cannot send welcome email.');
  }
  if (!process.env.EMAIL_FROM) {
    throw new Error('EMAIL_FROM is not set — cannot send welcome email.');
  }

  const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to EventHub</title>
      </head>

      <body style="margin:0; padding:0; background-color:#f4f4f5; font-family:Arial, Helvetica, sans-serif; color:#18181b;">

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:40px 20px;">
          <tr>
            <td align="center">

              <table width="100%" cellpadding="0" cellspacing="0"
                style="max-width:600px; background:#ffffff; border-radius:12px; overflow:hidden;">

                <!-- Header -->
                <tr>
                  <td style="background:#111111; padding:28px 36px;">
                    <div style="font-size:24px; font-weight:700; color:#ffffff;">
                      Event<span style="color:#f59e0b;">Hub</span>
                    </div>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding:42px 36px 36px;">

                    <p style="margin:0 0 8px; font-size:14px; color:#71717a;">
                      ACCOUNT CONFIRMATION
                    </p>

                    <h1 style="margin:0 0 24px; font-size:30px; line-height:1.2; color:#18181b;">
                      Welcome to EventHub.
                    </h1>

                    <p style="margin:0 0 18px; font-size:16px; line-height:1.7; color:#3f3f46;">
                      Hello ${name},
                    </p>

                    <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#3f3f46;">
                      Your EventHub account has been successfully created.
                      You're now ready to discover events, connect with experiences
                      that matter to you, and manage your bookings from one place.
                    </p>

                    <!-- Account details -->
                    <table width="100%" cellpadding="0" cellspacing="0"
                      style="background:#fafafa; border:1px solid #e4e4e7; border-radius:8px; margin:0 0 28px;">
                      <tr>
                        <td style="padding:20px 22px;">
                          <p style="margin:0 0 6px; font-size:12px; font-weight:600; color:#71717a; text-transform:uppercase;">
                            Registered email
                          </p>
                          <p style="margin:0; font-size:15px; color:#18181b;">
                            ${email}
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA -->
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:#f59e0b; border-radius:7px;">
                          <a href="https://event-management-system-2-dlcv.onrender.com"
                            style="display:inline-block; padding:13px 24px; font-size:15px; font-weight:600; color:#111111; text-decoration:none;">
                            Explore EventHub
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:32px 0 0; font-size:13px; line-height:1.6; color:#71717a;">
                      If you did not create this account, you can safely ignore
                      this email. If you believe someone has used your email
                      address without authorization, please contact our support team.
                    </p>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="border-top:1px solid #e4e4e7; padding:24px 36px; background:#fafafa;">

                    <p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#27272a;">
                      EventHub
                    </p>

                    <p style="margin:0; font-size:12px; line-height:1.6; color:#71717a;">
                      Discover. Connect. Experience.
                    </p>

                    <p style="margin:14px 0 0; font-size:11px; color:#a1a1aa;">
                      This is an automated message. Please do not reply directly to this email.
                    </p>

                  </td>
                </tr>

              </table>

            </td>
          </tr>
        </table>

      </body>
      </html>
  `;

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-key': process.env.BREVO_API_KEY
    },
    body: JSON.stringify({
      sender: { name: 'EventHub', email: process.env.EMAIL_FROM },
      to: [{ email, name }],
      subject: 'Welcome to EventHub',
      htmlContent
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${errorBody}`);
  }
};

module.exports = { sendWelcomeEmail };
