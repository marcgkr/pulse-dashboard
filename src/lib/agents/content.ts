import { z } from "zod";
import { businessContext, normalizePrescription, pick, PrescriptionSchema, research, structured } from "../ai";
import type { AgentDef } from "./types";
import {
  cleanHashtags,
  contentDemo,
  GOALS,
  matchGoal,
  matchPlatform,
  PLATFORMS,
  postingDays,
  regulatedNote,
  seasonalMoments,
  type CalendarSlot,
  type ContentInput,
  type ContentResult,
  type Idea,
  type Pillar,
  type Platform,
  type Trend,
} from "./content-demo";
import { marketFor, type Market } from "../markets";
import { searchCountryFor } from "./keywords-demo";
import { parseSocialLink, type Reference } from "../social-links";
import { beatsFromLines } from "../script-beats";

type Input = ContentInput;

const RefAI = z.object({
  url: z.string().describe("Full link to the post exactly as it appears in the research notes. Never build or guess a link."),
  creator: z.string().describe("Account name as shown, e.g. @handle"),
  platform: z.string().describe("Platform of the post"),
  views: z.string().describe("View count exactly as the research notes give it, e.g. '7,860,584 views'. Empty string if the notes don't give one."),
  posted: z.string().describe("When it was posted, exactly as the research notes give it, e.g. '18 days ago' or '21 Sep 2026'. Empty string if not given."),
  borrow: z.string().describe("1-2 sentences: what this business should borrow from the post (structure, opening, format, pacing) and what to leave out. Never copy its wording."),
});

const ContentAI = z.object({
  summary: z.string().describe("2-4 sentences for the owner: what this plan focuses on and why, and the one thing to start with this week."),
  trends: z
    .array(
      z.object({
        name: z.string().describe("Short name of the trend, format, sound or moment"),
        what_it_is: z.string().describe("1-2 sentences describing it, based only on the research notes"),
        how_to_use_it: z.string().describe("1-2 sentences on how this specific business can use it"),
        platform: z.string().describe("Platform where it is happening, from the owner's chosen platforms"),
        shelf_life: z.string().describe("Exactly one of: this week, this month, evergreen"),
        examples: z.array(RefAI).describe("0-3 example posts from the research notes that show this trend. Empty if the notes name none."),
      }),
    )
    .describe("4-8 trends from the research notes. Empty array if no research notes were given."),
  pillars: z
    .array(
      z.object({
        name: z.string().describe("Short pillar name, 2-4 words"),
        percent: z.number().describe("Share of posts, whole number. All pillars add up to 100."),
        description: z.string().describe("One sentence: what goes in this pillar for this business"),
      }),
    )
    .describe("3-4 content pillars"),
  ideas: z.array(
    z.object({
      title: z.string().describe("Short working title for the idea, unique within the plan"),
      platform: z.string().describe("Exactly one of the owner's chosen platforms"),
      format: z.string().describe("e.g. Reel, TikTok video, Short, Carousel, Document carousel, Image note, Static post, Story, Live, Text post, Thread"),
      pillar: z.string().describe("Name of one of the pillars above, exactly as written"),
      hook: z.string().describe("The first 2 seconds of the video or the first line of the post, written out word for word"),
      script_or_outline: z
        .array(z.string())
        .describe("Text posts only: paragraph by paragraph, 3-8 steps. For video and carousels give an empty array and use beats instead."),
      beats: z
        .array(
          z.object({
            time: z.string().describe("Video: timing like '0-2s'. Carousel: 'Slide 1'. Story: 'Frame 1'."),
            shot: z.string().describe("Exactly what to film or show: framing, action, location, b-roll. Empty string if nothing new is shown."),
            say: z.string().describe("The exact words spoken in this beat, word for word, in the caption language. Empty string if nothing is said."),
            on_screen: z.string().describe("The exact text on screen or on the slide. Empty string if none."),
          }),
        )
        .describe("Video and carousel posts: the full script beat by beat, 3-10 beats, covering the whole post from the hook to the call to action. Empty array for text posts."),
      shoot_style: z
        .object({
          format: z.string().describe("Aspect ratio and length, e.g. 'Vertical 9:16, 30-40 seconds' or '4:5 carousel, 7 slides'"),
          setting: z.string().describe("Where to film or what the background is, specific to this business"),
          camera: z.string().describe("Camera set-up and framing, e.g. 'Phone on tripod at eye level, mid shot; handheld for b-roll'"),
          people: z.string().describe("Who appears and how they come across"),
          sound: z.string().describe("Voice, mic and any music or trending sound"),
          editing: z.string().describe("Pacing, captions, text style, transitions"),
        })
        .describe("How to shoot or design it"),
      caption: z.string().describe("Ready-to-paste caption in the platform's native style and the owner's language mix. No hashtags in the caption."),
      hashtags: z.array(z.string()).describe("8-15 hashtags (3-5 for LinkedIn): mix of local tags (the business's own city, area or country) and niche tags. No banned, spammy or overly broad tags like #fyp or #followforfollow."),
      cta: z.string().describe("The single call to action"),
      why_it_works: z.string().describe("1-2 sentences on why this works for this business and goal"),
      effort: z.string().describe("Exactly one of: quick, half-day, project"),
      compliance_note: z.string().describe("Empty string unless the business is in a regulated category; then what to avoid or check for this idea"),
      trend_basis: z
        .string()
        .describe("2-3 sentences: which trend or example post from the research notes this idea borrows from and why it fits this business now. Only numbers that appear in the notes. Empty string for evergreen ideas or when there are no research notes."),
      references: z.array(RefAI).describe("0-2 example posts from the research notes this idea borrows from. Empty if none fit."),
    }),
  ),
  calendar: z
    .array(
      z.object({
        day: z.string().describe("Like 'Week 1 Tue'"),
        idea_title: z.string().describe("Exact title of one of the ideas"),
        platform: z.string().describe("Platform for this slot"),
      }),
    )
    .describe("2-week posting calendar"),
  prescriptions: z.array(PrescriptionSchema).describe("Habit and process fixes for the owner's social media"),
});

