// Google Business Profile (Pro): reads this outlet's connected profile, checks it against what Google
// rewards in the map results, and writes fixes, a better description, posts to publish and replies to
// unanswered reviews. Nothing is posted for the owner; they copy and paste.

import { z } from "zod";
import { businessContext, normalizePrescription, PrescriptionSchema, structured } from "../ai";
import { ConnectorError } from "../connectors/http";
import { fetchGbpSnapshot, type GbpSnapshot } from "../connectors/gbp";
import { accessToken, getConnection, markSync, selectedAccounts } from "../connectors/store";
import type { WorkspaceRow } from "../db";
import { marketFor } from "../markets";
import type { AgentContext, AgentDef, AgentResult } from "./types";

type Input = { focus: string; posts: number };

export type GbpCheck = { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string; weight: number };

export type GbpPostIdea = { type: "Update" | "Offer" | "Event"; title: string; text: string; button: string; photo: string; when: string };

export type GbpReply = { reviewer: string; stars: number | null; review: string; reply: string };

export type GbpResult = AgentResult & {
  location: string;
  profile: Pick<GbpSnapshot, "title" | "primaryCategory" | "rating" | "reviewCount" | "photos" | "actions" | "mapsUri">;
  checks: GbpCheck[];
  description: { current: string; suggested: string };
  categories: string[];
  services: string[];
  posts: GbpPostIdea[];
  replies: GbpReply[];
  warnings: string[];
  /** Sample profile, used when nothing is connected (samples and demos). */
  sample?: boolean;
};

const DAY = 864e5;
const daysSince = (iso: string | null, now: Date) => (iso ? Math.floor((now.getTime() - Date.parse(iso)) / DAY) : null);

/** The profile checks, computed in code from what Google returned. */
export function gbpChecks(s: GbpSnapshot, now = new Date()): GbpCheck[] {
  const c: GbpCheck[] = [];
  const add = (id: string, label: string, status: GbpCheck["status"], detail: string, weight: number) => c.push({ id, label, status, detail, weight });
  const desc = s.description.trim().length;
  add("description", "Business description", desc >= 400 ? "pass" : desc >= 150 ? "warn" : "fail", desc ? `${desc} of 750 characters used.` : "No description.", 12);
  add("category", "Primary category", s.primaryCategory ? "pass" : "fail", s.primaryCategory || "Not set.", 14);
  add(
    "more_categories",
    "Additional categories",
    s.additionalCategories.length >= 2 ? "pass" : s.additionalCategories.length === 1 ? "warn" : "fail",
    s.additionalCategories.length ? s.additionalCategories.join(", ") : "None. Each one is another set of searches you can show up for.",
    6,
  );
  add("services", "Services listed", s.services.length >= 5 ? "pass" : s.services.length ? "warn" : "fail", s.services.length ? `${s.services.length} listed.` : "None listed.", 8);
  add("hours", "Opening hours", s.hasHours ? "pass" : "fail", s.hasHours ? "Set." : "Not set. Google shows profiles without hours less often.", 10);
  add("phone", "Phone number", s.phone ? "pass" : "fail", s.phone || "Missing.", 6);
  add("website", "Website link", s.website ? (/utm_/.test(s.website) ? "pass" : "warn") : "fail", s.website ? (/utm_/.test(s.website) ? "Tagged, so visits show in Analytics." : "Set, but not tagged, so Analytics can't tell these visits apart.") : "Missing.", 6);
  const photos = s.photos;
  add("photos", "Photos", photos == null ? "warn" : photos >= 20 ? "pass" : photos >= 8 ? "warn" : "fail", photos == null ? "Couldn't read the photo count." : `${photos} photos.`, 10);
  const lastPost = s.posts.map((p) => daysSince(p.created, now)).filter((d): d is number => d != null).sort((a, b) => a - b)[0];
  add("posts", "Posts in the last 2 weeks", lastPost == null ? "fail" : lastPost <= 14 ? "pass" : lastPost <= 45 ? "warn" : "fail", lastPost == null ? "No posts yet." : `Last post ${lastPost} days ago.`, 10);
  const rating = s.rating;
  add("rating", "Star rating", rating == null ? "warn" : rating >= 4.5 ? "pass" : rating >= 4 ? "warn" : "fail", rating == null ? "No rating yet." : `${rating.toFixed(1)} from ${s.reviewCount ?? 0} reviews.`, 8);
  const recent = s.reviews.filter((r) => (daysSince(r.created, now) ?? 999) <= 90);
  add("fresh_reviews", "New reviews in the last 3 months", recent.length >= 6 ? "pass" : recent.length >= 2 ? "warn" : "fail", `${recent.length} in the last 90 days.`, 6);
  const unanswered = s.reviews.filter((r) => !r.replied).length;
  const rate = s.reviews.length ? (s.reviews.length - unanswered) / s.reviews.length : null;
  add(
    "replies",
    "Replies to reviews",
    rate == null ? "warn" : rate >= 0.9 ? "pass" : rate >= 0.5 ? "warn" : "fail",
    rate == null ? "No reviews to reply to yet." : `${Math.round(rate * 100)}% of the latest ${s.reviews.length} reviews have a reply; ${unanswered} waiting.`,
    4,
  );
  return c;
}

