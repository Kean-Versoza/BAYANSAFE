import { useEffect, useState } from 'react';

/**
 * The contact form in the footer.
 *
 * The message is sent by the Node.js server to the Gmail address of the site.
 */
export default function ContactForm() {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [mailReady, setMailReady] = useState(null);

  // Is the email set up on the server? If not, say so instead of failing later.
  useEffect(() => {
    let cancelled = false;

    fetch('/api/mail/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setMailReady(data.configured);
      })
      .catch(() => {
        if (!cancelled) setMailReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const payload = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      subject: String(data.get('subject') ?? '').trim(),
      message: String(data.get('message') ?? '').trim(),
    };

    setStatus(null);
    setSending(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus({ type: 'error', text: body.error ?? 'We could not send your message.' });
        return;
      }

      setStatus({ type: 'ok', text: body.message ?? 'Thank you! Your message is on its way.' });
      form.reset();
    } catch {
      setStatus({ type: 'error', text: 'We could not reach the server. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="contact-form" onSubmit={onSubmit}>
      <p className="contact-form-title">Send us a message</p>

      <div className="contact-form-row">
        <input type="text" name="name" placeholder="Your name" required maxLength={80} autoComplete="name" />
        <input type="email" name="email" placeholder="Your email" required maxLength={120} autoComplete="email" />
      </div>

      <input type="text" name="subject" placeholder="Subject (optional)" maxLength={120} />

      <textarea name="message" placeholder="Your message" required maxLength={4000} rows={4} />

      <div className="contact-form-actions">
        <button type="submit" className="btn-yellow" disabled={sending}>
          {sending ? 'SENDING...' : 'SEND MESSAGE'}
        </button>

        {status && <p className={`contact-status contact-status--${status.type}`}>{status.text}</p>}
      </div>

      {mailReady === false && (
        <p className="contact-status contact-status--error">
          Email is not set up on the server yet. See server/.env.example.
        </p>
      )}
    </form>
  );
}
