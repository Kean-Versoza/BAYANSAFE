import LegalLayout from '../layouts/LegalLayout';

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy">
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: October 17, 2026</p>

      <p>
        BayanSafe is an educational game about disaster preparedness in the Philippines. This policy
        explains what information we collect when you use our website, how we use it, and the choices
        you have. We aim to handle your information in line with the Data Privacy Act of 2012
        (Republic Act No. 10173).
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account details.</strong> When you register, we collect your email address and a
          password.
        </li>
        <li>
          <strong>Game information.</strong> If you play while signed in, we may save your progress,
          scores, and the choices you make in the game.
        </li>
        <li>
          <strong>Technical information.</strong> Like most websites, our server may record your IP
          address, browser type, device type, and the pages you visit.
        </li>
        <li>
          <strong>Messages.</strong> If you email us, we keep your message and email address so we can
          reply.
        </li>
      </ul>
      <p>
        We do not ask for sensitive information such as government ID numbers, payment details, or
        health records. Please do not send them to us.
      </p>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To create and manage your account.</li>
        <li>To save your game progress and show your scores.</li>
        <li>To keep the website secure and fix problems.</li>
        <li>To improve the game and the site.</li>
        <li>To answer your questions and requests.</li>
      </ul>
      <p>We do not sell your personal information, and we do not use it for advertising.</p>

      <h2>3. Who we share it with</h2>
      <p>
        We only share information when it is needed to run the site (for example, with our web hosting
        or email provider), when the law requires it, or when you ask us to. This website also loads
        fonts from Google Fonts, so your browser connects to Google&apos;s servers to download them.
      </p>

      <h2>4. Cookies and browser storage</h2>
      <p>
        We store one small item in your browser: a note that you clicked OK on the cookie notice, so we
        do not show it again. We do not use advertising or tracking cookies. You can clear this item at
        any time from your browser settings.
      </p>

      <h2>5. How long we keep your information</h2>
      <p>
        We keep your account information for as long as your account is active. If you ask us to
        delete your account, we will delete your personal information unless the law requires us to
        keep it.
      </p>

      <h2>6. Your rights</h2>
      <p>Under the Data Privacy Act, you have the right to:</p>
      <ul>
        <li>Know what personal information we hold about you and ask for a copy.</li>
        <li>Correct information that is wrong or out of date.</li>
        <li>Ask us to delete or block your information.</li>
        <li>Object to how we use your information, or withdraw your consent.</li>
      </ul>
      <p>
        To use any of these rights, contact us at the email below. You may also file a complaint with
        the National Privacy Commission of the Philippines.
      </p>

      <h2>7. Keeping your information safe</h2>
      <p>
        We use reasonable steps to protect your information, including storing passwords in a scrambled
        (hashed) form. No website can promise perfect security, so please choose a strong password and
        keep it private.
      </p>

      <h2>8. Children</h2>
      <p>
        If you are a minor, please ask a parent, guardian, or teacher before creating an account. If we
        learn that we collected information from a child without proper permission, we will delete it.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. The date at the top shows when it last changed. If
        you keep using the site after a change, you accept the updated policy.
      </p>

      <h2>10. Contact us</h2>
      <p>
        Questions about this policy? Email us at{' '}
        <a href="mailto:versozakean@gmail.com">versozakean@gmail.com</a>.
      </p>
    </LegalLayout>
  );
}
