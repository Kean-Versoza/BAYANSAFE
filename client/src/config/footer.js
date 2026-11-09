/**
 * Default footer / cookie content.
 *
 * Same values as `server/footerConfig.js` - they are only used as a fallback
 * when `GET /api/footer` cannot be reached (server not running, offline, ...).
 */

/** Contact address - the footer's "Contact us" link opens it. */
const CONTACT_EMAIL = 'bayansafe.admin@gmail.com';

const defaultFooter = {
  logo: '/images/logo.png',
  brand_name: 'BAYANSAFE',
  badges: [{ image: '/images/badges/all-ages.png', alt: 'Suitable for all ages' }],
  copyright: 'BAYANSAFE. ALL RIGHTS RESERVED.',
  email: CONTACT_EMAIL,
  links: [
    { label: 'Privacy Policy', url: '/privacy' },
    { label: 'Terms of Service', url: '/terms' },
    { label: 'About us', url: '#' },
    { label: 'Contact us', url: `https://mail.google.com/mail/?view=cm&fs=1&to=${CONTACT_EMAIL}&su=Message%20to%20BayanSafe` },
    { label: 'Help Center', url: '/help' },
  ],
  notes: [
    'BayanSafe is an educational game about disaster preparedness in the Philippines.',
    'BayanSafe is a collaboration project between 3 subjects across different principles and creative approaches.',
    'And it is created by a team of students from the Quezon City University (QCU) consisting of 11 members.',
  ],
  cookie: {
    show: true,
    text: 'This site uses cookies to improve your experience. By continuing to browse, you agree to their use as described in our',
    link_label: 'Privacy Policy',
    link_url: '/privacy',
    button: 'OK',
  },
};

export default defaultFooter;
