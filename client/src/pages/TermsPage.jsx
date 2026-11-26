import LegalPage from './LegalPage.jsx';
import { TermsContent } from '../content/legal.jsx';
import siteConfig from '@shared/site.config.js';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={siteConfig.legal.updated}>
      <TermsContent />
    </LegalPage>
  );
}
