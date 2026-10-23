/**
 * The site configuration shared with the front end.
 *
 * The text of the footer and the cookie notice lives here, and the client
 * reads it from `GET /api/config`. `client/src/config/site.js` holds the
 * same values as a fallback for when that request cannot be made.
 */

/** Contact address - the footer's "Contact us" link opens it. */
const CONTACT_EMAIL = 'bayansafe.admin@gmail.com';

export const siteConfig = {
  brand: {
    name: 'BAYANSAFE',
    logo: '/images/logo.png',
    tagline: 'A Philippine Smart Community Disaster Intelligence and Preparedness Response Game',
  },

  // The tabs of the pill in the top-right corner.
  // A tab with a "path" opens that page; a tab without one jumps to that
  // part of the home page.
  nav: [
    { id: 'home', label: 'HOME' },
    { id: 'about', label: 'ABOUT' },
    { id: 'registration', label: 'REGISTER' },
    { id: 'account', label: 'ACCOUNT', path: '/account' },
  ],

  footer: {
    logo: '/images/logo.png',
    brand_name: 'BAYANSAFE',
    badges: [{ image: '/images/badges/all-ages.png', alt: 'Suitable for all ages' }],

    // The year is added automatically before this text
    copyright: 'BAYANSAFE. ALL RIGHTS RESERVED.',

    email: CONTACT_EMAIL,

    // Links starting with "/" are handled by the React router (no page
    // reload), anything else (mailto:, https://) is used as-is.
    links: [
      { label: 'Privacy Policy', url: '/privacy' },
      { label: 'Terms of Service', url: '/terms' },
      { label: 'About us', url: '#' },
      { label: 'Contact us', url: `mailto:${CONTACT_EMAIL}` },
      { label: 'Help Center', url: '/help' },
    ],

    // Small print: one paragraph per line
    notes: [
      'BayanSafe is an educational game about disaster preparedness in the Philippines.',
      'BayanSafe is a collaboration project between 3 subjects across different principles and creative approaches.',
      'And it is created by a team of students from the Quezon City University (QCU) consisting of 11 members.',
    ],
  },

  // Cookie bar at the bottom of the screen
  cookie: {
    show: true,
    text: 'This site uses cookies to improve your experience. By continuing to browse, you agree to their use as described in our',
    link_label: 'Privacy Policy',
    link_url: '/privacy',
    button: 'OK',
  },
};

export default siteConfig;
