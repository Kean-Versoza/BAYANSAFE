/**
 * Checks that the email settings work.
 *
 *   npm run mail:check
 *
 * Use it after you fill in .env, to see if the provider accepts
 * the details.
 */
import '../env.js';

import { checkConnection, isMailConfigured, mailRecipient, provider, providerName } from '../services/mailer.js';

console.log(`Provider: ${provider.label} (MAIL_PROVIDER=${providerName})`);

if (!isMailConfigured()) {
  console.log('');
  console.log(`${provider.label} is not set up yet.`);
  console.log('');
  console.log(provider.help);
  console.log('');
  console.log(`Missing: ${provider.required.join(', ')}`);
  process.exit(1);
}

const result = await checkConnection();

if (result.ok) {
  console.log(result.message);
  console.log(`Messages from the contact form arrive at: ${mailRecipient()}`);
  process.exit(0);
}

console.log(`${provider.label} did not accept the settings.`);
console.log(result.message);
console.log('');
console.log(provider.help);
process.exit(1);
