/**
 * Site-wide content, shared by the React client and the Node.js server.
 *
 * This is the one place to edit the text of the site: the footer, the cookie
 * notice, the navigation and the brand details all come from here.
 * The server exposes it at GET /api/config so it can be overridden at runtime.
 */

export const siteConfig = {
  brand: {
    name: 'BAYANSAFE',
    logo: '/images/logo.png',
    tagline: 'A Philippine Smart Community Disaster Intelligence and Preparedness Response Game',
  },

  // The tabs of the pill in the top-right corner.
  // A tab with a "path" opens that page, a tab without one jumps to that
  // part of the home page.
  nav: [
    { id: 'home', label: 'HOME' },
    { id: 'about', label: 'ABOUT' },
    { id: 'registration', label: 'REGISTER' },
    { id: 'account', label: 'ACCOUNT', path: '/account' },
  ],

  footer: {
    // Logo shown on the left
    logo: '/images/logo.png',
    brandName: 'BAYANSAFE',

    // Rating or info badges next to the logo. Leave the list empty for none.
    // Save the images in client/public/images/badges/ and add one line per badge.
    badges: [
      { image: '/images/badges/all-ages.png', alt: 'Suitable for all ages' },
    ],

    // The year is added automatically before this text
    copyright: 'BAYANSAFE. ALL RIGHTS RESERVED.',

    email: 'versozakean@gmail.com',
    links: [
      { label: 'Privacy Policy', url: '/privacy' },
      { label: 'Terms of Service', url: '/terms' },
    ],

    // Small print: one paragraph per line
    notes: [
      'BayanSafe is an educational game about disaster preparedness in the Philippines.',
      'Add credits, trademark notes, or school and project details here.',
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

  // "Last updated" date shown on the legal pages
  legal: {
    updated: 'October 17, 2026',
  },
};

export default siteConfig;
