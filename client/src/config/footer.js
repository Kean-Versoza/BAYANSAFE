/**
 * Default footer / cookie content.
 *
 * Same values as `server/footerConfig.js` - they are only used as a fallback
 * when `GET /api/footer` cannot be reached (server not running, offline, ...).
 */
const defaultFooter = {
  logo: '/images/logo.png',
  brand_name: 'BAYANSAFE',
  badges: [{ image: '/images/badges/all-ages.png', alt: 'Suitable for all ages' }],
  copyright: 'BAYANSAFE. ALL RIGHTS RESERVED.',
  email: 'versozakean@gmail.com',
  links: [
    { label: 'Privacy Policy', url: '/privacy' },
    { label: 'Terms of Service', url: '/terms' },
  ],
  notes: [
    'BayanSafe is an educational game about disaster preparedness in the Philippines.',
    'Add credits, trademark notes, or school and project details here.',
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
