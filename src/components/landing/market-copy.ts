import type { Market } from "@/lib/markets";

// Small helpers that turn a Market into the words and links the public site needs.
// Client-safe: no server imports.

/** Short picker label: "SG · S$", "AE · AED". */
export function marketChip(m: Market): string {
  return `${m.code} · ${m.symbol.trim()}`;
}

const TLD: Partial<Record<Market["code"], string>> = {
  SG: ".sg",
  MY: ".com.my",
  ID: ".co.id",
  PH: ".ph",
  HK: ".com.hk",
  AU: ".com.au",
  NZ: ".co.nz",
  GB: ".co.uk",
  AE: ".ae",
};

/** Example website address for placeholders, e.g. "yourbusiness.com.au". */
export function exampleSite(m: Market): string {
  return `yourbusiness${TLD[m.code] ?? ".com"}`;
}

/** "/signup?country=AU&plan=growth" */
export function signupHref(m: Market, extra: Record<string, string | undefined> = {}): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(extra)) if (v) qs.set(k, v);
  qs.set("country", m.code);
  return `/signup?${qs}`;
}

/** How customers message a business in this market, as a sample prescription. */
export function messagingFix(m: Market): { title: string; diagnosis: string; steps: string[]; where: string } {
  const tail = "Someone reading about a treatment on their phone has to go looking for your number, and many will not.";
  switch (m.messaging) {
    case "SMS":
      return {
        title: "Add a tap-to-text button to every treatment page",
        diagnosis: `Only the Contact page has a way to reach you. ${tail}`,
        steps: [
          "Add a button to each treatment page that links to sms:+[your number] (international format, no spaces).",
          "Next to it, add a tap-to-call link: tel:+[your number].",
          "Show both as a fixed bar at the bottom of the screen on mobile.",
          "Tap each one on your own phone to test.",
        ],
        where: "WordPress > Appearance > Editor > Footer",
      };
    case "Messenger":
      return {
        title: "Add a Messenger button to every treatment page",
        diagnosis: `Only the Contact page has a way to reach you. ${tail}`,
        steps: [
          "Find your Facebook Page username in Page settings.",
          "Add a button to each treatment page linking to https://m.me/[your page username].",
          "Show it as a fixed button at the bottom right on mobile.",
          "Tap it on your own phone to test.",
        ],
        where: "WordPress > Plugins > Add New",
      };
    case "LINE":
      return {
        title: "Add a LINE button to every treatment page",
        diagnosis: `Only the Contact page has a way to reach you. ${tail}`,
        steps: [
          "Copy your LINE Official Account ID from the LINE Official Account Manager.",
          "Add a button to each treatment page linking to https://line.me/R/ti/p/[your ID].",
          "Show it as a fixed button at the bottom right on mobile.",
          "Tap it on your own phone to test.",
        ],
        where: "WordPress > Plugins > Add New",
      };
    default:
      return {
        title: "Add a WhatsApp button to every treatment page",
        diagnosis: `Only the Contact page has a way to reach you. ${tail}`,
        steps: [
          "Install a click-to-chat plugin, or add a button linking to https://wa.me/[your number] (country code first, no spaces or plus sign).",
          "Pre-fill the message: 'Hi, I'd like to ask about [treatment name].'",
          "Show it as a fixed button at the bottom right on mobile.",
          "Tap it on your own phone to test.",
        ],
        where: "WordPress > Plugins > Add New",
      };
  }
}