function parseCount(v: unknown): 6 | 10 | 14 {
  const n = Number(v);
  return n === 6 || n === 14 ? n : 10;
}

function str(v: unknown, max = 800): string {
  return String(v ?? "").trim().slice(0, max);
}

const SHELF = ["this week", "this month", "evergreen"] as const;

/**
 * Keeps only example posts the research actually found: the link must be a post on a social
 * platform and appear in the search results or notes. Views and dates are dropped unless the
 * same figure appears in the notes, so the report never shows a number the model made up.
 */
export function cleanReferences(refs: z.infer<typeof RefAI>[], research: { notes: string; urls: Set<string> }, max: number): Reference[] {
  const notes = research.notes.toLowerCase();
  // The figure itself, without thousands separators: "7,860,584 views" -> "7860584", "1.2M views" -> "1.2m".
  const figure = (v: string) => /\d[\d,.]*\s?[kmb]?\b/i.exec(v)?.[0].replace(/[,\s]/g, "").toLowerCase() ?? "";
  const notesFlat = notes.replace(/(\d),(?=\d)/g, "$1").replace(/(\d)\s([kmb])\b/g, "$1$2");
  const seen = new Set<string>();
  const out: Reference[] = [];
  for (const r of refs) {
    const link = parseSocialLink(r.url.trim());
    if (!link) continue;
    const url = link.url;
    const found = research.urls.has(url) || research.urls.has(r.url.trim()) || notes.includes(r.url.trim().toLowerCase());
    if (!found || seen.has(url)) continue;
    seen.add(url);
    const views = r.views.trim();
    const posted = r.posted.trim();
    const fig = figure(views);
    out.push({
      platform: link.platform,
      url,
      creator: r.creator.trim().slice(0, 80) || link.platform,
      views: fig && new RegExp(`(^|[^\\d.])${fig.replace(/\./g, "\\.")}(?![\\d.])`).test(notesFlat) ? views.slice(0, 40) : null,
      posted: posted && !/not shown/i.test(posted) && notes.includes(posted.toLowerCase()) ? posted.slice(0, 40) : null,
      borrow: r.borrow.trim().slice(0, 500),
    });
    if (out.length >= max) break;
  }
  return out;
}

