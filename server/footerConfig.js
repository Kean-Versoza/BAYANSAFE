/**
 * Footer + cookie-bar content for the whole site.
 *
 * This is the Node.js replacement for the old `footer_config.py`.
 * Edit the text here and every page picks it up through `GET /api/footer`.
 *
 * Image paths are URLs served from `client/public/images/`.
 */

/** Contact address - the footer's "Contact us" link opens it. */
const CONTACT_EMAIL = 'versozakean@gmail.com';

const footerConfig = {
  // Logo shown on the left
  logo: '/images/logo.png',
  brand_name: 'BAYANSAFE',

  // Rating or info badges next to the logo. Leave the array empty for none.
  // Save the images in client/public/images/badges/ and add one entry per badge.
  badges: [
    { image: '/images/badges/all-ages.png', alt: 'Suitable for all ages' },
  ],

  // The current year is added automatically before this text
  copyright: 'BAYANSAFE. ALL RIGHTS RESERVED.',

  email: CONTACT_EMAIL,

  // Links starting with "/" are handled by the React router (no page reload),
  // anything else (mailto:, https://) is used as-is, and '#' is a placeholder -
  // the label shows but the link does nothing.
  links: [
    { label: 'Privacy Policy', url: '/privacy' },
    { label: 'Terms of Service', url: '/terms' },
    { label: 'About us', url: '#' },
    { label: 'Contact us', url: `mailto:${CONTACT_EMAIL}` },
    { label: 'Help Center', url: '#' },
  ],

  // Small print: one paragraph per line (sample text, change it to yours)
  notes: [
    'BayanSafe is an educational game about disaster preparedness in the Philippines.',
    'Add credits, trademark notes, or school and project details here.',
  ],

  // Cookie bar at the bottom of the screen
  cookie: {
    show: true,
    text: 'This site uses cookies to improve your experience. By continuing to browse, you agree to their use as described in our',
    link_label: 'Privacy Policy',
    link_url: '/privacy',
    button: 'OK',
  },
};

export default footerConfig;
