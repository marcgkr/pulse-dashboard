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
  REGULATED_NOTE,
  seasonalMoments,
  type CalendarSlot,
  type ContentInput,
  type ContentResult,
  type Idea,
  type Pillar,
  type Platform,
  type Trend,
} from "./content-demo";
import { countryCode } from "./keywords-demo";

type Input = ContentInput;

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
        .describe("Shot-by-shot for video (prefix with timing like '0-2s:'), slide-by-slide for carousels ('Slide 1:'), paragraph-by-paragraph for text posts. 3-8 steps."),
      caption: z.string().describe("Ready-to-paste caption in the platform's native style and the owner's language mix. No hashtags in the caption."),
      hashtags: z.array(z.string()).describe("8-15 hashtags (3-5 for LinkedIn): mix of Singapore/local and niche tags. No banned, spammy or overly broad tags like #fyp or #followforfollow."),
      cta: z.string().describe("The single call to action"),
      why_it_works: z.string().describe("1-2 sentences on why this works for this business and goal"),
      effort: z.string().describe("Exactly one of: quick, half-day, project"),
      compliance_note: z.string().describe("Empty string unless the business is in a regulated category; then what to avoid or check for this idea"),
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

function normaliseResult(ai: z.infer<typeof ContentAI>, input: Input, regulated: boolean) {
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
      caption: i.caption.trim(),
      hashtags: platform === "LinkedIn" ? tags.slice(0, 5) : tags,
      cta: i.cta.trim(),
      why_it_works: i.why_it_works.trim(),
      effort: pick(i.effort, ["quick", "half-day", "project"] as const, "quick"),
      compliance_note: note || (regulated ? REGULATED_NOTE : ""),
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
      }))
    : [];

  return { pillars, ideas, calendar, trends };
}

export const contentAgent: AgentDef<Input> = {
  id: "content",
  name: "Content Studio",
  blurb: "Ready-to-film social posts for your niche, with hooks, captions and a 2-week calendar.",
  description:
    "Checks what is trending on your platforms this month for your niche in Singapore, then writes post ideas you can film today: the hook word for word, a shot-by-shot script or slide outline, a caption and hashtags to paste, and a 2-week calendar that fits how often you can post. Regulated businesses get ideas that stay inside the advertising rules.",

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
    const location = ws.location || "Singapore";
    const season = seasonalMoments(today, location);
    const count = input.more_like ? Math.min(input.count, 6) : input.count;

    let notes = "";
    let sources: { title: string; url: string }[] = [];
    if (input.trends) {
      ctx.progress(`Checking what's trending on ${input.platforms.join(", ")} this month`);
      const r = await research({
        system:
          "You are a social media trend researcher for small businesses in Singapore. You search the web for what is working on social platforms right now and write short factual notes. Only report what you found in your searches, with where you saw it. Do not invent view counts, growth percentages or dates.",
        prompt: `Today is ${today.toDateString()}.

BUSINESS PROFILE
${businessContext(ws)}

NICHE / TOPIC FOCUS: ${input.niche}
PLATFORMS: ${input.platforms.join(", ")}
LOCATION: ${location}

Research what is working on these platforms right now (${season.label}) for this niche in ${location}:
1. Trending formats and content styles in this niche (e.g. POV videos, green-screen replies, photo carousels, "day in the life", Xiaohongshu note styles).
2. Trending sounds, memes or templates that a ${ws.industry || "small"} business could use, and roughly how long they have been going.
3. Seasonal and calendar moments in the next 4-6 weeks that fit this niche. Singapore moments to check: ${season.moments.join("; ")}. Confirm actual dates for any lunar or gazetted holiday.
4. Recent platform features or changes worth using (for example Instagram Trial Reels, TikTok photo mode, LinkedIn document posts, YouTube Shorts features).
${regulated ? "5. Any recent enforcement or guidance on social media advertising for this regulated category in Singapore.\n" : ""}
Write bullet-point notes under 900 words. For each point say which platform and where you saw it. If you could not confirm something, say so.`,
        maxSearches: input.more_like ? 3 : 6,
        effort: "medium",
        country: countryCode(location),
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

    const system = `You are Content Studio, a social media strategist for Singapore small businesses. You write ready-to-post content ideas the owner can film or design today: real hooks written out word for word, shot-by-shot scripts or slide-by-slide outlines, captions to paste, hashtags, and a posting calendar.

How you write:
- Every idea must be specific to this business, its offers and its customers. No filler ideas like "share a motivational quote" or "post a holiday greeting".
- Hooks: the exact words for the first 2 seconds (video) or first line (post). Make them stop the scroll: a specific problem, a myth, a question customers ask, a surprising angle.
- Scripts: shot-by-shot with timings for video ("0-2s: ..."), slide-by-slide for carousels ("Slide 1: ..."), paragraph-by-paragraph for text posts. Include on-screen text and what to film. Keep videos under 45 seconds unless the format needs more.
- Captions: native to the platform. TikTok and Reels short, LinkedIn longer and story-led with line breaks, Xiaohongshu as a note with a title line and practical detail, Facebook conversational. Write in the owner's language mix. Keep emojis to a minimum. Never put hashtags inside the caption.
- Hashtags: 8-15 per idea (3-5 for LinkedIn, none for Stories), mixing Singapore/local tags with niche tags. No banned, spammy or overly broad tags (#fyp, #foryou, #viral, #followforfollow, #like4like, #instagood).
- Match formats to platforms: YouTube Shorts is video only; Xiaohongshu is image notes or video notes; LinkedIn suits text posts, document carousels and native video.
- Spread ideas across the owner's chosen platforms and across the pillars in roughly the pillar mix.
- Never invent numbers: no view counts, follower counts, engagement rates, prices or results. Use placeholders like [your price] where the owner must fill something in.
- Trends: only use trends that appear in the research notes. If there are no research notes, return an empty trends array and use evergreen formats.
- Calendar: exactly ${slots} slots, ${input.per_week} per week across 2 weeks, on days like ${days.map((d) => `"Week 1 ${d}"`).join(", ")} (then the same for Week 2). Each slot uses an idea title exactly as written. Ideas can repeat on a different platform if there are more slots than ideas. Put quick ideas early in Week 1 so the owner can start immediately.
- Prescriptions: 3-6 habit or process fixes for how the owner runs their social media (e.g. batch filming on a fixed day, bio and link fixes, WhatsApp link in bio, using Trial Reels to test hooks, replying to comments in the first hour, pinning posts). Category "Social content". Steps must be exact clicks or copy.${
      regulated
        ? `

REGULATED CATEGORY (Singapore healthcare, legal or financial advertising rules apply):
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
    const { pillars, ideas, calendar, trends } = normaliseResult(ai, input, regulated);

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
