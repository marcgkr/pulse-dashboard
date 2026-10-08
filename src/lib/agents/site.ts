import { z } from "zod";
import { businessContext, normalizePrescription, PrescriptionSchema, structured, type Prescription } from "../ai";
import type { AgentDef } from "./types";
import { auditSite, type Check, type SiteAudit } from "./site-audit";
import { normalizeUrl } from "../safe-fetch";

type Input = { url: string };

const SiteAI = z.object({
  summary: z.string().describe("2-4 sentence verdict on the site for the owner. Lead with the single biggest problem."),
  strengths: z.array(z.string()).describe("2-4 things the site already does well. Short."),
  rewrite: z.object({
    title: z.string().describe("Improved homepage title tag, 30-60 characters, includes main service + location"),
    meta_description: z.string().describe("Improved meta description, 120-155 characters, with a reason to click"),
    h1: z.string().describe("Improved homepage H1 headline"),
  }),
  faq: z
    .array(z.object({ question: z.string(), answer: z.string().describe("40-80 word draft answer the owner can edit") }))
    .describe("4-6 questions real customers ask before buying, with draft answers to add as an FAQ section (helps AI assistants quote the site)"),
  prescriptions: z.array(PrescriptionSchema).describe("6-10 fixes ordered by priority, most valuable first"),
});

function platformHint(platform: string): string {
  switch (platform) {
    case "WordPress":
      return "WordPress (assume Yoast or Rank Math SEO plugin is available; give wp-admin menu paths)";
    case "Shopify":
      return "Shopify (give Shopify admin paths like Online Store > Themes > Customize, or Online Store > Preferences)";
    case "Wix":
      return "Wix (give Wix editor and Wix SEO settings paths)";
    case "Squarespace":
      return "Squarespace (give Pages > Settings > SEO style paths)";
    case "Webflow":
      return "Webflow (give Designer > Page settings paths)";
    default:
      return `${platform} (give instructions that work for a web developer or site builder)`;
  }
}

export const siteAgent: AgentDef<Input> = {
  id: "site",
  name: "Site Doctor",
  blurb: "Checks your website and tells you exactly what to fix.",
  description:
    "Opens your homepage and key inner pages the way Google and your customers see them. Checks speed, mobile, SEO basics, contact options, tracking and AI search readiness, then writes a prescription for each problem with steps for your website platform.",
  parseInput(raw, ws) {
    const r = (raw ?? {}) as { url?: string };
    const url = (r.url || ws.website || "").trim();
    if (!url) throw new Error("Add your website address first.");
    return { url: normalizeUrl(url).toString() };
  },
  runTitle: (input) => `Site checkup: ${new URL(input.url).hostname}`,

  async run(input, ctx) {
    const audit = await auditSite(input.url, { onProgress: ctx.progress });
    ctx.progress("Writing your prescriptions");
    const failing = audit.checks.filter((c) => c.status !== "pass");
    const ai = await structured({
      system:
        "You are Site Doctor, a website conversion and SEO specialist. You receive an automated audit of a small business website and turn it into a prioritised fix list the owner can do themselves.",
      prompt: `BUSINESS PROFILE
${businessContext(ctx.ws)}

WEBSITE PLATFORM: ${platformHint(audit.platform)}
URL: ${audit.finalUrl}
OVERALL SCORE: ${audit.score}/100
GROUP SCORES: ${JSON.stringify(audit.groupScores)}

FAILED OR WARNING CHECKS
${failing.map((c) => `- [${c.status.toUpperCase()}] ${c.group} / ${c.label}: ${c.detail}`).join("\n") || "None"}

PASSED CHECKS
${audit.checks.filter((c) => c.status === "pass").map((c) => `- ${c.label}`).join("\n")}

HOMEPAGE
Title: ${audit.home.title}
Meta description: ${audit.home.description}
H1: ${audit.home.h1.join(" | ")}
H2s: ${audit.home.h2.join(" | ")}
Trackers: ${audit.home.trackers.join(", ") || "none"}
Booking: ${audit.home.bookingWidget || "none"}

INNER PAGES
${audit.pages.map((p) => `- ${p.url} [${p.status}] title="${p.title}" words=${p.wordCount}`).join("\n")}

HOMEPAGE TEXT (first part)
${audit.home.textSample.slice(0, 4000)}

Write the report. Prescriptions must cover the failed checks that matter most for getting enquiries, plus anything you notice in the copy itself (unclear offer, no price guidance, weak call to action, missing trust signals). Steps must use the menu paths for the platform above.`,
      schema: SiteAI,
      effort: "medium",
    });

    return {
      title: `Site checkup: ${audit.host}`,
      score: audit.score,
      summary: ai.summary,
      strengths: ai.strengths,
      rewrite: ai.rewrite,
      faq: ai.faq,
      audit,
      prescriptions: ai.prescriptions.map(normalizePrescription),
    };
  },

  async demo(input, ctx) {
    // The crawl is real. Only the writing is rules-based.
    const audit = await auditSite(input.url, { onProgress: ctx.progress });
    const prescriptions = rulePrescriptions(audit);
    const worst = audit.checks.filter((c) => c.status === "fail").sort((a, b) => b.weight - a.weight)[0];
    return {
      title: `Site checkup: ${audit.host}`,
      score: audit.score,
      summary: worst
        ? `${audit.host} scores ${audit.score}/100. The biggest problem is "${worst.label.toLowerCase()}": ${worst.detail} Fix the urgent items below first, then re-run this checkup.`
        : `${audit.host} scores ${audit.score}/100 and passes the critical checks. The items below are refinements.`,
      strengths: audit.checks.filter((c) => c.status === "pass").sort((a, b) => b.weight - a.weight).slice(0, 4).map((c) => `${c.label}: ${c.detail}`),
      rewrite: null,
      faq: [],
      audit,
      prescriptions,
      demo: true,
    };
  },
};