function normaliseResult(ai: z.infer<typeof ContentAI>, input: Input, regulated: boolean, m: Market, research: { notes: string; urls: Set<string> }) {
  const chosen = input.platforms;
  const toPlatform = (p: unknown): string => {
    const m = matchPlatform(p);
    return m && chosen.includes(m) ? m : (m ?? chosen[0]);
  };

  // Pillars: round, then make them add to 100.
  let pillars: Pillar[] = ai.pillars
    .slice(0, 4)
    .map((p) => ({ name: p.name.trim(), percent: Math.max(0, Math.round(Number(p.percent) || 0)), description: p.description.trim() }));
  const total = pillars.reduce((a, p) => a + p.percent, 0);
  if (pillars.length) {
    if (total <= 0) pillars = pillars.map((p) => ({ ...p, percent: Math.round(100 / pillars.length) }));
    else if (total !== 100) pillars = pillars.map((p) => ({ ...p, percent: Math.round((p.percent / total) * 100) }));
    const diff = 100 - pillars.reduce((a, p) => a + p.percent, 0);
    pillars[0].percent += diff;
  }

  const ideas: Idea[] = ai.ideas.map((i) => {
    const platform = toPlatform(i.platform);
    const tags = cleanHashtags(i.hashtags);
    const note = i.compliance_note.trim();
    return {
      title: i.title.trim(),
      platform,
      format: i.format.trim(),
      pillar: i.pillar.trim(),
      hook: i.hook.trim(),
      script_or_outline: i.script_or_outline.map((s) => s.trim()).filter(Boolean),
      beats: (i.beats.length ? i.beats : beatsFromLines(i.script_or_outline))
        .map((b) => ({ time: b.time.trim().slice(0, 30), shot: b.shot.trim(), say: b.say.trim(), on_screen: b.on_screen.trim() }))
        .filter((b) => b.shot || b.say || b.on_screen)
        .slice(0, 12),
      shoot_style: i.shoot_style,
      caption: i.caption.trim(),
      hashtags: platform === "LinkedIn" ? tags.slice(0, 5) : tags,
      cta: i.cta.trim(),
      why_it_works: i.why_it_works.trim(),
      effort: pick(i.effort, ["quick", "half-day", "project"] as const, "quick"),
      compliance_note: note || (regulated ? regulatedNote(m) : ""),
      trend_basis: input.trends ? i.trend_basis.trim() : "",
      references: input.trends ? cleanReferences(i.references, research, 2) : [],
    };
  });

  const calendar: CalendarSlot[] = ai.calendar
    .map((c) => ({ day: c.day.trim(), idea_title: c.idea_title.trim(), platform: toPlatform(c.platform) }))
    .filter((c) => c.day && c.idea_title)
    .slice(0, input.per_week * 2);

  const trends: Trend[] = input.trends
    ? ai.trends.map((t) => ({
        name: t.name.trim(),
        what_it_is: t.what_it_is.trim(),
        how_to_use_it: t.how_to_use_it.trim(),
        platform: matchPlatform(t.platform) ?? t.platform.trim(),
        shelf_life: pick(t.shelf_life, SHELF, "this month"),
        examples: cleanReferences(t.examples, research, 3),
      }))
    : [];

  return { pillars, ideas, calendar, trends };
}