export function gbpScore(checks: GbpCheck[]): number {
  const total = checks.reduce((n, c) => n + c.weight, 0);
  const got = checks.reduce((n, c) => n + c.weight * (c.status === "pass" ? 1 : c.status === "warn" ? 0.5 : 0), 0);
  return Math.round((got / total) * 100);
}

/** A made-up profile for samples and for demos without a connection. Clearly labelled as such. */
export function sampleSnapshot(ws: WorkspaceRow, now = new Date()): GbpSnapshot {
  const ago = (d: number) => new Date(now.getTime() - d * DAY).toISOString();
  const offer = ws.offers.split(/[,\n]/)[0]?.trim() || "your main service";
  return {
    title: ws.name,
    primaryCategory: ws.industry || "Business",
    additionalCategories: [],
    description: `${ws.name} offers ${offer}${ws.location ? ` in ${ws.location}` : ""}.`,
    phone: "+65 6000 0000",
    website: ws.website,
    address: ws.location,
    hasHours: true,
    specialHours: 0,
    services: ws.offers.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 3),
    mapsUri: "",
    photos: 6,
    rating: 4.6,
    reviewCount: 38,
    reviews: [
      { reviewer: "Sample reviewer A", stars: 5, comment: "Friendly team and they explained everything clearly before we started.", created: ago(9), replied: false },
      { reviewer: "Sample reviewer B", stars: 4, comment: "Good experience overall, but I waited about 20 minutes past my appointment time.", created: ago(23), replied: false },
      { reviewer: "Sample reviewer C", stars: 5, comment: "Easy to book on WhatsApp and the place is spotless.", created: ago(61), replied: true },
    ],
    posts: [{ summary: "We're open on the public holiday.", created: ago(52), type: "STANDARD" }],
    actions: null,
    warnings: [],
  };
}

const GbpAI = z.object({
  summary: z.string().describe("2-4 sentences: how this profile is doing and the one change that matters most. Use only the numbers given."),
  description: z.string().describe("A new business description, 600-750 characters, first 250 characters carrying the main services and area. No URLs, no phone numbers, no prices unless given, no superlatives."),
  categories: z.array(z.string()).describe("0-4 additional Google categories worth adding that fit what the business really offers. Empty if the current set is right."),
  services: z.array(z.string()).describe("Up to 10 services to list on the profile, named the way customers search for them, from the offers given."),
  posts: z
    .array(
      z.object({
        type: z.string().describe("Exactly one of: Update, Offer, Event"),
        title: z.string().describe("Short title (Offers and Events need one), under 58 characters"),
        text: z.string().describe("The post text, 60-120 words (Google allows 1,500 characters), first sentence carries the point. No phone numbers or links in the text."),
        button: z.string().describe("Exactly one of: Book, Order online, Buy, Learn more, Sign up, Call now"),
        photo: z.string().describe("The photo to use, specific to this business"),
        when: z.string().describe("When to post it, e.g. 'Week 1, Tuesday' or a dated moment"),
      }),
    )
    .describe("The requested number of Google Business Profile posts for the next few weeks"),
  replies: z
    .array(z.object({ index: z.number().describe("The review's number from the list"), reply: z.string().describe("The reply, 2-4 sentences, in the review's language") }))
    .describe("A reply for each unanswered review listed, in the same order. Empty if none are listed."),
  prescriptions: z.array(PrescriptionSchema).describe("3-6 profile fixes, most important first. Category 'Google Business Profile'. Steps use the real menu names in Google Business Profile (Edit profile, Add update, Read reviews)."),
});