// ---------- Rules-only prescriptions (no AI) ----------

function where(platform: string, wp: string, shopify: string, wix: string, other: string) {
  return platform === "WordPress" ? wp : platform === "Shopify" ? shopify : platform === "Wix" ? wix : other;
}

export function rulePrescriptions(audit: SiteAudit): Prescription[] {
  const p = audit.platform;
  const out: Prescription[] = [];
  const failed = (id: string) => audit.checks.find((c) => c.id === id && c.status !== "pass") as Check | undefined;
  const pr = (c: Check): Prescription["priority"] => (c.status === "fail" && c.weight >= 3 ? "urgent" : c.status === "fail" ? "high" : "medium");

  let c: Check | undefined;
  if ((c = failed("noindex")))
    out.push({
      title: "Remove the 'noindex' tag so Google can list your homepage",
      diagnosis: c.detail + " Nobody can find you on Google while this is on.",
      steps: [
        p === "WordPress" ? "Go to Settings > Reading and untick 'Discourage search engines from indexing this site'." : "Open your homepage SEO settings.",
        "Turn off any 'Hide from search engines' or 'noindex' option for the homepage.",
        "Save, then search Google for site:" + audit.host + " in a few days to confirm it appears.",
      ],
      where: where(p, "WordPress > Settings > Reading", "Online Store > Preferences", "Wix > Marketing & SEO > SEO Tools", "Homepage SEO settings"),
      priority: "urgent", impact: "high", effort: "quick", category: "Technical SEO", recheck_days: 7,
    });
  if ((c = failed("https")))
    out.push({
      title: "Turn on HTTPS so browsers stop showing 'Not secure'",
      diagnosis: c.detail + " Many visitors leave when they see the warning, and Google ranks secure sites higher.",
      steps: [
        "Log in to your web host or site builder and turn on the free SSL certificate (often called Let's Encrypt or AutoSSL).",
        "Force all traffic to https:// (most hosts have a 'Force HTTPS' toggle).",
        "Open your site with http:// and confirm it redirects to https:// with a padlock.",
      ],
      where: where(p, "Hosting control panel > SSL", "Shopify includes SSL: Settings > Domains", "Wix > Settings > SSL", "Hosting control panel"),
      priority: "urgent", impact: "high", effort: "quick", category: "Technical SEO", recheck_days: 3,
    });
  if ((c = failed("viewport")))
    out.push({
      title: "Make the site display properly on phones",
      diagnosis: c.detail + " Most of your visitors are on mobile.",
      steps: [
        'Add this line inside <head> on every page: <meta name="viewport" content="width=device-width, initial-scale=1">',
        "If your theme is very old, switch to a mobile-responsive theme.",
        "Check the result on your own phone.",
      ],
      where: where(p, "Appearance > Theme File Editor > header.php", "Online Store > Themes > Edit code > theme.liquid", "Wix handles this automatically: switch to the mobile editor", "Site <head>"),
      priority: "urgent", impact: "high", effort: "quick", category: "Technical SEO", recheck_days: 3,
    });
  if ((c = failed("broken")))
    out.push({
      title: "Fix or redirect the broken links on your site",
      diagnosis: c.detail + " Visitors who hit a dead page usually leave.",
      steps: [
        "Open each broken address listed above.",
        "If the page moved, set up a 301 redirect from the old address to the new one.",
        "If the page is gone, remove the link from your menu or page.",
      ],
      where: where(p, "WordPress > Redirection plugin (free)", "Online Store > Navigation > URL Redirects", "Wix > Marketing & SEO > URL Redirect Manager", "Hosting redirects"),
      priority: "high", impact: "medium", effort: "quick", category: "Technical SEO", recheck_days: 7,
    });
  if ((c = failed("h1")) || (c = failed("content")))
    out.push({
      title: "Say clearly what you do, for whom, and where, at the top of the homepage",
      diagnosis: c.detail + " Google and visitors both decide in seconds whether you match what they searched for.",
      steps: [
        "Use exactly one H1 headline that names your main service and area, e.g. 'Aesthetic treatments in Tampines'.",
        "Under it, add 2 to 3 sentences: who it's for, the result they get, and why choose you.",
        "Add a short section for each main service with a link to its own page. Aim for 400+ words on the homepage.",
        "Finish with a clear button: 'WhatsApp us to book'.",
      ],
      where: where(p, "WordPress > Pages > Home", "Online Store > Themes > Customize", "Wix Editor > Home", "Homepage"),
      priority: c.status === "fail" ? "high" : "medium", impact: "high", effort: "half-day", category: "Content", recheck_days: 21,
    });
  if ((c = failed("contact")) || (c = failed("whatsapp")))
    out.push({
      title: "Add a WhatsApp button and tap-to-call link on every page",
      diagnosis: c.detail + " Visitors on mobile want one tap to reach you.",
      steps: [
        "Create your WhatsApp link: https://wa.me/65XXXXXXXX (your number with country code, no + or spaces).",
        "Add a sticky WhatsApp button that shows on every page" + (p === "WordPress" ? " (the free 'Click to Chat' plugin does this)." : p === "Shopify" ? " (search the Shopify App Store for 'WhatsApp chat button')." : "."),
        "Make your phone number a link: <a href=\"tel:+65XXXXXXXX\">.",
        "Add a pre-filled message, e.g. https://wa.me/65XXXXXXXX?text=Hi%2C%20I%27d%20like%20to%20book",
      ],
      where: where(p, "WordPress > Plugins > Add New", "Shopify > Apps", "Wix > Add > Contact & Forms", "Site header and footer"),
      priority: pr(c), impact: "high", effort: "quick", category: "Conversion", recheck_days: 7,
    });
  if ((c = failed("analytics")))
    out.push({
      title: "Install Google Analytics 4 so you can see where customers come from",
      diagnosis: c.detail,
      steps: [
        "Go to analytics.google.com, create a GA4 property and a Web data stream for " + audit.host + ".",
        "Copy the Measurement ID (starts with G-).",
        p === "WordPress" ? "Install the free 'Site Kit by Google' plugin and connect Analytics." : p === "Shopify" ? "Install the 'Google & YouTube' app and connect GA4." : p === "Wix" ? "Go to Marketing Integrations > Google Analytics and paste the ID." : "Paste the GA4 tag into the <head> of every page.",
        "Open your site, then check Reports > Realtime in GA4 shows you as a visitor.",
      ],
      where: where(p, "WordPress > Plugins", "Shopify > Apps > Google & YouTube", "Wix > Marketing Integrations", "Site <head>"),
      priority: "high", impact: "high", effort: "quick", category: "Tracking", recheck_days: 7,
    });
  if ((c = failed("title")) || failed("description")) {
    const t = audit.checks.find((x) => x.id === "title")!;
    out.push({
      title: "Rewrite your homepage title and meta description for Google",
      diagnosis: `${t.detail} ${audit.checks.find((x) => x.id === "description")?.detail ?? ""} These two lines are your ad in Google results.`,
      steps: [
        "Title: put your main service + area first, brand last. Example: 'Lash Extensions in Orchard | Your Brand'. Keep it 30 to 60 characters.",
        "Meta description: one sentence on what you do, one reason to choose you, one call to action. 120 to 155 characters.",
        "Save and request indexing in Google Search Console (URL Inspection > Request indexing).",
      ],
      where: where(p, "WordPress > Pages > Home > Yoast/Rank Math box", "Online Store > Preferences > Title and meta description", "Wix > Pages > Home > SEO basics", "Homepage SEO settings"),
      priority: c?.status === "fail" ? "high" : "medium", impact: "medium", effort: "quick", category: "On-page SEO", recheck_days: 21,
    });
  }
  if ((c = failed("schema-biz")))
    out.push({
      title: "Add business schema so Google and AI assistants know who you are",
      diagnosis: c.detail,
      steps: [
        "Use a LocalBusiness type that matches you (e.g. MedicalClinic, BeautySalon, LegalService).",
        "Include name, address, phone, opening hours, website, logo, and sameAs links to your Google Business Profile and social pages.",
        p === "WordPress" ? "In Rank Math or Yoast, fill in the Local SEO / Organization settings." : "Generate the JSON-LD with a free schema generator and paste it into the homepage <head>.",
        "Test it at search.google.com/test/rich-results.",
      ],
      where: where(p, "WordPress > Rank Math/Yoast > Local SEO", "Theme > edit code > theme.liquid", "Wix > SEO settings > Structured data", "Homepage <head>"),
      priority: "high", impact: "medium", effort: "half-day", category: "AI Visibility", recheck_days: 14,
    });
  if ((c = failed("faq")))
    out.push({
      title: "Add an FAQ section answering the questions customers ask before booking",
      diagnosis: c.detail,
      steps: [
        "List the 6 questions you hear most on WhatsApp or the phone (price range, downtime, how long it takes, who it suits).",
        "Answer each in 2 to 4 plain sentences on the relevant service page.",
        "Mark it up as FAQPage schema (most SEO plugins have an FAQ block that does this).",
      ],
      where: "Service pages",
      priority: "medium", impact: "medium", effort: "half-day", category: "AI Visibility", recheck_days: 30,
    });
  if ((c = failed("sitemap")))
    out.push({
      title: "Create an XML sitemap and submit it to Google",
      diagnosis: c.detail,
      steps: [
        p === "WordPress" ? "Turn on sitemaps in Yoast or Rank Math (usually on by default once installed)." : "Most builders make one automatically at /sitemap.xml. If not, ask your developer to add one.",
        "In Google Search Console, go to Sitemaps and submit /sitemap.xml.",
      ],
      where: "Google Search Console > Sitemaps",
      priority: "medium", impact: "medium", effort: "quick", category: "Technical SEO", recheck_days: 14,
    });
  if ((c = failed("speed")) || (c = failed("psi")) || (c = failed("weight")))
    out.push({
      title: "Make the homepage load faster on mobile",
      diagnosis: c.detail + " Slow pages lose visitors before they see your offer.",
      steps: [
        "Compress images to WebP and keep hero images under 200 KB (squoosh.app is free).",
        p === "WordPress" ? "Install a caching plugin (LiteSpeed Cache or WP Rocket) and turn on page caching." : "Remove apps or widgets you no longer use; each one adds scripts.",
        "Test again at pagespeed.web.dev and aim for a green score on mobile.",
      ],
      where: where(p, "WordPress > Plugins", "Shopify > Apps / Themes", "Wix > Site speed dashboard", "Hosting / build settings"),
      priority: c.status === "fail" ? "high" : "medium", impact: "medium", effort: "half-day", category: "Technical SEO", recheck_days: 14,
    });
  if ((c = failed("ad-pixels")))
    out.push({
      title: "Install the Meta Pixel and Google Ads conversion tag",
      diagnosis: c.detail,
      steps: [
        "Meta: Events Manager > Connect data sources > Web > Meta Pixel. Use the partner integration for your platform.",
        "Google Ads: Goals > Conversions > New > Website. Track WhatsApp clicks, form submits and calls.",
        "Use the Meta Pixel Helper and Google Tag Assistant browser extensions to confirm both fire.",
      ],
      where: "Meta Events Manager and Google Ads > Goals",
      priority: "medium", impact: "high", effort: "half-day", category: "Tracking", recheck_days: 7,
    });
  if ((c = failed("alt")))
    out.push({
      title: "Describe your images with alt text",
      diagnosis: c.detail,
      steps: ["Open each image in your media library.", "Write what the image shows in a few words, including the service where it's natural (e.g. 'Hydrafacial treatment room at our Tampines clinic')."],
      where: where(p, "WordPress > Media", "Shopify > Content > Files", "Wix > image settings", "Media library"),
      priority: "low", impact: "low", effort: "quick", category: "On-page SEO", recheck_days: 30,
    });
  if ((c = failed("llms")))
    out.push({
      title: "Publish an llms.txt file for AI assistants",
      diagnosis: c.detail,
      steps: [
        "Create a plain text file named llms.txt.",
        "Write: a one-line description of your business, your services with prices or price ranges, location, opening hours, and links to your key pages.",
        "Upload it so it opens at https://" + audit.host + "/llms.txt.",
      ],
      where: "Website root folder",
      priority: "low", impact: "low", effort: "quick", category: "AI Visibility", recheck_days: 30,
    });
  if ((c = failed("og")))
    out.push({
      title: "Set a share image so links look good on WhatsApp and Facebook",
      diagnosis: c.detail,
      steps: ["Make a 1200 x 630 image with your logo and main offer.", "Set it as the social share / Open Graph image in your SEO settings."],
      where: where(p, "Yoast/Rank Math > Social", "Online Store > Preferences > Social sharing image", "Wix > SEO > Social share", "SEO settings"),
      priority: "low", impact: "low", effort: "quick", category: "On-page SEO", recheck_days: 30,
    });
  return out;
}