export const contentAgent: AgentDef<Input> = {
  id: "content",
  name: "Social Media Content",
  blurb: "Ready-to-film social posts for your niche, with hooks, captions and a 2-week calendar.",
  description:
    "Checks what is trending on your platforms this month for your niche in your country, then writes post ideas you can film today: the hook word for word, a shot-by-shot script or slide outline, a caption and hashtags to paste, and a 2-week calendar that fits how often you can post. Regulated businesses get ideas that stay inside the advertising rules.",

  parseInput(raw, ws) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const list = Array.isArray(r.platforms) ? r.platforms : typeof r.platforms === "string" ? r.platforms.split(",") : [];
    const platforms = PLATFORMS.filter((p) => list.some((x) => matchPlatform(x) === p));
    if (r.platforms !== undefined && platforms.length === 0) throw new Error("Pick at least one platform.");
    const niche = str(r.niche, 300) || [ws.industry, ws.offers].filter(Boolean).join(": ").slice(0, 300);
    if (!niche) throw new Error("Tell us your niche or topic focus, or fill in your business profile.");
    const perWeek = Math.min(7, Math.max(1, Math.round(Number(r.per_week) || 3)));
    return {
      platforms: platforms.length ? platforms : (["Instagram", "TikTok"] as Platform[]),
      niche,
      goal: matchGoal(r.goal),
      count: parseCount(r.count),
      per_week: perWeek,
      working: str(r.working),
      avoid: str(r.avoid),
      trends: r.trends === undefined ? true : r.trends === true || r.trends === "true" || r.trends === "on",
      language: str(r.language, 80) || "English",
      more_like: str(r.more_like, 200),
    };
  },

  runTitle: (input) =>
    input.more_like ? `More like: ${input.more_like}`.slice(0, 120) : `Content plan: ${input.count} ideas for ${input.platforms.join(", ")}`,

  async run(input, ctx) {
    const ws = ctx.ws;
    const regulated = Boolean(ws.regulated);
    const today = new Date();
    const m = marketFor(ws.country);
    const location = ws.location || (m.code === "INTL" ? "the owner's area" : m.name);
    const season = seasonalMoments(today, m, ws.location);
    const chat = m.messaging === "SMS" ? "booking or call link" : `${m.messaging} link`;
    const count = input.more_like ? Math.min(input.count, 6) : input.count;

    let notes = "";
    let sources: { title: string; url: string }[] = [];
    if (input.trends) {
      ctx.progress(`Checking what's trending on ${input.platforms.join(", ")} this month`);
      const r = await research({
        system:
          `You are a social media trend researcher for small businesses in ${m.code === "INTL" ? "the owner's country" : m.inPhrase}. You search the web for what is working on social platforms right now and write short factual notes. Only report what you found in your searches, with where you saw it. Do not invent view counts, growth percentages or dates.`,
        prompt: `Today is ${today.toDateString()}.

BUSINESS PROFILE
${businessContext(ws)}

NICHE / TOPIC FOCUS: ${input.niche}
PLATFORMS: ${input.platforms.join(", ")}
LOCATION: ${location}

Research what is working on these platforms right now (${season.label}) for this niche in ${location}:
1. Trending formats and content styles in this niche (e.g. POV videos, green-screen replies, photo carousels, "day in the life", Xiaohongshu note styles).
2. Trending sounds, memes or templates that a ${ws.industry || "small"} business could use, and roughly how long they have been going.
3. Seasonal and calendar moments in the next 4-6 weeks that fit this niche. ${m.code === "SG" ? "Singapore moments" : "Moments"} to check: ${season.moments.join("; ")}. Confirm actual dates for any lunar or gazetted holiday.
4. Recent platform features or changes worth using (for example Instagram Trial Reels, TikTok photo mode, LinkedIn document posts, YouTube Shorts features).
${regulated ? `5. Any recent enforcement or guidance on social media advertising for this regulated category in ${m.code === "INTL" ? "the owner's country" : m.inPhrase}.\n` : ""}
${regulated ? "6" : "5"}. Example posts: find 4 to 8 specific recent posts (ideally from the last 60 days) in this niche or a nearby one that show the formats above working, preferring creators in ${location}. For each, give the full link to the post itself (not a profile or search page), the account name, the platform, and the view count and posting date exactly as the page or source shows them. If a number or date isn't shown, write "not shown". Say in one line what makes it work: its structure, opening, format or pacing.

Write bullet-point notes under 1,200 words. For each point say which platform and where you saw it. If you could not confirm something, say so.`,
        maxSearches: input.more_like ? 4 : 8,
        effort: "medium",
        country: searchCountryFor(ws.country, ws.location),
      }).catch((e) => {
        // Trends are a bonus: if web search fails, still write the plan from the profile.
        console.error("[content] trend research failed", e);
        return { text: "Trend research was unavailable for this run. Write evergreen ideas and say trends could not be checked.", sources: [] };
      });
      notes = r.text;
      sources = r.sources;
    }

    ctx.progress(input.more_like ? `Writing variations on "${input.more_like}"` : `Writing ${count} post ideas and your 2-week calendar`);
    const days = postingDays(input.per_week);
    const slots = input.per_week * 2;

    const system = `You are the Social Media Content specialist, a social media strategist for ${m.code === "SG" ? "Singapore small businesses" : m.code === "INTL" ? "small businesses" : `small businesses in ${m.inPhrase}`}. You write ready-to-post content ideas the owner can film or design today: real hooks written out word for word, shot-by-shot scripts or slide-by-slide outlines, captions to paste, hashtags, and a posting calendar.

How you write:
- Every idea must be specific to this business, its offers and its customers. No filler ideas like "share a motivational quote" or "post a holiday greeting".
- Hooks: the exact words for the first 2 seconds (video) or first line (post). Make them stop the scroll: a specific problem, a myth, a question customers ask, a surprising angle.
- Scripts: for video and carousels, write beats: for each beat the timing (or slide number), exactly what to film or show, the exact words to say (word for word, ready to read out) and the exact on-screen text. The spoken lines together must read as a complete script from the hook to the call to action. Text posts use script_or_outline paragraph by paragraph. Keep videos under 45 seconds unless the format needs more.
- Shoot style: the format and length, where to film for this business, camera set-up and framing, who appears, sound, and editing style.
- Captions: native to the platform. TikTok and Reels short, LinkedIn longer and story-led with line breaks, Xiaohongshu as a note with a title line and practical detail, Facebook conversational. Write in the owner's language mix. Keep emojis to a minimum. Never put hashtags inside the caption.
- Hashtags: 8-15 per idea (3-5 for LinkedIn, none for Stories), mixing ${m.code === "SG" ? "Singapore/local" : "local (city, area or country)"} tags with niche tags. No banned, spammy or overly broad tags (#fyp, #foryou, #viral, #followforfollow, #like4like, #instagood).
- Match formats to platforms: YouTube Shorts is video only; Xiaohongshu is image notes or video notes; LinkedIn suits text posts, document carousels and native video.
- Spread ideas across the owner's chosen platforms and across the pillars in roughly the pillar mix.
- Never invent numbers: no view counts, follower counts, engagement rates, prices or results. Use placeholders like [your price] where the owner must fill something in.
- Trends: only use trends that appear in the research notes. If there are no research notes, return an empty trends array and use evergreen formats.
- Example posts (trend examples and idea references): only posts listed in the research notes, with the link copied exactly. Copy views and posting dates exactly as the notes give them, or leave them empty. Borrow the structure, never the wording, product pitch or claims of the original. Give at least half the ideas a trend_basis and a reference when the notes have enough examples.
- Calendar: exactly ${slots} slots, ${input.per_week} per week across 2 weeks, on days like ${days.map((d) => `"Week 1 ${d}"`).join(", ")} (then the same for Week 2). Each slot uses an idea title exactly as written. Ideas can repeat on a different platform if there are more slots than ideas. Put quick ideas early in Week 1 so the owner can start immediately.
- Prescriptions: 3-6 habit or process fixes for how the owner runs their social media (e.g. batch filming on a fixed day, bio and link fixes, ${chat} in bio, using Trial Reels to test hooks, replying to comments in the first hour, pinning posts). Category "Social content". Steps must be exact clicks or copy.${
      regulated
        ? `

REGULATED CATEGORY (${m.code === "SG" ? "Singapore healthcare, legal or financial advertising rules apply" : `healthcare, legal or financial advertising rules apply; for healthcare: ${m.healthAdRules}`}):
- No testimonials, reviews or customer stories presented as endorsements.
- No before/after photos or videos, and no "results" content.
- No superlatives or comparisons ("best", "No.1", "leading", "most trusted", "better than").
- No guarantees or promises of outcomes, no discounts framed to induce treatment.
- Prefer education, process, safety standards, meet-the-team and answering questions.
- Every idea's compliance_note must say what to avoid or check for that idea. Flag anything that needs a professional check.`
        : `
- compliance_note: empty string unless an idea touches something regulated (health claims, financial promises, alcohol, etc.).`
    }`;

    const prompt = `Today is ${today.toDateString()}.