const POST_TYPES = ["Update", "Offer", "Event"] as const;
const BUTTONS = ["Book", "Order online", "Buy", "Learn more", "Sign up", "Call now"] as const;

function cleanResult(
  ws: WorkspaceRow,
  snap: GbpSnapshot,
  location: string,
  checks: GbpCheck[],
  ai: z.infer<typeof GbpAI>,
  unanswered: GbpSnapshot["reviews"],
  extra: { demo?: boolean; sample?: boolean },
): GbpResult {
  return {
    title: `Business Profile: ${snap.title || ws.name}`,
    score: gbpScore(checks),
    summary: ai.summary.trim(),
    location,
    profile: { title: snap.title, primaryCategory: snap.primaryCategory, rating: snap.rating, reviewCount: snap.reviewCount, photos: snap.photos, actions: snap.actions, mapsUri: snap.mapsUri },
    checks,
    description: { current: snap.description, suggested: ai.description.trim().slice(0, 750) },
    categories: ai.categories.map((c) => c.trim()).filter(Boolean).slice(0, 4),
    services: ai.services.map((c) => c.trim()).filter(Boolean).slice(0, 10),
    posts: ai.posts.map((p) => ({
      type: POST_TYPES.find((t) => t.toLowerCase() === p.type.trim().toLowerCase()) ?? "Update",
      title: p.title.trim().slice(0, 58),
      text: p.text.trim().slice(0, 1500),
      button: BUTTONS.find((b) => b.toLowerCase() === p.button.trim().toLowerCase()) ?? "Learn more",
      photo: p.photo.trim(),
      when: p.when.trim(),
    })),
    replies: ai.replies
      .map((r) => {
        const rev = unanswered[Math.round(r.index) - 1];
        return rev ? { reviewer: rev.reviewer, stars: rev.stars, review: rev.comment, reply: r.reply.trim() } : null;
      })
      .filter((x): x is GbpReply => x !== null && Boolean(x.reply)),
    prescriptions: ai.prescriptions.map(normalizePrescription),
    warnings: snap.warnings,
    ...extra,
  };
}

/** The connected location for this outlet, read now. Null when none is picked. */
async function readProfile(ws: WorkspaceRow): Promise<{ snap: GbpSnapshot; location: string } | null> {
  const loc = selectedAccounts(ws.id, "gbp_location")[0];
  if (!loc) return null;
  const conn = getConnection(ws.id, "google");
  if (!conn) throw new ConnectorError("Google isn't connected any more. Reconnect it in Settings > Connected accounts.", "auth");
  try {
    const snap = await fetchGbpSnapshot(await accessToken(conn), loc.provider_account_id);
    markSync(ws.id, "google", null);
    return { snap, location: loc.name };
  } catch (e) {
    if (e instanceof ConnectorError) markSync(ws.id, "google", e.message);
    throw e;
  }
}

function profileBlock(s: GbpSnapshot, checks: GbpCheck[]): string {
  return [
    `Name: ${s.title}`,
    `Primary category: ${s.primaryCategory || "not set"}`,
    `Additional categories: ${s.additionalCategories.join(", ") || "none"}`,
    `Description (${s.description.length} chars): ${s.description || "none"}`,
    `Services: ${s.services.join(", ") || "none"}`,
    `Address: ${s.address || "not shown"}; phone ${s.phone || "missing"}; website ${s.website || "missing"}`,
    `Photos: ${s.photos ?? "unknown"}; rating ${s.rating ?? "none"} from ${s.reviewCount ?? 0} reviews`,
    s.actions ? `Last 30 days: ${s.actions.calls} calls, ${s.actions.websiteClicks} website clicks, ${s.actions.directions} direction requests` : "",
    `Recent posts: ${s.posts.slice(0, 5).map((p) => `${p.created?.slice(0, 10) ?? "?"}: ${p.summary.slice(0, 120)}`).join(" | ") || "none"}`,
    "",
    "CHECKS (computed from the profile)",
    ...checks.map((c) => `- [${c.status}] ${c.label}: ${c.detail}`),
  ]
    .filter((l, i) => l !== "" || i > 8)
    .join("\n");
}

