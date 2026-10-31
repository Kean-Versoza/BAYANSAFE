/**
 * The messages that are sent by email.
 *
 * Anything that comes from a visitor is escaped before it goes into the HTML
 * version, so a visitor cannot break the layout of the email.
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STYLES = `
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 15px;
      line-height: 1.6;
      color: #1a1a2e;
`;

/** A message sent with the contact form on the site. */
export function contactMessage({ name, email, subject, message }) {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br />');

  return {
    subject: `[BayanSafe] ${subject}`,
    text: [
      `Name: ${name}`,
      `Email: ${email}`,
      `Subject: ${subject}`,
      '',
      message,
    ].join('\n'),
    html: `
    <div style="${STYLES}">
      <h2 style="margin:0 0 12px;color:#3b2410;">New message from the site</h2>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
        <tr>
          <td style="padding:6px 12px 6px 0;color:#6b5a4a;white-space:nowrap;">Name</td>
          <td style="padding:6px 0;font-weight:600;">${safeName}</td>
        </tr>
        <tr>
          <td style="padding:6px 12px 6px 0;color:#6b5a4a;white-space:nowrap;">Email</td>
          <td style="padding:6px 0;">
            <a href="mailto:${safeEmail}" style="color:#2b9cf2;">${safeEmail}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 12px 6px 0;color:#6b5a4a;white-space:nowrap;">Subject</td>
          <td style="padding:6px 0;font-weight:600;">${safeSubject}</td>
        </tr>
      </table>
      <hr style="border:none;border-top:1px solid #e2d9cd;margin:16px 0;" />
      <p style="margin:0;white-space:pre-wrap;">${safeMessage}</p>
      <p style="margin:20px 0 0;color:#6b5a4a;font-size:12px;">
        Reply to this email to answer ${safeName} directly.
      </p>
    </div>`,
  };
}

/** The message sent when an administrator removes an account. */
export function accountRemovedMessage({ username }) {
  const safeUsername = escapeHtml(username);

  return {
    subject: 'Your BayanSafe account was removed',
    text: [
      `Greetings ${username},`,
      '',
      'An administrator has removed your BayanSafe account.',
      'Your name, your email address and your linked card are no longer stored, and you can no longer sign in with this account.',
      '',
      'If you did not expect this, please reply to this email and the BayanSafe team will look into it.',
      '',
      'The BayanSafe team',
    ].join('\n'),
    html: `
    <div style="${STYLES}">
      <h2 style="margin:0 0 12px;color:#3b2410;">Your account was removed</h2>
      <p style="margin:0 0 12px;">Greetings ${safeUsername},</p>
      <p style="margin:0 0 12px;">An administrator has removed your BayanSafe account.</p>
      <p style="margin:0 0 12px;">
        Your name, your email address and your linked card are no longer stored, and you can no longer
        sign in with this account.
      </p>
      <p style="margin:0 0 12px;">
        If you did not expect this, please reply to this email and the BayanSafe team will look into it.
      </p>
      <p style="margin:0;color:#6b5a4a;">The BayanSafe team</p>
    </div>`,
  };
}

/** The welcome email sent after somebody creates an account. */
export function welcomeMessage({ username, email }) {
  const safeUsername = escapeHtml(username);

  return {
    subject: 'Welcome to BayanSafe!',
    text: [
      `Greetings ${username},`,
      'Welcome to BayanSafe!',
      'If you are reading this, your email has been finally set up and the site can send email.',
      'Get ready to play and learn how to stay safe during disasters.',
      'The BayanSafe team',
    ].join('\n'),
    html: `
    <div style="${STYLES}">
      <h2 style="margin:0 0 12px;color:#3b2410;">Welcome to BayanSafe, ${safeUsername}!</h2>
      <p style="margin:0 0 12px;">Your account is ready. You can start playing and learning how to stay safe during disasters.</p>
      <p style="margin:0 0 12px;">Stay safe!</p>
      <p style="margin:0;color:#6b5a4a;">The BayanSafe team</p>
    </div>`,
  };
}