BUSINESS PROFILE
${businessContext(ws)}

PLAN SETTINGS
Platforms: ${input.platforms.join(", ")}
Niche / topic focus: ${input.niche}
Goal: ${GOALS[input.goal]}
Number of ideas: ${count}
Posting capacity: ${input.per_week} posts per week
Language mix for captions: ${input.language}
${input.working ? `What's already working for them: ${input.working}` : ""}
${input.avoid ? `Avoid: ${input.avoid}` : ""}

CALENDAR MOMENTS (this month and next, ${location})
${season.moments.map((m) => `- ${m}`).join("\n")}
Only use a moment if it fits the niche. Do not state a date for a lunar or gazetted holiday unless the research notes confirm it.

${notes ? `TREND RESEARCH NOTES (from web search)\n${notes}` : "TREND RESEARCH: none for this run. Return an empty trends array."}

${
  input.more_like
    ? `TASK: The owner liked this idea from an earlier plan: "${input.more_like}". Write ${count} variations on it: keep the core topic that made it work, but change the hook, angle, format or platform for each one (for example a shorter cut, a carousel version, a reply-to-comment follow-up, the opposite angle, a series part 2). Pillars should describe where these variations fit. Calendar and prescriptions as described.`
    : `TASK: Write ${count} post ideas for the goal "${GOALS[input.goal]}", 3-4 pillars with a % mix, the 2-week calendar, and the prescriptions.${input.working ? " Build on what is already working for them." : ""}`
}`;

    const ai = await structured({ system, prompt, schema: ContentAI, effort: "medium", maxTokens: 32000 });
    const { pillars, ideas, calendar, trends } = normaliseResult(ai, input, regulated, m, { notes, urls: new Set(sources.map((x) => x.url)) });

    const result: ContentResult = {
      title: input.more_like ? `More like: ${input.more_like}` : `Content plan: ${ideas.length} ideas for ${input.platforms.join(", ")}`,
      score: null,
      summary: ai.summary.trim(),
      platforms: input.platforms,
      goal: GOALS[input.goal],
      more_like: input.more_like,
      trends,
      trends_note: input.trends ? (trends.length ? "" : "The trend search did not turn up anything specific enough for your niche this month, so these ideas use evergreen formats.") : "Trend research was switched off for this run.",
      pillars,
      ideas,
      calendar,
      sources,
      prescriptions: ai.prescriptions.slice(0, 6).map(normalizePrescription),
    };
    return result;
  },

  async demo(input, ctx) {
    ctx.progress("Writing sample post ideas");
    return contentDemo(input, ctx.ws);
  },
};
