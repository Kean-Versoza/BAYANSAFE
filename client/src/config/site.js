/**
 * Site-wide content, shared by the React client and the Node.js server.
 *
 * This is the one place to edit the text of the site: the footer, the cookie
 * notice and the navigation all come from here. The same values live in
 * `server/siteConfig.js`; the server exposes them at `GET /api/config`, and
 * this copy is the fallback used when that API cannot be reached.
 */

/** Contact address - the footer's "Contact us" link opens it. */
const CONTACT_EMAIL = 'versozakean@gmail.com';

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
    brandName: 'BAYANSAFE',
    badges: [{ image: '/images/badges/all-ages.png', alt: 'Suitable for all ages' }],

    // The year is added automatically before this text
    copyright: 'BAYANSAFE. ALL RIGHTS RESERVED.',

    email: CONTACT_EMAIL,

    // Links starting with "/" are handled by the React router (no page
    // reload), anything else (mailto:, https://) is used as-is.
    links: [
      { label: 'Privacy Policy', url: '/privacy' },
      { label: 'Terms of Service', url: '/terms' },
      { label: 'About us', url: '#about' },
      { label: 'Help Center', url: '#help' },
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
    linkLabel: 'Privacy Policy',
    linkUrl: '/privacy',
    button: 'OK',
  },
};

export default siteConfig;
