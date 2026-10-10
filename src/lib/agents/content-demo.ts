import type { Prescription } from "../ai";
import type { Reference } from "../social-links";
import { beatsFromLines, defaultShootStyle, type Beat, type ShootStyle } from "../script-beats";
import type { WorkspaceRow } from "../db";
import { marketFor, type Market, type MarketCode } from "../markets";
import type { AgentResult } from "./types";

// ---------- Shared types and helpers (used by content.ts and the demo) ----------

export const PLATFORMS = ["Instagram", "TikTok", "Facebook", "LinkedIn", "Xiaohongshu", "YouTube Shorts"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const GOALS = {
  enquiries: "Get enquiries",
  followers: "Grow followers",
  trust: "Build trust",
  launch: "Launch something",
} as const;
export type Goal = keyof typeof GOALS;

export type ContentInput = {
  platforms: Platform[];
  niche: string;
  goal: Goal;
  count: 6 | 10 | 14;
  per_week: number;
  working: string;
  avoid: string;
  trends: boolean;
  language: string;
  /** Title of an earlier idea to generate variations on. Empty for a normal run. */
  more_like: string;
};

export type Trend = {
  name: string;
  what_it_is: string;
  how_to_use_it: string;
  platform: string;
  shelf_life: "this week" | "this month" | "evergreen";
  /** Real posts showing the trend, found by the research step. */
  examples?: Reference[];
};

export type Pillar = { name: string; percent: number; description: string };

export type Idea = {
  title: string;
  platform: string;
  format: string;
  pillar: string;
  hook: string;
  script_or_outline: string[];
  /** Video and carousel scripts beat by beat (see src/lib/script-beats.ts). */
  beats?: Beat[];
  shoot_style?: ShootStyle;
  caption: string;
  hashtags: string[];
  cta: string;
  why_it_works: string;
  effort: "quick" | "half-day" | "project";
  compliance_note: string;
  /** What this idea borrows from what is working now, and why. Live runs with trend research only. */
  trend_basis?: string;
  /** Real posts the idea borrows from. Live runs with trend research only. */
  references?: Reference[];
};

export type CalendarSlot = { day: string; idea_title: string; platform: string };

export type ContentResult = AgentResult & {
  platforms: string[];
  goal: string;
  more_like: string;
  trends: Trend[];
  trends_note: string;
  pillars: Pillar[];
  ideas: Idea[];
  calendar: CalendarSlot[];
  sources: { title: string; url: string }[];
};

/** Match free text to one of our platforms ("youtube" -> "YouTube Shorts", "XHS" / "RED" -> "Xiaohongshu"). */
export function matchPlatform(value: unknown): Platform | null {
  const v = String(value ?? "").toLowerCase();
  if (!v) return null;
  if (v.includes("xiaohongshu") || v.includes("xhs") || v.includes("rednote") || v === "red" || v.includes("小红书")) return "Xiaohongshu";
  if (v.includes("youtube") || v.includes("shorts")) return "YouTube Shorts";
  if (v.includes("tiktok")) return "TikTok";
  if (v.includes("instagram") || v === "ig" || v.includes("reel")) return "Instagram";
  if (v.includes("facebook") || v === "fb") return "Facebook";
  if (v.includes("linkedin")) return "LinkedIn";
  return null;
}

export function matchGoal(value: unknown): Goal {
  const v = String(value ?? "").toLowerCase();
  if (v.includes("follow")) return "followers";
  if (v.includes("trust")) return "trust";
  if (v.includes("launch")) return "launch";
  return "enquiries";
}

/** Posting days for a week, spread out sensibly for the given capacity. */
export function postingDays(perWeek: number): string[] {
  const patterns: Record<number, string[]> = {
    1: ["Tue"],
    2: ["Tue", "Fri"],
    3: ["Mon", "Wed", "Fri"],
    4: ["Mon", "Tue", "Thu", "Sat"],
    5: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    6: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    7: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  };
  return patterns[Math.min(7, Math.max(1, Math.round(perWeek)))];
}

/** Clean hashtags: one word each, leading #, no duplicates, no spammy tags, 15 max. */
const SPAMMY = new Set(["followforfollow", "follow4follow", "f4f", "like4like", "l4l", "likeforlike", "instagood", "photooftheday", "fyp", "foryou", "foryoupage", "viral", "explorepage", "explore", "tagsforlikes", "followme"]);
export function cleanHashtags(tags: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const list = Array.isArray(tags) ? tags : String(tags ?? "").split(/[\s,]+/);
  for (const raw of list) {
    for (const part of String(raw).split(/[\s,]+/)) {
      const word = part.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
      if (!word) continue;
      const key = word.toLowerCase();
      if (seen.has(key) || SPAMMY.has(key)) continue;
      seen.add(key);
      out.push("#" + word);
    }
  }
  return out.slice(0, 15);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Singapore calendar moments by month. Lunar and gazetted holidays have no fixed date, so we say "check the date".
const SG_MOMENTS: string[][] = [
  ["New Year's Day (1 Jan)", "Back to school", "Chinese New Year preparations (CNY falls in late Jan or Feb; check the date)"],
  ["Chinese New Year (check the date)", "Valentine's Day (14 Feb)"],
  ["International Women's Day (8 Mar)", "March school holidays", "Hari Raya Puasa can fall in March or April (check the gazetted date)"],
  ["Good Friday (check the date)", "Hari Raya Puasa can fall in March or April (check the gazetted date)"],
  ["Labour Day (1 May)", "Mother's Day (second Sunday of May)", "Vesak Day (check the date)", "5.5 sales"],
  ["Father's Day (third Sunday of June)", "June school holidays", "Hari Raya Haji (check the date)", "6.6 mid-year sales"],
  ["7.7 sales", "Mid-year sales", "Racial Harmony Day in schools (21 Jul)"],
  ["National Day (9 Aug)", "8.8 sales"],
  ["9.9 sales", "Teachers' Day in schools (first Friday of September)", "Mid-Autumn Festival (September or October; check the date)", "Singapore Grand Prix weekend (check the date)"],
  ["10.10 sales", "Children's Day in schools (first Friday of October)", "Deepavali (October or November; check the gazetted date)", "Halloween (31 Oct)"],
  ["11.11 Singles' Day sales", "Black Friday and Cyber Monday", "Deepavali (October or November; check the gazetted date)", "Year-end school holidays begin"],
  ["12.12 sales", "Christmas (25 Dec)", "Year-end school holidays", "New Year's Eve countdown"],
];

// Other markets: only well-known fixed dates or clearly recurring moments. Anything lunar, gazetted or
// set by organisers each year says "check the date"; never add an exact date we can't be sure of.
const OTHER_MOMENTS: Partial<Record<MarketCode, { months: string[][]; payday?: string }>> = {
  MY: {
    months: [
      ["New Year's Day (1 Jan)", "Back to school", "Chinese New Year preparations (late Jan or Feb; check the date)"],
      ["Chinese New Year (check the date)", "Valentine's Day (14 Feb)", "Ramadan may begin (check the date)"],
      ["Ramadan and Hari Raya Aidilfitri (check the dates)", "International Women's Day (8 Mar)"],
      ["Hari Raya Aidilfitri open houses (check the date)", "4.4 sales"],
      ["Labour Day (1 May)", "Mother's Day (second Sunday of May)", "Wesak Day (check the date)", "Hari Raya Haji (May or June; check the date)", "5.5 sales"],
      ["Father's Day (third Sunday of June)", "Hari Raya Haji (May or June; check the date)", "6.6 mid-year sales"],
      ["7.7 sales", "Mid-year sales"],
      ["Merdeka Day (31 Aug)", "8.8 sales"],
      ["Malaysia Day (16 Sep)", "9.9 sales", "Mid-Autumn Festival (September or October; check the date)"],
      ["10.10 sales", "Deepavali (October or November; check the date)", "Halloween (31 Oct)"],
      ["11.11 sales", "Black Friday and Cyber Monday", "Deepavali (October or November; check the date)", "Year-end school holidays begin"],
      ["12.12 sales", "Christmas (25 Dec)", "Year-end school holidays", "New Year's Eve countdown"],
    ],
    payday: "Every month: payday sales around the 25th to month end",
  },
  ID: {
    months: [
      ["New Year's Day (1 Jan)", "Imlek / Chinese New Year preparations (check the date)", "1.1 sales"],
      ["Imlek / Chinese New Year (check the date)", "Valentine's Day (14 Feb)", "Ramadan may begin (check the date)", "2.2 sales"],
      ["Ramadan and Lebaran / Idul Fitri (check the dates)", "3.3 sales"],
      ["Lebaran / Idul Fitri holidays (check the date)", "Kartini Day (21 Apr)", "4.4 sales"],
      ["Labour Day (1 May)", "Waisak (check the date)", "Idul Adha (May or June; check the date)", "5.5 sales"],
      ["Idul Adha (May or June; check the date)", "School holidays (check your local dates)", "6.6 sales"],
      ["New school year (check your local dates)", "7.7 sales"],
      ["Independence Day (17 Aug)", "8.8 sales"],
      ["9.9 sales"],
      ["10.10 sales", "Halloween (31 Oct)"],
      ["11.11 sales", "Black Friday"],
      ["12.12 Harbolnas online shopping day", "Christmas (25 Dec)", "Year-end holidays", "New Year's Eve"],
    ],
    payday: "Every month: payday (gajian) sales around the 25th to month end",
  },
  PH: {
    months: [
      ["New Year's Day (1 Jan)", "Chinese New Year preparations (check the date)"],
      ["Chinese New Year (check the date)", "Valentine's Day (14 Feb)"],
      ["Summer season begins", "International Women's Day (8 Mar)", "Holy Week (March or April; check the date)"],
      ["Holy Week (check the date)", "Summer trips and outings"],
      ["Labour Day (1 May)", "Mother's Day (second Sunday of May)", "5.5 sales"],
      ["Independence Day (12 Jun)", "Father's Day (third Sunday of June)", "Back to school (check your local dates)", "6.6 sales"],
      ["7.7 sales", "Rainy season"],
      ["National Heroes Day (last Monday of August)", "8.8 sales"],
      ["Start of the 'ber months' Christmas season", "9.9 sales"],
      ["10.10 sales", "Halloween (31 Oct)", "Undas preparations"],
      ["All Saints' Day (1 Nov)", "11.11 sales", "Black Friday", "Christmas shopping"],
      ["12.12 sales", "Simbang Gabi (16 to 24 Dec)", "Christmas (25 Dec)", "Rizal Day (30 Dec)", "New Year's Eve"],
    ],
    payday: "Every month: paydays around the 15th and the 30th, when many people book and buy",
  },
  HK: {
    months: [
      ["New Year's Day (1 Jan)", "Chinese New Year preparations (late Jan or Feb; check the date)"],
      ["Chinese New Year (check the date)", "Valentine's Day (14 Feb)"],
      ["International Women's Day (8 Mar)", "Easter (March or April; check the date)"],
      ["Ching Ming Festival (check the date)", "Easter (check the date)"],
      ["Labour Day (1 May)", "Mother's Day (second Sunday of May)", "Buddha's Birthday (check the date)"],
      ["Tuen Ng / Dragon Boat Festival (check the date)", "Father's Day (third Sunday of June)"],
      ["HKSAR Establishment Day (1 Jul)", "Summer sales", "Summer holidays"],
      ["Summer holidays", "Back to school prep"],
      ["Mid-Autumn Festival (September or October; check the date)", "Back to school"],
      ["National Day (1 Oct)", "Chung Yeung Festival (check the date)", "Halloween (31 Oct)"],
      ["11.11 sales", "Black Friday and Cyber Monday"],
      ["12.12 sales", "Christmas (25 Dec)", "New Year's Eve"],
    ],
  },
  AU: {
    months: [
      ["New Year's Day (1 Jan)", "Australia Day (26 Jan)", "Summer holidays", "Back to school (late Jan or early Feb)"],
      ["Back to school", "Valentine's Day (14 Feb)"],
      ["International Women's Day (8 Mar)", "Easter (March or April; check the date)"],
      ["Easter (check the date)", "Anzac Day (25 Apr)", "School holidays (check your state's dates)"],
      ["Mother's Day (second Sunday of May)", "EOFY sales start"],
      ["End of financial year (EOFY) sales: the financial year ends 30 June"],
      ["New financial year (1 Jul)", "Tax time", "School holidays (check your state's dates)"],
      ["Tax time", "Father's Day coming up (first Sunday of September)"],
      ["Father's Day (first Sunday of September)", "Spring starts (1 Sep)", "School holidays (check your state's dates)"],
      ["Halloween (31 Oct)", "Spring racing season"],
      ["Melbourne Cup (first Tuesday of November)", "Black Friday and Cyber Monday", "Click Frenzy (check the date)", "Christmas shopping"],
      ["Christmas (25 Dec)", "Boxing Day sales (26 Dec)", "Summer holidays", "New Year's Eve"],
    ],
  },
  NZ: {
    months: [
      ["New Year (1 and 2 Jan)", "Summer holidays"],
      ["Waitangi Day (6 Feb)", "Valentine's Day (14 Feb)", "Back to school"],
      ["Easter (March or April; check the date)"],
      ["Easter (check the date)", "Anzac Day (25 Apr)", "School holidays (check the dates)"],
      ["Mother's Day (second Sunday of May)"],
      ["Matariki (June or July; check the date)"],
      ["Matariki (June or July; check the date)", "School holidays (check the dates)", "Winter specials"],
      ["Father's Day coming up (first Sunday of September)"],
      ["Father's Day (first Sunday of September)", "Spring starts"],
      ["Labour Day (fourth Monday of October)", "Halloween (31 Oct)"],
      ["Black Friday and Cyber Monday", "Christmas shopping"],
      ["Christmas (25 Dec)", "Boxing Day sales (26 Dec)", "Summer holidays", "New Year's Eve"],
    ],
  },
  GB: {
    months: [
      ["New Year's Day (1 Jan)", "January sales", "New Year resolutions"],
      ["Valentine's Day (14 Feb)", "February half-term (check your local dates)"],
      ["Mother's Day / Mothering Sunday (March or early April; check the date)", "International Women's Day (8 Mar)", "Easter (March or April; check the date)"],
      ["Easter (check the date)", "Easter school holidays"],
      ["Early May bank holiday (usually the first Monday of May)", "Spring bank holiday (usually the last Monday of May)", "May half-term"],
      ["Father's Day (third Sunday of June)", "Summer starts"],
      ["Summer holidays begin (check your local dates)", "Summer sales"],
      ["Summer bank holiday (last Monday of August in England and Wales)", "Back to school prep"],
      ["Back to school", "Autumn starts"],
      ["Halloween (31 Oct)", "October half-term (check your local dates)"],
      ["Bonfire Night (5 Nov)", "Black Friday and Cyber Monday", "Christmas shopping"],
      ["Christmas (25 Dec)", "Boxing Day sales (26 Dec)", "New Year's Eve"],
    ],
    payday: "Every month: payday at month end, when many people book and buy",
  },
  US: {
    months: [
      ["New Year's Day (1 Jan)", "New Year resolutions", "Martin Luther King Jr. Day (third Monday of January)"],
      ["Valentine's Day (14 Feb)", "Presidents' Day (third Monday of February)", "Super Bowl weekend (check the date)"],
      ["St. Patrick's Day (17 Mar)", "Spring break (check your local dates)", "Easter (March or April; check the date)"],
      ["Easter (check the date)", "Tax Day (check the date)"],
      ["Mother's Day (second Sunday of May)", "Memorial Day (last Monday of May)"],
      ["Father's Day (third Sunday of June)", "Juneteenth (19 Jun)", "Summer starts"],
      ["Independence Day / July 4th", "Summer sales"],
      ["Back to school"],
      ["Labor Day (first Monday of September)", "Fall starts"],
      ["Halloween (31 Oct)"],
      ["Thanksgiving (fourth Thursday of November)", "Black Friday", "Small Business Saturday", "Cyber Monday"],
      ["Holiday gift shopping", "Christmas (25 Dec)", "New Year's Eve"],
    ],
  },
  AE: {
    months: [
      ["New Year's Day (1 Jan)", "Dubai Shopping Festival (runs over Dec and Jan; check the dates)"],
      ["Valentine's Day (14 Feb)", "Ramadan may begin (check the date)"],
      ["Ramadan and Eid al-Fitr (check the dates)", "Mother's Day (21 Mar)"],
      ["Eid al-Fitr (check the date)"],
      ["Eid al-Adha may fall in May or June (check the date)"],
      ["Eid al-Adha (check the date)", "Summer starts"],
      ["Summer sales", "Dubai Summer Surprises (check the dates)"],
      ["Back to school prep", "Dubai Summer Surprises (check the dates)"],
      ["Back to school"],
      ["Halloween (31 Oct)"],
      ["11.11 sales", "White Friday / Black Friday sales (check the date)"],
      ["UAE National Day (2 Dec)", "Christmas (25 Dec)", "New Year's Eve", "Dubai Shopping Festival (check the dates)"],
    ],
    payday: "Every month: payday at month end, when many people book and buy",
  },
};

/** Calendar moments for this month and next in the business's market, plus the payday window where it is a habit. */
export function seasonalMoments(date: Date, market: Market, location = ""): { label: string; moments: string[] } {
  const m = date.getMonth();
  const next = (m + 1) % 12;
  const label = `${MONTHS[m]} ${date.getFullYear()}`;
  const list = (months: string[][]) => [...months[m].map((x) => `${MONTHS[m]}: ${x}`), ...months[next].map((x) => `${MONTHS[next]}: ${x}`)];
  if (market.code === "SG")
    return { label, moments: [...list(SG_MOMENTS), "Every month: payday sales around the 25th to month end, when many people book and buy"] };
  const other = OTHER_MOMENTS[market.code];
  if (other) return { label, moments: [...list(other.months), ...(other.payday ? [other.payday] : [])] };
  const where = location || "your area";
  return { label, moments: [`Public holidays and shopping dates in ${where} for ${MONTHS[m]} and ${MONTHS[next]}`, "Payday at month end"] };
}

export const REGULATED_NOTE =
  "Regulated category: no testimonials or reviews, no before/after photos, no words like 'best', 'No.1' or 'guaranteed', and no promises of results. Keep claims factual and check with your licensee or the relevant Singapore advertising rules before posting.";

/** The regulated-category note for the business's market. */
export function regulatedNote(m: Market): string {
  if (m.code === "SG") return REGULATED_NOTE;
  return `Regulated category: no testimonials or reviews, no before/after photos, no words like 'best', 'No.1' or 'guaranteed', and no promises of results. Keep claims factual and check the advertising rules that apply in ${m.inPhrase} (or ask a professional) before posting.`;
}

/** How customers in this market usually message a business, worded for social posts. */
type Chat = { us: string; Us: string; on: string; app: string; sticker: string; tap: string };
function chatFor(m: Market): Chat {
  switch (m.messaging) {
    case "SMS":
      return { us: "DM us", Us: "DM us", on: "by DM", app: "DM", sticker: "your booking page", tap: "Tap the link sticker to book" };
    case "Messenger":
      return { us: "message us", Us: "Message us", on: "on Messenger", app: "Messenger", sticker: "Messenger", tap: "Tap the link sticker to message us" };
    case "LINE":
      return { us: "message us on LINE", Us: "Message us on LINE", on: "on LINE", app: "LINE", sticker: "LINE", tap: "Tap the link sticker to message us on LINE" };
    default:
      return { us: "WhatsApp us", Us: "WhatsApp us", on: "on WhatsApp", app: "WhatsApp", sticker: "WhatsApp", tap: "Tap the link sticker to WhatsApp" };
  }
}

// ---------- Demo (no API key) ----------

type Kind = "video" | "carousel" | "static" | "story" | "text" | "live";

const SUPPORTS: Record<Platform, Kind[]> = {
  Instagram: ["video", "carousel", "static", "story", "live"],
  TikTok: ["video", "carousel", "live"],
  Facebook: ["video", "carousel", "static", "story", "text", "live"],
  LinkedIn: ["video", "carousel", "static", "text"],
  Xiaohongshu: ["carousel", "video"],
  "YouTube Shorts": ["video"],
};

function formatLabel(kind: Kind, platform: Platform): string {
  switch (kind) {
    case "video":
      return platform === "TikTok" ? "TikTok video" : platform === "YouTube Shorts" ? "Short" : platform === "Xiaohongshu" ? "Video note" : platform === "LinkedIn" ? "Native video" : "Reel";
    case "carousel":
      return platform === "TikTok" ? "Photo carousel" : platform === "LinkedIn" ? "Document carousel" : platform === "Xiaohongshu" ? "Image note" : "Carousel";
    case "static":
      return "Static post";
    case "story":
      return "Story";
    case "text":
      return "Text post";
    case "live":
      return "Live";
  }
}

type PillarKey = "educate" | "behind" | "proof" | "offer" | "local";

type Vars = {
  name: string;
  industry: string;
  offer: string;
  offer2: string;
  loc: string;
  audience: string;
  regulated: boolean;
  moment: string;
  month: string;
  /** "Singapore", "the UK": the business's country as used in a sentence. */
  country: string;
  chat: Chat;
  eventsTag: string;
  market: Market;
};

type Template = {
  kind: Kind;
  pillar: PillarKey;
  effort: Idea["effort"];
  build: (v: Vars) => { title: string; hook: string; script: string[]; caption: string; tags: string[]; cta: string; why: string };
};

const TEMPLATES: Template[] = [
  {
    kind: "video",
    pillar: "educate",
    effort: "quick",
    build: (v) => ({
      title: `Myth vs fact: ${v.offer}`,
      hook: `Stop believing this about ${v.offer}.`,
      script: [
        `0-2s: Face to camera, text on screen: "MYTH: [the thing customers wrongly believe about ${v.offer}]". Say the hook.`,
        "2-8s: Explain in one sentence why people believe it (something they read online, a friend's story).",
        "8-20s: Cut to you at work. Give the fact in plain words, one point per cut.",
        `20-25s: Back to camera: "If you're unsure, ask us before you book anything."`,
        "Add captions on screen. Keep it under 30 seconds.",
      ],
      caption: `The most common thing we hear about ${v.offer} is also the most wrong. Here's what's actually true, from the people who do this every day at ${v.name}.\n\nGot another myth you've heard? Drop it in the comments and we'll answer it in the next video.`,
      tags: ["mythbusting", "askthepro"],
      cta: "Comment the myth you've heard and we'll answer it next",
      why: "Myth-busting earns comments and saves, and it shows expertise without selling. Your comment replies become your next videos.",
    }),
  },
  {
    kind: "carousel",
    pillar: "educate",
    effort: "half-day",
    build: (v) => ({
      title: `5 questions to ask before you book ${v.offer}`,
      hook: `Ask these 5 questions before you pay for ${v.offer} anywhere in ${v.loc}.`,
      script: [
        "Slide 1: The hook in big text. Plain background in your brand colour.",
        `Slide 2: "Who will actually be doing it?" One line on why it matters.`,
        `Slide 3: "What's included in the price, and what costs extra?"`,
        `Slide 4: "What happens if I'm not happy or something changes?"`,
        `Slide 5: "How long until I see the result / get it done?"`,
        `Slide 6: "What should I do (or avoid) before and after?"`,
        `Slide 7: "We answer all 5 ${v.chat.on} before you book. Link in bio."`,
      ],
      caption: `Save this for when you're comparing ${v.industry} options in ${v.loc}.\n\nA good provider will happily answer all 5. If they dodge one, that tells you something.\n\nWant our answers? ${v.chat.Us}, link in bio.`,
      tags: ["tips", "beforeyoubook"],
      cta: `Save this and ${v.chat.us} for our answers`,
      why: "Checklists get saved and shared with friends who are also comparing. It positions you as the honest option before they have even contacted anyone.",
    }),
  },
  {
    kind: "video",
    pillar: "behind",
    effort: "half-day",
    build: (v) => ({
      title: "What actually happens at your first visit",
      hook: `This is exactly what happens when you walk into ${v.name} for the first time.`,
      script: [
        "0-2s: Walk-in shot through your front door, hook as text on screen.",
        "2-6s: Reception or arrival. Voiceover: what we ask you first.",
        "6-14s: The chat or consult. What we check and why.",
        `14-22s: The ${v.offer} itself, shown in 2 or 3 quick cuts (no faces of customers unless you have written consent).`,
        "22-28s: Wrap up: what you get to take home or next steps.",
        `28-30s: End card: "Questions? ${v.chat.Us}."`,
      ],
      caption: `First time is always the most nerve-wracking. So here's the whole thing, start to finish, so there are no surprises.\n\nAnything we missed that you want to know? Ask below.`,
      tags: ["behindthescenes", "firstvisit"],
      cta: `Ask any question in the comments or ${v.chat.us}`,
      why: "Fear of the unknown is one of the biggest reasons people delay booking. Showing the process removes it.",
    }),
  },
  {
    kind: "video",
    pillar: "local",
    effort: "quick",
    build: (v) => ({
      title: `POV: finding ${an(v.industry)} in ${v.loc} that explains things properly`,
      hook: `POV: you finally found ${an(v.industry)} in ${v.loc} that tells you everything before you pay.`,
      script: [
        "0-2s: Relatable face to camera (relieved, surprised). Hook as text overlay. Use a trending sound from the TikTok/Instagram audio library.",
        `2-6s: Quick cut: phone screen showing a clear ${v.chat.app} reply (blur the customer's name and number).`,
        "6-10s: Cut to your space, calm and tidy.",
        `10-12s: Text: "This is the standard at ${v.name}."`,
      ],
      caption: `Honestly, this should be normal. Tag someone who's been burned by vague answers before.`,
      tags: ["pov", "relatable"],
      cta: "Tag a friend who needs this",
      why: "POV formats are low effort and highly shareable. Tagging spreads you to people who are not following yet.",
    }),
  },
  {
    kind: "static",
    pillar: "offer",
    effort: "quick",
    build: (v) => ({
      title: `${v.month} slots for ${v.offer} are open`,
      hook: `${v.month} slots for ${v.offer} are open. Here's how to book.`,
      script: [
        `Image: a clean photo of your space or your team doing ${v.offer}. Text overlay: "${v.month} slots open".`,
        "Second line on the image: the days and times you have availability.",
        `Bottom: "${v.chat.app} to book" and your handle.`,
      ],
      caption: `${v.month} slots for ${v.offer} are open now.\n\nHow to book:\n1. ${v.chat.Us} (link in bio)\n2. Tell us the day that suits you\n3. We confirm within the day\n\nWeekend slots usually go first.`,
      tags: ["booknow", "appointments"],
      cta: `${v.chat.Us} to book (link in bio)`,
      why: "People who already follow you need a clear, low-friction reason to act now. Simple booking posts convert warm followers.",
    }),
  },
  {
    kind: "video",
    pillar: "educate",
    effort: "quick",
    build: (v) => ({
      title: `What changes the price of ${v.offer}`,
      hook: `Why does ${v.offer} cost different amounts at different places? Here's what you're actually paying for.`,
      script: [
        "0-3s: Hook to camera, text on screen.",
        "3-10s: Factor 1: who does it (experience, qualifications).",
        "10-17s: Factor 2: what's included (materials, follow-ups, aftercare).",
        "17-24s: Factor 3: time spent per customer.",
        `24-30s: "Ask us for our price ${v.chat.on}. We'll tell you exactly what's in it."`,
      ],
      caption: `Price is the first thing everyone asks, so let's talk about it openly. Cheaper isn't always worse and pricier isn't always better. Here's how to tell the difference.\n\nWant our price breakdown? ${v.chat.Us}.`,
      tags: ["pricing", "thingstoknow"],
      cta: `${v.chat.Us} for a price breakdown`,
      why: "Price questions are the biggest pre-booking worry. Answering them openly builds trust and pre-qualifies enquiries.",
    }),
  },
  {
    kind: "carousel",
    pillar: "proof",
    effort: "half-day",
    build: (v) =>
      v.regulated
        ? {
            title: `How we keep you safe: our ${v.offer} checklist`,
            hook: `Here's the checklist we run through before every ${v.offer}.`,
            script: [
              "Slide 1: Hook in big text.",
              "Slide 2: Who is qualified to do it here (roles, not claims).",
              "Slide 3: What we check before we start.",
              "Slide 4: Hygiene and equipment steps.",
              "Slide 5: When we would say no or refer you elsewhere.",
              `Slide 6: "Questions? Speak to our team. Link in bio."`,
            ],
            caption: `You should know exactly what happens before anyone starts. This is our checklist for ${v.offer}, every time.\n\nQuestions about any step? Ask us.`,
            tags: ["safetyfirst", "process"],
            cta: "Message us with any question about the process",
            why: "In a regulated category you can't use testimonials, but you can show standards. Process content builds the same trust within the rules.",
          }
        : {
            title: `Customer story: why they chose ${v.offer}`,
            hook: `She almost didn't book. Here's what changed her mind.`,
            script: [
              "Slide 1: Hook with a photo of the customer (only with written permission).",
              "Slide 2: What they were worried about, in their words.",
              "Slide 3: What they tried before.",
              `Slide 4: What happened with ${v.offer} at ${v.name}.`,
              "Slide 5: Their honest one-line review (quote it exactly).",
              `Slide 6: "Your turn? ${v.chat.Us}."`,
            ],
            caption: `Real story, shared with permission. We love hearing from customers who almost didn't come in.\n\nGot a worry like this? Ask us, no pressure.`,
            tags: ["customerstory", "realreviews"],
            cta: `${v.chat.Us} with your question`,
            why: "Stories from real customers answer objections better than you can. Get written permission and quote them exactly.",
          },
  },
  {
    kind: "video",
    pillar: "behind",
    effort: "quick",
    build: (v) => ({
      title: `Meet the person doing your ${v.offer}`,
      hook: `You've seen our work. Here's who's actually doing your ${v.offer}.`,
      script: [
        "0-2s: Close-up of hands at work, then pull out to the person's face. Hook on screen.",
        "2-10s: Name, role, how long they've been doing this.",
        "10-20s: One thing they wish every customer knew.",
        "20-25s: Something human: a hobby, favourite local food spot.",
        `25-28s: Text: "Book with [name] at ${v.name}."`,
      ],
      caption: `People book people. Meet the team behind ${v.name}.\n\nWhat do you want to ask them? Comment below.`,
      tags: ["meettheteam", "smallbusiness"],
      cta: "Comment a question for the team",
      why: "Faces build familiarity fast. Customers feel they know who they're booking with before they arrive.",
    }),
  },
  {
    kind: "story",
    pillar: "offer",
    effort: "quick",
    build: (v) => ({
      title: "Story poll: which slot suits you",
      hook: "Quick poll: weekday evening or weekend morning?",
      script: [
        "Frame 1: Poll sticker with the hook question.",
        `Frame 2: "We're opening more slots for ${v.offer} based on your answers."`,
        `Frame 3: Link sticker to ${v.chat.sticker}: "Want first pick? Tap here."`,
      ],
      caption: "(Stories have no caption. Use the text on each frame.)",
      tags: [],
      cta: v.chat.tap,
      why: "Polls are a one-tap action that tells the algorithm people care, and the follow-up frame turns voters into bookings.",
    }),
  },
  {
    kind: "text",
    pillar: "behind",
    effort: "quick",
    build: (v) => ({
      title: `The mistake I made in my first year running ${v.name}`,
      hook: `In my first year running ${v.name}, I made one mistake that almost cost us our best customers.`,
      script: [
        "Line 1: The hook.",
        "Para 2: What you did, honestly. Keep it specific.",
        "Para 3: What happened because of it.",
        "Para 4: What you changed.",
        `Para 5: The lesson for anyone running a ${v.industry} business, or anyone choosing one.`,
        "Close with a question to the reader.",
      ],
      caption: `In my first year running ${v.name}, I made one mistake that almost cost us our best customers.\n\n[What you did.]\n\n[What happened.]\n\n[What you changed.]\n\nThe lesson: [one sentence].\n\nWhat's a mistake that taught you the most in your business?`,
      tags: ["smallbusiness", "founderstory", "lessonslearned"],
      cta: "Ask readers to share their own lesson in the comments",
      why: "Honest founder stories build trust with other business owners and referral partners, and LinkedIn rewards long comments.",
    }),
  },
  {
    kind: "video",
    pillar: "educate",
    effort: "quick",
    build: (v) => ({
      title: `3 mistakes people make with ${v.offer}`,
      hook: `3 mistakes I see every week with ${v.offer}. Number 2 is the most common.`,
      script: [
        "0-2s: Hook to camera, hold up 3 fingers.",
        "2-10s: Mistake 1 + the fix, one sentence each.",
        "10-18s: Mistake 2 (the common one) + the fix.",
        "18-26s: Mistake 3 + the fix.",
        `26-30s: "Not sure if you're making one? Ask us."`,
      ],
      caption: `Most of these are easy to fix once you know. Which one have you been making? Be honest.\n\nSave this for later.`,
      tags: ["commonmistakes", "protips"],
      cta: "Comment which mistake you've made",
      why: "Numbered lists keep people watching to the end, and 'which one have you made' gets comments.",
    }),
  },
  {
    kind: "video",
    pillar: "local",
    effort: "half-day",
    build: (v) => ({
      title: `Plan your ${v.offer} around ${v.moment}`,
      hook: `${v.moment} is coming. Here's how to plan your ${v.offer} around it.`,
      script: [
        "0-3s: Hook with a calendar or seasonal visual.",
        "3-12s: Why timing matters for this (busy periods, recovery or lead time, bookings filling up).",
        "12-22s: The ideal timeline: when to book, when to come in.",
        "22-28s: What we're doing for this period (slots, hours, any offer you actually have).",
        `28-30s: "${v.chat.Us} to lock in your date."`,
      ],
      caption: `${v.moment} sneaks up every year. If ${v.offer} is on your list, here's the timeline that works.\n\nSend this to the friend who always leaves it to the last minute.`,
      tags: ["planahead", v.eventsTag],
      cta: `${v.chat.Us} to lock in a date`,
      why: "Seasonal content rides what people are already thinking about and creates natural urgency without discounts.",
    }),
  },
  {
    kind: "carousel",
    pillar: "educate",
    effort: "half-day",
    build: (v) => ({
      title: `${v.industry} jargon, explained in one line each`,
      hook: `${v.industry} words everyone pretends to understand, explained in one line each.`,
      script: [
        "Slide 1: Hook in big text.",
        "Slides 2-7: One term per slide. Term in bold, one-line plain explanation under it.",
        `Pick the terms customers ask about most ${v.chat.on}.`,
        `Last slide: "Still confused? Ask us anything."`,
      ],
      caption: `Save this before your next appointment so you know what everyone's talking about.\n\nWhich word confused you the most? Tell us and we'll add it to part 2.`,
      tags: ["explained", "learnsomething"],
      cta: "Comment a word you want explained in part 2",
      why: "Jargon busters are highly saveable, and the comment prompt gives you the next post.",
    }),
  },
  {
    kind: "video",
    pillar: "proof",
    effort: "quick",
    build: (v) => ({
      title: "Answer a real question from your DMs",
      hook: `Someone asked us: "Is ${v.offer} worth it?" Here's our honest answer.`,
      script: [
        "0-2s: Screenshot of the question (name removed) as a green-screen background. Say the hook.",
        "2-15s: Honest answer, including who it's not right for.",
        "15-22s: What to do next if it is right for them.",
        `22-25s: "Send us your question. We answer every one."`,
      ],
      caption: `We get this question a lot, so here's the honest answer. It's not right for everyone, and that's fine.\n\nGot a question? DM us and we might answer it in a video.`,
      tags: ["askus", "honestanswers"],
      cta: "DM us your question",
      why: "Answering real questions shows you listen, and every answer is reusable on every platform and your FAQ page.",
    }),
  },
  {
    kind: "video",
    pillar: "behind",
    effort: "quick",
    build: (v) => ({
      title: `Before we open at ${v.name}`,
      hook: `Before we open at ${v.name}. Nobody sees this part.`,
      script: [
        "0-2s: Lights switching on or the door opening. Hook on screen.",
        "2-12s: Quick cuts of set-up: cleaning, prepping, checking the day's bookings (hide names).",
        "12-18s: Team chat or coffee moment.",
        "18-20s: Doors open. Text: 'Ready for you.'",
        "Use a calm trending sound. No talking needed.",
      ],
      caption: `The part nobody sees. Every morning, every day.\n\nWhat do you want to see behind the scenes next?`,
      tags: ["dayinthelife", "behindthescenes"],
      cta: "Comment what you want to see next",
      why: "Calm routine videos are easy to film, oddly watchable, and show care without you having to say it.",
    }),
  },
  {
    kind: "video",
    pillar: "offer",
    effort: "quick",
    build: (v) => ({
      title: `Who ${v.offer} is for (and who it isn't for)`,
      hook: `Don't book ${v.offer} if this is you.`,
      script: [
        "0-2s: Hook to camera, serious face.",
        "2-12s: 2 types of people it's NOT right for, and what they should do instead.",
        "12-22s: 2 types of people it IS right for.",
        `22-27s: "If that's you, ${v.chat.us} and we'll check together."`,
      ],
      caption: `We'd rather say no than sell you something that isn't right for you.\n\nNot sure which side you're on? Ask us.`,
      tags: ["isitforyou", "honestadvice"],
      cta: `${v.chat.Us} to check if it suits you`,
      why: "Telling people who should NOT buy is a scroll-stopper and builds trust with the people who should.",
    }),
  },
  {
    kind: "live",
    pillar: "educate",
    effort: "half-day",
    build: (v) => ({
      title: `Live Q&A: ask anything about ${v.offer}`,
      hook: `Ask me anything about ${v.offer}, live. Questions in the comments.`,
      script: [
        "3 days before: post a Story with a question sticker to collect questions.",
        "Live (20-30 min): intro (1 min), answer the collected questions, then live comments.",
        `Pin a comment with your ${v.chat.sticker} link during the Live.`,
        "After: save the replay and cut the 3 best answers into short clips.",
      ],
      caption: `Going live to answer your questions about ${v.offer}. Drop your question below and we'll get to as many as we can.`,
      tags: ["liveqna", "askmeanything"],
      cta: "Drop your question in the comments",
      why: "A Live gives you 3 or more short clips for later and puts followers face to face with you.",
    }),
  },
  {
    kind: "video",
    pillar: "local",
    effort: "quick",
    build: (v) => ({
      title: `Reacting to ${v.industry} advice going around online`,
      hook: `Is this ${v.industry} advice going around online actually right? Let's check.`,
      script: [
        "0-2s: Stitch or green-screen a popular piece of advice (credit the creator). Say the hook.",
        "2-12s: What's right about it.",
        `12-22s: What's missing or wrong for people in ${v.country}.`,
        `22-26s: "Ask us before you try it."`,
      ],
      caption: `Not all advice online fits everyone. Here's our take as ${an(v.industry)} in ${v.loc}.\n\nWhat advice should we check next?`,
      tags: ["stitch", "factcheck"],
      cta: "Comment the next piece of advice to check",
      why: "Reacting to content people have already seen borrows its reach, and correcting it shows expertise.",
    }),
  },
];

function an(word: string): string {
  return (/^[aeiou]/i.test(word) ? "an " : "a ") + word;
}

function joinAnd(list: string[]): string {
  return list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

function slug(s: string): string {
  return s.replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
}

function splitList(s: string): string[] {
  return s
    .split(/[,;:\n/]|\band\b/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// Country hashtags for markets other than Singapore.
const COUNTRY_TAGS: Partial<Record<MarketCode, string[]>> = {
  MY: ["malaysia"],
  ID: ["indonesia"],
  PH: ["philippines"],
  HK: ["hongkong"],
  AU: ["australia"],
  NZ: ["newzealand", "nz"],
  GB: ["uk"],
  US: ["usa"],
  AE: ["uae"],
};

function baseTags(ws: WorkspaceRow, niche: string, loc: string, m: Market): string[] {
  const sg = m.code === "SG";
  const area = loc.split(",")[0].trim();
  const nicheWords = [...new Set([...splitList(ws.industry), ...splitList(ws.offers), ...splitList(niche)].map(slug).filter((w) => w.length > 2 && w.length < 25))].slice(0, 2);
  if (sg) {
    const local = ["singapore", "sg"];
    if (area && !/singapore/i.test(area)) local.push(slug(area));
    const nicheTags = nicheWords.flatMap((w) => [w, `${w}sg`, `${w}singapore`]);
    return [...local, ...nicheTags, slug(ws.name)].filter((t) => t.length > 1);
  }
  const country = COUNTRY_TAGS[m.code] ?? [];
  const local = [...new Set([slug(area), ...country])].filter(Boolean);
  const place = slug(area) || country[0] || "";
  const nicheTags = nicheWords.flatMap((w) => (place ? [w, `${w}${place}`] : [w]));
  return [...local, ...nicheTags, slug(ws.name)].filter((t) => t.length > 1);
}

function pillarsFor(goal: Goal, regulated: boolean, m: Market): { key: PillarKey; name: string; percent: number; description: string }[] {
  const P: Record<PillarKey, { name: string; description: string }> = {
    educate: { name: "Answer the questions", description: "Myths, prices, mistakes and the questions customers ask before booking." },
    behind: { name: "Behind the scenes", description: "Your people, your space and how you work. Builds familiarity." },
    proof: regulated
      ? { name: "Standards and process", description: "How you keep customers safe and what they can expect. No testimonials or before/afters." }
      : { name: "Proof", description: "Customer stories (with permission), real questions answered, results explained honestly." },
    offer: { name: "Book with us", description: "Clear, low-pressure posts that tell people how to book and why now." },
    local: { name: "Local and timely", description: `Trends, seasonal moments and ${m.code === "SG" ? "Singapore-relatable" : "locally relatable"} content that reaches new people.` },
  };
  const mix: Record<Goal, [PillarKey, number][]> = {
    enquiries: [["educate", 35], ["proof", 25], ["behind", 20], ["offer", 20]],
    followers: [["local", 35], ["educate", 30], ["behind", 25], ["offer", 10]],
    trust: [["educate", 35], ["behind", 30], ["proof", 25], ["offer", 10]],
    launch: [["offer", 35], ["educate", 25], ["behind", 25], ["local", 15]],
  };
  return mix[goal].map(([key, percent]) => ({ key, percent, ...P[key] }));
}

/** The business's own place for sample copy: profile location first, else the country. */
function homePlace(ws: WorkspaceRow, m: Market): string {
  const fallback = m.code === "SG" ? "Singapore" : m.code === "INTL" ? "your area" : m.inPhrase;
  return (ws.location || fallback).split(",")[0].trim() || fallback;
}

function vars(input: ContentInput, ws: WorkspaceRow, now: Date, m: Market): Vars {
  const offers = splitList(ws.offers);
  const nicheParts = splitList(input.niche);
  const nicheOffer = nicheParts.find((p) => p.toLowerCase() !== ws.industry.toLowerCase());
  const offer = offers[0] || nicheOffer || (ws.industry ? `${ws.industry.toLowerCase()} services` : "our services");
  const loc = homePlace(ws, m);
  const moments = seasonalMoments(now, m, ws.location).moments;
  // Prefer next month's moment for planning content (gives lead time).
  const nextMonth = MONTHS[(now.getMonth() + 1) % 12];
  const notSale = (m: string) => !/sale|black friday/i.test(m);
  const moment = (moments.find((m) => m.startsWith(nextMonth) && notSale(m)) || moments.find(notSale) || moments[0])
    .replace(/^[A-Za-z]+: /, "")
    .replace(/\s*\(.*\)$/, "");
  return {
    name: ws.name,
    industry: (ws.industry || nicheParts[0] || "business").toLowerCase(),
    offer,
    offer2: offers[1] || offer,
    loc,
    audience: ws.audience || "customers",
    regulated: Boolean(ws.regulated),
    moment,
    month: MONTHS[now.getMonth()],
    country: m.code === "INTL" ? "your area" : m.inPhrase,
    chat: chatFor(m),
    eventsTag: m.code === "SG" ? "sgevents" : `${COUNTRY_TAGS[m.code]?.[0] ?? "local"}events`,
    market: m,
  };
}

function toIdea(t: Template, platform: Platform, v: Vars, input: ContentInput, ws: WorkspaceRow, pillarName: (k: PillarKey) => string): Idea {
  const b = t.build(v);
  const tags = t.kind === "story" ? [] : cleanHashtags([...b.tags, ...baseTags(ws, input.niche, ws.location, v.market)]);
  return {
    title: b.title,
    platform,
    format: formatLabel(t.kind, platform),
    pillar: pillarName(t.pillar),
    hook: b.hook,
    script_or_outline: b.script,
    caption: b.caption,
    hashtags: platform === "LinkedIn" ? tags.slice(0, 5) : tags,
    cta: b.cta,
    why_it_works: b.why,
    effort: t.effort,
    compliance_note: v.regulated ? regulatedNote(v.market) : "",
  };
}

/** Pick templates for the selected platforms, rotating platforms so each gets a fair share. */
function chooseIdeas(input: ContentInput, ws: WorkspaceRow, v: Vars, pillarName: (k: PillarKey) => string, count: number): Idea[] {
  const plats = input.platforms;
  const avoid = input.avoid.toLowerCase();
  const ideas: Idea[] = [];
  let turn = 0;
  for (const t of TEMPLATES) {
    if (ideas.length >= count) break;
    const title = t.build(v).title.toLowerCase();
    if (avoid && avoid.split(/[,;\n]/).some((w) => w.trim().length > 3 && title.includes(w.trim()))) continue;
    let chosen: Platform | null = null;
    for (let k = 0; k < plats.length; k++) {
      const p = plats[(turn + k) % plats.length];
      if (SUPPORTS[p].includes(t.kind)) {
        chosen = p;
        turn = (turn + k + 1) % plats.length;
        break;
      }
    }
    if (chosen) ideas.push(toIdea(t, chosen, v, input, ws, pillarName));
  }
  return ideas;
}

function variationsOf(base: Idea, input: ContentInput, ws: WorkspaceRow, v: Vars, count: number): Idea[] {
  const video = input.platforms.find((p) => SUPPORTS[p].includes("video")) || input.platforms[0];
  const carousel = input.platforms.find((p) => SUPPORTS[p].includes("carousel")) || video;
  const story = input.platforms.find((p) => SUPPORTS[p].includes("story")) || video;
  const live = input.platforms.find((p) => SUPPORTS[p].includes("live")) || video;
  const tags = cleanHashtags([...base.hashtags, ...baseTags(ws, input.niche, ws.location, v.market)]);
  const note = v.regulated ? regulatedNote(v.market) : "";
  const angles: Idea[] = [
    {
      ...base,
      title: `${base.title}: the 15-second version`,
      platform: video,
      format: formatLabel("video", video),
      hook: `${base.hook.replace(/\.$/, "")}. In 15 seconds.`,
      script_or_outline: ["0-2s: Hook on screen and spoken.", "2-12s: Only the single most useful point from the original idea.", "12-15s: CTA on screen."],
      caption: `Short version for anyone in a hurry. Full answer on our page.\n\n${base.cta}.`,
      hashtags: tags,
      effort: "quick",
      why_it_works: "A shorter cut of an idea that already landed gets a second shot at the feed with almost no extra filming.",
      compliance_note: note,
    },
    {
      ...base,
      title: `${base.title}: as a carousel`,
      platform: carousel,
      format: formatLabel("carousel", carousel),
      script_or_outline: ["Slide 1: The hook in big text.", ...base.script_or_outline.slice(1, 5).map((s, i) => `Slide ${i + 2}: ${s.replace(/^[^:]*:\s*/, "")}`), "Last slide: The CTA and your handle."],
      hashtags: tags,
      effort: "half-day",
      why_it_works: "Turning a video into slides reaches people who scroll with sound off and gets saved for later.",
      compliance_note: note,
    },
    {
      ...base,
      title: `${base.title}: reply to a comment`,
      platform: video,
      format: formatLabel("video", video),
      hook: `You asked about this, so here's part 2.`,
      script_or_outline: ["0-2s: Use the 'reply to comment' feature with a real comment from the original post.", "2-20s: Answer that comment directly.", "20-25s: Ask for the next question."],
      caption: `Part 2, because you asked. Keep the questions coming.`,
      hashtags: tags,
      effort: "quick",
      why_it_works: "Comment replies show the platform and your audience that you listen, and they start a series people follow.",
      compliance_note: note,
    },
    {
      ...base,
      title: `${base.title}: Story poll follow-up`,
      platform: story,
      format: formatLabel(SUPPORTS[story].includes("story") ? "story" : "video", story),
      hook: `Did you know this before today? Yes / No`,
      script_or_outline: ["Frame 1: Poll sticker with the hook.", "Frame 2: Share the original post.", `Frame 3: Link sticker to ${v.chat.sticker}.`],
      caption: "(Stories have no caption. Use the text on each frame.)",
      hashtags: [],
      effort: "quick",
      why_it_works: "A poll sends followers back to the original post and gives you a one-tap engagement signal.",
      compliance_note: note,
    },
    {
      ...base,
      title: `${base.title}: the opposite angle`,
      platform: video,
      format: formatLabel("video", video),
      hook: `Everyone talks about this. Nobody talks about the other side.`,
      script_or_outline: ["0-2s: Hook to camera.", "2-15s: The common view, in one sentence, then the side people miss.", "15-25s: What that means for the viewer.", "25-28s: CTA."],
      hashtags: tags,
      effort: "quick",
      why_it_works: "A contrarian follow-up to a post that worked keeps the topic going with a fresh hook.",
      compliance_note: note,
    },
    {
      ...base,
      title: `${base.title}: live Q&A`,
      platform: live,
      format: formatLabel(SUPPORTS[live].includes("live") ? "live" : "video", live),
      hook: `Going live to go deeper on this. Bring your questions.`,
      script_or_outline: ["Collect questions with a Story question sticker 2 days before.", "Live for 20 minutes: answer them in order.", "Clip the best 3 answers afterwards."],
      caption: `Going live on this topic. Drop your questions below.`,
      hashtags: tags,
      effort: "half-day",
      why_it_works: "A Live turns one popular topic into several short clips for the following weeks.",
      compliance_note: note,
    },
  ];
  return angles.slice(0, count);
}

function buildCalendar(ideas: Idea[], perWeek: number): CalendarSlot[] {
  const days = postingDays(perWeek);
  const out: CalendarSlot[] = [];
  let i = 0;
  // Stories and Lives are extras, so the calendar prefers feed posts but falls back to anything.
  const feed = ideas.filter((x) => !/story/i.test(x.format));
  const pool = feed.length ? feed : ideas;
  for (const week of [1, 2]) {
    for (const d of days) {
      const idea = pool[i % pool.length];
      out.push({ day: `Week ${week} ${d}`, idea_title: idea.title, platform: idea.platform });
      i++;
    }
  }
  return out;
}

/** The bio link prescription, worded for how customers in this market message a business. */
function bioLink(ws: WorkspaceRow, m: Market): Pick<Prescription, "title" | "steps"> {
  const line1 = `Line 1: what you do and where, e.g. "${ws.industry || "Your service"} in ${homePlace(ws, m)}".`;
  const line2 = "Line 2: one reason to choose you (a fact, not a superlative).";
  switch (m.messaging) {
    case "SMS":
      return {
        title: "Put a booking link and one clear line in your bio",
        steps: [line1, line2, "Line 3: \"Book online or call\" and point to the link.", "Set the link to your online booking page, and add your phone number as a contact button (Edit profile > Contact options) so people can call or text in one tap."],
      };
    case "Messenger":
      return {
        title: "Put a Messenger booking link and one clear line in your bio",
        steps: [line1, line2, "Line 3: \"Message us to book\" and point to the link.", "Set the link to https://m.me/ followed by your Facebook Page username."],
      };
    case "LINE":
      return {
        title: "Put a LINE booking link and one clear line in your bio",
        steps: [line1, line2, "Line 3: \"Message us on LINE to book\" and point to the link.", "Set the link to your LINE Official Account link from LINE Official Account Manager."],
      };
    default:
      return {
        title: "Put a WhatsApp booking link and one clear line in your bio",
        steps: [
          line1,
          line2,
          "Line 3: \"WhatsApp to book\" and point to the link.",
          m.code === "SG"
            ? "Set the link to https://wa.me/65XXXXXXXX?text=Hi%2C%20I%20saw%20your%20post (your number, no + or spaces)."
            : "Set the link to https://wa.me/<your number with country code>?text=Hi%2C%20I%20saw%20your%20post (no + or spaces).",
        ],
      };
  }
}

function demoPrescriptions(input: ContentInput, ws: WorkspaceRow, m: Market): Prescription[] {
  const out: Prescription[] = [
    {
      title: `Batch film ${Math.min(4, input.per_week + 1)} videos in one sitting every week`,
      diagnosis: "Filming one post at a time is the main reason small businesses stop posting. One weekly session keeps you consistent on busy weeks.",
      steps: [
        "Block 90 minutes on the same day each week (a quiet morning works best).",
        "Pick the ideas from this plan and write each hook on a sticky note.",
        "Film all of them in one go: same outfit is fine, change the angle or background between videos.",
        "Edit and schedule them in the platform's own scheduler (Meta Business Suite for Instagram and Facebook, TikTok's web scheduler).",
      ],
      where: "Your calendar, then Meta Business Suite > Planner",
      priority: "high",
      impact: "high",
      effort: "half-day",
      category: "Social content",
      recheck_days: 14,
    },
    {
      ...bioLink(ws, m),
      diagnosis: "Content only brings enquiries if the next step is obvious. Your bio should say what you do, where, and how to book in one tap.",
      where: "Instagram > Profile > Edit profile (and TikTok > Edit profile)",
      priority: "urgent",
      impact: "high",
      effort: "quick",
      category: "Social content",
      recheck_days: 7,
    },
    {
      title: "Reply to every comment within the first hour after posting",
      diagnosis: "Early replies keep the conversation going and tell the platform the post is worth showing to more people.",
      steps: [
        "Post when you can stay on your phone for 30 to 60 minutes afterwards.",
        "Reply to every comment with more than a thank you: ask a follow-up question.",
        "Turn the best question into your next video using the 'reply to comment' feature.",
      ],
      where: "Instagram / TikTok notifications",
      priority: "medium",
      impact: "medium",
      effort: "quick",
      category: "Social content",
      recheck_days: 14,
    },
    {
      title: "Pin your 3 most useful posts to the top of your profile",
      diagnosis: "New visitors decide in seconds whether to follow or message. Pinned posts should answer who you are, what you do and how to book.",
      steps: [
        "Pick one post that explains what you do, one that answers a common question, and one booking post.",
        "On each post tap the three dots > Pin to your profile.",
        "Swap them every month or two as better posts come in.",
      ],
      where: "Instagram > post > ... > Pin to your profile",
      priority: "medium",
      impact: "medium",
      effort: "quick",
      category: "Social content",
      recheck_days: 30,
    },
  ];
  if (input.platforms.includes("Instagram"))
    out.push({
      title: "Test hooks with Instagram Trial Reels before posting to followers",
      diagnosis: "Trial Reels are shown to non-followers first, so you can test a new hook or format without it affecting your main grid.",
      steps: [
        "When sharing a Reel, turn on 'Trial' in the share settings (if your account has the option).",
        "Post two versions of the same idea with different hooks a few days apart.",
        "Check the views and shares in each Reel's insights, and share the stronger one to your followers.",
      ],
      where: "Instagram > New Reel > Share screen > Trial",
      priority: "low",
      impact: "medium",
      effort: "quick",
      category: "Social content",
      recheck_days: 21,
    });
  return out;
}

export function contentDemo(input: ContentInput, ws: WorkspaceRow, now = new Date()): ContentResult {
  const m = marketFor(ws.country);
  const v = vars(input, ws, now, m);
  const pillars = pillarsFor(input.goal, Boolean(ws.regulated), m);
  const fallback: Record<PillarKey, PillarKey> = { educate: "educate", behind: "behind", proof: "educate", offer: "educate", local: "behind" };
  const pillarName = (k: PillarKey) => (pillars.find((p) => p.key === k) ?? pillars.find((p) => p.key === fallback[k]) ?? pillars[0]).name;

  let ideas: Idea[];
  let title: string;
  if (input.more_like) {
    const all = chooseIdeas({ ...input, avoid: "" }, ws, v, pillarName, TEMPLATES.length);
    const base =
      all.find((i) => i.title.toLowerCase() === input.more_like.toLowerCase()) ??
      ({
        ...all[0],
        title: input.more_like,
        hook: input.more_like,
        caption: `${input.more_like}\n\n[Write 2 or 3 lines about this, then your call to action.]`,
      } as Idea);
    ideas = variationsOf(base, input, ws, v, Math.min(input.count, 6));
    title = `More like: ${input.more_like}`;
  } else {
    ideas = chooseIdeas(input, ws, v, pillarName, input.count);
    title = `Content plan: ${ideas.length} ideas for ${input.platforms.join(", ")}`;
  }

  // Templates write one line per beat; split them into film / say / on-screen like a live report.
  ideas = ideas.map((i) =>
    /text post|thread/i.test(i.format) ? i : { ...i, beats: i.beats ?? beatsFromLines(i.script_or_outline), shoot_style: i.shoot_style ?? defaultShootStyle(i.format, i.platform) },
  );

  const lang = input.language && !/^english$/i.test(input.language.trim()) ? ` Sample captions are in English; the live AI writes them in your language mix (${input.language}).` : "";
  return {
    title,
    score: null,
    summary: input.more_like
      ? `This is sample output. Here are ${ideas.length} variations on "${input.more_like}" for ${ws.name}, each a different angle or format so you can keep a winning topic going.${lang}`
      : `This is sample output. Here are ${ideas.length} ready-to-film ideas for ${ws.name} across ${joinAnd(input.platforms)}, built around 4 content pillars for the goal "${GOALS[input.goal].toLowerCase()}", plus a 2-week calendar at ${input.per_week} post${input.per_week === 1 ? "" : "s"} a week. Trend research needs the live AI, so this plan uses evergreen formats.${lang}`,
    platforms: input.platforms,
    goal: GOALS[input.goal],
    more_like: input.more_like,
    trends: [],
    trends_note: input.trends
      ? `Trend research needs the live AI. With it switched on, Social Media Content searches for this month's formats, sounds and ${m.code === "SG" ? "Singapore" : "local"} calendar moments for your niche.`
      : "",
    pillars: pillars.map(({ name, percent, description }) => ({ name, percent, description })),
    ideas,
    calendar: buildCalendar(ideas, input.per_week),
    sources: [],
    prescriptions: input.more_like ? demoPrescriptions(input, ws, m).slice(0, 2) : demoPrescriptions(input, ws, m),
    demo: true,
  };
}