function demoAI(ws: WorkspaceRow, snap: GbpSnapshot, checks: GbpCheck[], unanswered: GbpSnapshot["reviews"], posts: number): z.infer<typeof GbpAI> {
  const offers = ws.offers.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  const main = offers[0] || "our services";
  const area = ws.location || "your area";
  const failing = checks.filter((c) => c.status !== "pass");
  const ideas = [
    { type: "Update", title: `What to expect at your first ${main} visit`, text: `New to ${main}? Here's how a first visit at ${ws.name} works: a short chat about what you want, a clear plan and the price before anything starts, and time for your questions. Book a slot that suits you.`, button: "Book", photo: "Your team member at the front desk, smiling, in daylight", when: "Week 1, Tuesday" },
    { type: "Update", title: "Meet the team", text: `The people you'll see at ${ws.name} in ${area}. Every visit starts with someone who knows your history. Say hello next time you're in.`, button: "Learn more", photo: "A team photo in the space, everyone in uniform", when: "Week 2, Thursday" },
    { type: "Update", title: `${offers[1] || main}: your questions answered`, text: `The three questions we hear most about ${offers[1] || main}, answered in one place: how long it takes, what it feels like, and how soon you'll see a difference. Ask us anything else when you book.`, button: "Learn more", photo: "Close-up of the treatment room or tools, tidy and well lit", when: "Week 3, Monday" },
    { type: "Update", title: "Easy to find us", text: `Coming to ${ws.name}? Here's the easiest way in from ${area}, where to park and which entrance to use. See you soon.`, button: "Learn more", photo: "Your shopfront from the street, with the sign readable", when: "Week 4, Wednesday" },
  ];
  return {
    summary: `This profile scores ${gbpScore(checks)} out of 100 on the checks Google rewards. ${failing.length ? `The biggest gaps: ${failing.slice(0, 3).map((c) => c.label.toLowerCase()).join(", ")}.` : "Every check passes; keep posting and replying."} Rules-based review (AI writing is off).`,
    description: `${ws.name} offers ${offers.slice(0, 4).join(", ") || main}${ws.location ? ` in ${ws.location}` : ""}. ${ws.audience ? `We look after ${ws.audience}. ` : ""}Every visit starts with a short consultation so you know the plan and the price before anything begins. Book online or message us to find a time that suits you.`.slice(0, 750),
    categories: [],
    services: offers.slice(0, 10),
    posts: ideas.slice(0, posts),
    replies: unanswered.map((r, i) => ({
      index: i + 1,
      reply: (r.stars ?? 5) >= 4 ? `Thank you for taking the time to write this. We're glad the visit went well, and we'll pass your note to the team.` : `Thank you for telling us. We're sorry about this and would like to put it right; please message us so we can talk it through.`,
    })),
    prescriptions: failing.slice(0, 5).map((c) => ({
      title: `Fix: ${c.label.toLowerCase()}`,
      diagnosis: c.detail,
      steps: ["Open Google Maps or search your business name on Google while signed in", "Click Edit profile", `Update ${c.label.toLowerCase()} and save`],
      where: "Google Business Profile > Edit profile",
      priority: c.weight >= 10 ? "high" : "medium",
      impact: c.weight >= 10 ? "high" : "medium",
      effort: "quick",
      category: "Google Business Profile",
      recheck_days: 14,
    })),
  };
}

