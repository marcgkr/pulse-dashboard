import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/config";
import { LegalPage } from "@/components/landing/legal";

export const metadata: Metadata = {
  title: "Terms of service",
  description: `The terms for using ${BRAND.name}, a do-it-yourself AI marketing service by ${BRAND.parent}, Singapore. Draft for review.`,
};

// DRAFT. Placeholder terms for launch planning; must be reviewed by a qualified Singapore lawyer before launch.
// Items in [square brackets] need to be confirmed by the founder.

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="[date to be confirmed]">
      <p>
        These terms apply when you use {BRAND.name} ({BRAND.domain}), operated by {BRAND.parent} [legal entity name and UEN to be confirmed], Singapore (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;). By creating an account or running a checkup, you agree to them.
      </p>

      <h2>What the service is</h2>
      <p>
        {BRAND.name} is a do-it-yourself tool. Our AI specialists examine your website, search presence, content and ads and give you recommendations
        (&ldquo;prescriptions&rdquo;) with steps to carry out yourself. You decide which recommendations to follow and you are responsible for the changes you make to
        your website, ads and other accounts.
      </p>

      <h2>Recommendations, not guarantees</h2>
      <ul>
        <li>Recommendations are produced partly by AI and can be wrong or incomplete. Check them before you act, especially anything involving money or legal matters.</li>
        <li>We do not guarantee any ranking, traffic, enquiry, sales or advertising result.</li>
        <li>
          Compliance Check flags wording for review against Singapore advertising rules. It is not legal advice and does not replace advice from a qualified
          professional or the guidance of your regulator.
        </li>
      </ul>

      <h2>Your account</h2>
      <ul>
        <li>Keep your login details safe. You are responsible for activity on your account.</li>
        <li>Only ask us to examine websites, ads and accounts that you own or are authorised to manage.</li>
        <li>Do not use the service to break the law, to harm others, or to overload or probe our systems or other people&apos;s websites.</li>
      </ul>

      <h2>Plans and billing</h2>
      <ul>
        <li>
          Paid plans are billed monthly in Singapore dollars through Stripe, at the prices shown on our <Link href="/pricing">pricing page</Link> when you subscribe.
        </li>
        <li>Plans renew each month until you cancel. You can cancel any time from your billing page and keep access until the end of the period you have paid for.</li>
        <li>Fees already paid are not refundable except where required by law [refund policy to be confirmed].</li>
        <li>Each plan includes a number of agent runs a month. Unused runs do not carry over [to be confirmed].</li>
        <li>We will give you at least [30] days&apos; notice of any price change to your plan.</li>
      </ul>

      <h2>Your content and data</h2>
      <p>
        You own your business information, content and the reports produced for you. You give us permission to process it to provide the service, as described in our{" "}
        <Link href="/privacy">privacy policy</Link>. We own the {BRAND.name} software, brand and the templates and methods behind it.
      </p>

      <h2>Done-for-you work</h2>
      <p>
        If you ask {BRAND.parent} to implement a recommendation for you, that work is quoted and agreed separately and is not part of your {BRAND.name} plan.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We work to keep {BRAND.name} available but do not promise it will be uninterrupted. We may change or improve features. If a change materially reduces what your
        paid plan includes, we will tell you in advance.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential loss, or for loss of profit, revenue or data, arising from your use of the service
        or from acting on its recommendations. Our total liability to you is limited to the fees you paid us in the [3] months before the claim [to be confirmed].
      </p>

      <h2>Ending the service</h2>
      <p>
        You can close your account at any time. We may suspend or close accounts that break these terms. When an account closes, we handle your data as set out in our
        privacy policy.
      </p>

      <h2>Law</h2>
      <p>These terms are governed by the laws of Singapore, and the Singapore courts have jurisdiction over any dispute.</p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a>.
      </p>
    </LegalPage>
  );
}
