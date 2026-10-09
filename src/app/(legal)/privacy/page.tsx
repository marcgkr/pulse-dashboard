import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/config";
import { LegalPage } from "@/components/landing/legal";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${BRAND.name} collects, uses and protects personal data under Singapore's Personal Data Protection Act (PDPA). Draft for review.`,
};

// DRAFT. Placeholder policy for launch planning; must be reviewed by a qualified Singapore lawyer before launch.
// Items in [square brackets] need to be confirmed by the founder.

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="[date to be confirmed]">
      <p>
        {BRAND.name} ({BRAND.domain}) is operated by {BRAND.parent} [legal entity name and UEN to be confirmed], a company registered in Singapore (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;). This policy explains what personal data we collect when you use {BRAND.name}, why, and how you can control it. We follow the Personal Data
        Protection Act 2012 of Singapore (PDPA).
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address and a securely hashed password.
        </li>
        <li>
          <strong>Business profile:</strong> what you tell us about your business, such as its name, website, industry, location, services, audience and goals.
        </li>
        <li>
          <strong>Content you give us to examine:</strong> website addresses, ad copy, page copy, exported reports and files you upload, and the publicly available pages
          of websites you ask us to check.
        </li>
        <li>
          <strong>Connected accounts:</strong> if you connect your Google or Meta accounts, we read your ad and search performance data, such as campaigns, spend,
          results and search queries, to write your reports. We do not make changes in those accounts, and you can disconnect at any time.
        </li>
        <li>
          <strong>Chats and results:</strong> your questions to Ask PULSE, the reports our specialists produce, and the status of your prescriptions.
        </li>
        <li>
          <strong>Billing:</strong> payments are handled by Stripe. We receive your plan, billing status and the last digits of your card, not your full card number.
        </li>
        <li>
          <strong>Technical data:</strong> IP address, browser type and basic usage logs. We use a single login session cookie and do not use advertising cookies on the
          app.
        </li>
        <li>
          <strong>Free checkup (no account):</strong> the website address you enter and your IP address, which we use briefly to prevent abuse and do not link to a
          profile.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run the specialists you ask for and show you their reports and prescriptions.</li>
        <li>To manage your account, plan and payments.</li>
        <li>To keep the service secure, prevent abuse and fix problems.</li>
        <li>To reply when you contact us, and to send service emails about your account.</li>
        <li>To send product news, only if you agree. You can unsubscribe at any time.</li>
      </ul>
      <p>We do not sell your personal data. We do not use your business data to produce reports for other customers.</p>

      <h2>AI processing</h2>
      <p>
        To produce reports, we send the relevant parts of your business profile and the content you ask us to examine to our AI model provider, Anthropic, under terms
        that do not allow them to use it to train their models [to be confirmed against the current provider agreement]. We send only what a specialist needs for the
        task you asked for.
      </p>

      <h2>Who we share it with</h2>
      <p>
        We share personal data only with service providers that help us run {BRAND.name}, such as hosting, payments (Stripe), AI
        processing (Anthropic) and email delivery, and only for that purpose. We may also disclose data where Singapore law requires it.
      </p>

      <h2>Transfers outside Singapore</h2>
      <p>
        Some of these providers store or process data outside Singapore. Where that happens, we take steps under the PDPA&apos;s Transfer Limitation Obligation to make
        sure your data receives a standard of protection comparable to the PDPA, for example through contractual safeguards.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account data for as long as your account is open. If you delete your account, we delete or anonymise your personal data within [30] days, except
        where we must keep records longer by law (for example, billing records).
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>Ask for a copy of the personal data we hold about you, and how it has been used in the past year.</li>
        <li>Ask us to correct personal data that is wrong.</li>
        <li>Withdraw your consent to us using your personal data. Some withdrawals mean we can no longer provide the service.</li>
        <li>Disconnect any linked ads or analytics account at any time from your settings.</li>
      </ul>
      <p>
        To make a request, email our Data Protection Officer at <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a>. We aim to respond within 30 days.
      </p>

      <h2>Security</h2>
      <p>
        We protect your data with access controls, encryption in transit and hashed passwords. No system is perfectly secure. If a data breach affects you, we will notify
        you and the Personal Data Protection Commission where the PDPA requires it.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we make material changes, we will tell you by email or in the app before they take effect. See also our <Link href="/terms">terms of service</Link>.
      </p>
    </LegalPage>
  );
}