export const gbpAgent: AgentDef<Input> = {
  id: "gbp",
  name: "Google Business Profile",
  blurb: "Your Google Maps profile checked, a better description, posts to publish and replies to reviews.",
  description:
    "Reads your connected Google Business Profile for this outlet and checks what Google rewards in the map results: categories, description, services, hours, photos, posts and reviews. You get the fixes in order, a new description to paste, posts for the coming weeks and a reply for every review still waiting.",

  parseInput(raw) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const n = Number(r.posts);
    return { focus: String(r.focus ?? "").trim().slice(0, 400), posts: n === 2 || n === 4 || n === 6 ? n : 4 };
  },

  runTitle: (_input, ws) => `Business Profile check: ${ws.name}`,

  async run(input, ctx) {
    const ws = ctx.ws;
    ctx.progress("Reading your Business Profile");
    const read = await readProfile(ws);
    if (!read) throw new Error("Connect Google and pick this outlet's Business Profile location in Settings > Connected accounts first.");
    const { snap, location } = read;
    const checks = gbpChecks(snap);
    const unanswered = snap.reviews.filter((r) => !r.replied).slice(0, 8);
    const m = marketFor(ws.country);
    const regulated = Boolean(ws.regulated);

    ctx.progress("Writing fixes, posts and review replies");
    const ai = await structured({
      system: `You are the Google Business Profile specialist. You help small businesses${m.code === "INTL" ? "" : ` in ${m.inPhrase}`} get found and chosen on Google Maps and in local search. You write things the owner can paste straight into their profile.
- Base every fix on the computed checks and the profile as given. Don't invent reviews, ratings, prices, awards or years in business.
- Posts: useful and specific to this business (what to expect, answers to common questions, seasonal moments, a real offer only if the owner listed one). No hashtags. No phone numbers or links in the text (the button carries the action).
- Review replies: thank the person by what they said, keep it short and warm, and for a complaint apologise, don't argue and invite them to message you. Never repeat their personal details.${
        regulated
          ? `
- REGULATED BUSINESS (healthcare, legal or financial rules apply${m.code === "SG" ? " in Singapore" : ""}): in review replies never confirm that the reviewer is a patient or client, never mention a treatment, condition or outcome, and never ask for more reviews. Posts must not use testimonials, before/after, superlatives ("best", "No.1"), guarantees or discounts framed to induce treatment.`
          : ""
      }
- Never use em dashes, and never the words "leverage", "seamless", "unlock", "streamline", "robust", "synergy", "transformative", "generic" or "plain English".`,
      prompt: `BUSINESS PROFILE (from the owner)
${businessContext(ws)}

GOOGLE BUSINESS PROFILE: ${location}
${profileBlock(snap, checks)}
${input.focus ? `\nTHE OWNER WANTS TO FOCUS ON: ${input.focus}\n` : ""}
UNANSWERED REVIEWS (numbered)
${unanswered.map((r, i) => `${i + 1}. ${r.stars ?? "?"} stars, ${r.created?.slice(0, 10) ?? "date not shown"}: "${r.comment || "(no text)"}"`).join("\n") || "none"}

Write the summary, the new description, categories and services to add, ${input.posts} posts, a reply for each unanswered review, and the prescriptions.`,
      schema: GbpAI,
      effort: "medium",
    });
    return cleanResult(ws, snap, location, checks, ai, unanswered, {});
  },

  async demo(input, ctx) {
    const ws = ctx.ws;
    let read: { snap: GbpSnapshot; location: string } | null = null;
    try {
      read = await readProfile(ws);
    } catch (e) {
      // Without AI writing, a read failure still shows the sample so the owner sees the shape of the report.
      console.warn("[gbp] demo read failed", (e as Error)?.message);
    }
    const snap = read?.snap ?? sampleSnapshot(ws);
    const checks = gbpChecks(snap);
    const unanswered = snap.reviews.filter((r) => !r.replied).slice(0, 8);
    const ai = demoAI(ws, snap, checks, unanswered, input.posts);
    if (!read) ai.summary = `This is a sample profile, not yours: connect Google and pick your location in Settings > Connected accounts to check your real one. ${ai.summary}`;
    return cleanResult(ws, snap, read?.location ?? "Sample profile", checks, ai, unanswered, { demo: true, sample: !read });
  },
};
