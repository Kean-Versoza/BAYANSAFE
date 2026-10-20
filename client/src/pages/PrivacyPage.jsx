import LegalPage from './LegalPage.jsx';
import { PrivacyContent } from '../content/legal.jsx';
import siteConfig from '@shared/site.config.js';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={siteConfig.legal.updated}>
      <PrivacyContent />
    </LegalPage>
  );
}
