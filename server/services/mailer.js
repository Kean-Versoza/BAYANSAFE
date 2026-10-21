import nodemailer from 'nodemailer';

import { logEmail } from './emailLog.js';

/**
 * Sending email.
 *
 * Pick a provider with MAIL_PROVIDER in server/.env:
 *
 *   gmail   a Gmail account, needs an app password
 *   brevo   Brevo (formerly Sendinblue), 300 free emails a day, no app password
 *   resend  Resend, a small free tier, no app password
 *   custom  any other SMTP server
 *
 * Never put a password in this file. The .env file is in .gitignore.
 */

const env = process.env;

const PROVIDERS = {
  gmail: {
    label: 'Gmail',
    required: ['GMAIL_USER', 'GMAIL_APP_PASSWORD'],
    help:
      'Gmail needs an app password. Turn on 2-Step Verification, then open https://myaccount.google.com/apppasswords. ' +
      'If that page says app passwords are not available, your account is managed by a school or organisation, ' +
      'or you are signed in with a non-Google account. Use MAIL_PROVIDER=brevo instead.',
    settings: () => ({
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(env.SMTP_PORT) || 465,
      secure: Number(env.SMTP_PORT || 465) === 465,
      auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
    }),
    from: () => env.MAIL_FROM || env.GMAIL_USER,
    to: () => env.MAIL_TO || env.GMAIL_USER,
  },

  brevo: {
    label: 'Brevo',
    required: ['BREVO_USER', 'BREVO_PASSWORD'],
    help:
      'Create a free account at https://www.brevo.com, then copy the SMTP settings from Settings > SMTP & API. ' +
      'Put the login and the SMTP key in server/.env. No app password needed.',
    settings: () => ({
      host: env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: Number(env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: env.BREVO_USER, pass: env.BREVO_PASSWORD },
    }),
    from: () => env.MAIL_FROM || env.BREVO_USER,
    to: () => env.MAIL_TO || env.BREVO_USER,
  },

  resend: {
    label: 'Resend',
    required: ['RESEND_API_KEY'],
    help:
      'Create a free account at https://resend.com, make an API key, and put it in server/.env as RESEND_API_KEY. ' +
      'The first account can only send to your own address until you add a domain.',
    settings: () => ({
      host: env.SMTP_HOST || 'smtp.resend.com',
      port: Number(env.SMTP_PORT) || 465,
      secure: true,
      auth: { user: 'resend', pass: env.RESEND_API_KEY },
    }),
    from: () => env.MAIL_FROM || `BayanSafe <onboarding@resend.dev>`,
    to: () => env.MAIL_TO || env.RESEND_USER,
  },

  custom: {
    label: 'your own SMTP server',
    required: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'],
    help: 'Fill in SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASSWORD in server/.env.',
    settings: () => ({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT) || 587,
      secure: env.SMTP_SECURE === 'true',
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    }),
    from: () => env.MAIL_FROM || env.SMTP_USER,
    to: () => env.MAIL_TO || env.SMTP_USER,
  },
};

export const providerName = (env.MAIL_PROVIDER || 'gmail').toLowerCase();
export const provider = PROVIDERS[providerName] ?? PROVIDERS.gmail;

let transporter = null;

/** True when the settings for the chosen provider are there. */
export function isMailConfigured() {
  return provider.required.every((key) => Boolean(env[key]));
}

/** The address that receives the messages from the site. */
export function mailRecipient() {
  return provider.to() || null;
}

/** The address the messages are sent from. */
export function mailSender() {
  return provider.from() || null;
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(provider.settings());
  }
  return transporter;
}

/**
 * Sends one email.
 *
 * Throws when the provider is not set up, or when it refuses the message.
 */
export async function sendMail({ to, subject, text, html, replyTo, kind = 'other' }) {
  if (!isMailConfigured()) {
    const error = new Error(`${provider.label} is not set up yet.`);
    error.code = 'MAIL_NOT_CONFIGURED';
    error.help = provider.help;
    throw error;
  }

  const from = mailSender();

  try {
    const info = await getTransporter().sendMail({
      from: from.includes('<') ? from : `BayanSafe <${from}>`,
      to,
      subject,
      text,
      html,
      ...(replyTo ? { replyTo } : {}),
    });

    await logEmail({ to, subject, kind, ok: true });
    return info;
  } catch (err) {
    await logEmail({ to, subject, kind, ok: false, error: err.message });
    throw err;
  }
}

/**
 * Checks that the provider accepts our settings. Used by GET /api/mail/status.
 */
export async function checkConnection() {
  if (!isMailConfigured()) {
    return {
      ok: false,
      configured: false,
      message: `${provider.label} is not set up yet.`,
      help: provider.help,
    };
  }
  try {
    await getTransporter().verify();
    return {
      ok: true,
      configured: true,
      message: `Connected to ${provider.label} as ${mailSender()}.`,
    };
  } catch (err) {
    return { ok: false, configured: true, message: err.message, help: provider.help };
  }
}
