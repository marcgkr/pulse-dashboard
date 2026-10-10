import { z } from "zod";
import { businessContext, normalizePrescription, pick, PrescriptionSchema, research, structured } from "../ai";
import type { AgentContext, AgentDef, AgentResult } from "./types";
import { connectedSources, fetchLiveSearchConsole } from "../connectors";
import { marketFor } from "../markets";
import {
  type AeoQuestion,
  type ContentBrief,
  type KeywordCluster,
  type KeywordsInput,
  type ParsedData,
  cleanKeyword,
  dataForPrompt,
  dataQuickWins,
  normalizeSlug,
  parsePastedData,
  sampleBriefs,
  sampleClusters,
  samplePrescriptions,
  searchCountryFor,
  sampleQuestions,
  sampleQuickWins,
  splitSeeds,
  uniqueKeywords,
  visibilityScore,
} from "./keywords-demo";
import { articleRunTitle, demoArticle, parseArticleBrief, writeArticle } from "./article";

type Input = KeywordsInput;

export type KeywordsResult = AgentResult & {
  mode: "discover" | "expand";
  seeds: string[];
  location: string;
  expand: string;
  clusters: KeywordCluster[];
  aeo_questions: AeoQuestion[];
  content_briefs: ContentBrief[];
  quick_wins: string[];
  data: ParsedData | null;
  score_note: string | null;
  /** Where the data table came from when it was read from a connected account, e.g. "Search Console: example.com, last 90 days". */
  data_from?: string | null;
  sources: { title: string; url: string }[];
};

const MAX_DATA_CHARS = 120_000;

// ---------- Structured output schema (loose; normalised below) ----------

const ClusterAI = z.object({
  name: z.string().describe("Short cluster name the owner understands, e.g. 'Hydrafacial prices' or 'Lash extensions in [area]'"),
  intent: z.string().describe("Exactly one of: buy, compare, learn, local"),
  priority: z.string().describe("Exactly one of: high, medium, low. How much this cluster matters for getting enquiries soon"),
  relative_demand: z
    .string()
    .describe("Exactly one of: high, medium, low. Your ESTIMATE of search demand relative to the other clusters. Not a search volume. Use pasted data if given."),
  difficulty: z.string().describe("Exactly one of: easy, medium, hard. Estimate of how hard it is for THIS business to rank, based on who ranks now"),
  keywords: z
    .array(z.string())
    .describe("5-12 keyword phrases written the way people type them, lowercase. The first one is the primary keyword for the target page."),
  target_page: z.object({
    action: z.string().describe("Exactly one of: optimise (an existing page), create (a new page)"),
    page: z.string().describe("Which page: an existing page name, or the title of the new page to create"),
    slug: z.string().describe("Suggested URL path starting with /, lowercase words joined by hyphens, e.g. /hydrafacial-[area]"),
  }),
  why: z.string().describe("1-2 sentences on why this cluster matters for this business. Mention what currently ranks if the research shows it."),
});

const KeywordsAI = z.object({
  summary: z
    .string()
    .describe("2-4 sentences for the owner: the biggest keyword opportunity, what currently ranks, and what to do first. Mention pasted data if given."),
  clusters: z.array(ClusterAI).describe("5-8 keyword clusters, highest priority first. Each cluster maps to exactly one target page; no two clusters target the same page."),
  aeo_questions: z
    .array(
      z.object({
        question: z.string().describe("Full conversational question, the way people ask ChatGPT, Perplexity or Google AI Overviews"),
        answer_angle: z.string().describe("What the answer should say and lead with, in 1-2 sentences. No invented numbers."),
        where_to_answer: z.string().describe("Which page or section should hold the answer, e.g. 'Hydrafacial service page FAQ' or 'New blog post: X vs Y'"),
        format: z.string().describe("Exactly one of: FAQ block, comparison table, how-to steps, definition paragraph, pros and cons list, price table"),
      }),
    )
    .describe("6-10 questions people ask AI assistants in this market, most valuable first"),
  content_briefs: z
    .array(
      z.object({
        title: z.string().describe("Title tag, 30-60 characters, primary keyword first"),
        slug: z.string().describe("URL path starting with /"),
        h1: z.string(),
        outline: z.array(z.string()).describe("H2 sections in order. The first one is a 40-60 word direct answer."),
        must_include: z.array(z.string()).describe("Facts, proof, schema or elements the page needs (e.g. price range, FAQPage schema, author, last updated date)"),
        internal_links: z.array(z.string()).describe("Pages that should link to or from this page"),
      }),
    )
    .describe("2-3 briefs for the most valuable NEW pages to create"),
  quick_wins: z.array(z.string()).describe("3-6 fast actions (under an hour each). Name the query and the page change."),
  prescriptions: z.array(PrescriptionSchema).describe("4-8 fixes, most valuable first"),
});

// ---------- Normalisation ----------

function normCluster(c: z.infer<typeof ClusterAI>): KeywordCluster | null {
  const keywords = uniqueKeywords(c.keywords, 15);
  if (!keywords.length) return null;
  return {
    name: c.name.trim() || keywords[0],
    intent: pick(c.intent, ["buy", "compare", "learn", "local"] as const, "learn"),
    priority: pick(c.priority, ["high", "medium", "low"] as const, "medium"),
    relative_demand: pick(c.relative_demand, ["high", "medium", "low"] as const, "medium"),
    difficulty: pick(c.difficulty, ["easy", "medium", "hard"] as const, "medium"),
    keywords,
    target_page: {
      action: /creat|new/i.test(c.target_page.action) ? "create" : "optimise",
      page: c.target_page.page.trim(),
      slug: normalizeSlug(c.target_page.slug || keywords[0]),
    },
    why: c.why.trim(),
  };
}

const RANK = { high: 0, medium: 1, low: 2 } as const;

type LoadedData = { data: ParsedData | null; from: string | null; note: string | null };

/** Connected Search Console first (when chosen), then whatever the owner pasted. */
async function loadData(input: Input, ctx: AgentContext): Promise<LoadedData> {
  if (input.gsc) {
    ctx.progress("Reading the last 90 days from your Search Console");
    const live = await fetchLiveSearchConsole(ctx.ws);
    if (live?.data) return { data: live.data, from: `Search Console: ${live.site}, last 90 days`, note: null };
    const why = live?.error ? `Search Console couldn't be read this time (${live.error})` : live ? "Search Console had no queries for this property in the last 90 days" : "No Search Console property is selected";
    const pasted = parsePastedData(input.data);
    return { data: pasted, from: null, note: `${why}, so this report ${pasted ? "uses the data you pasted" : "has no real search numbers"}.` };
  }
  return { data: parsePastedData(input.data), from: null, note: null };
}

function baseResult(input: Input, loaded: LoadedData) {
  const { data } = loaded;
  const vis = visibilityScore(data);
  return {
    data_from: loaded.from,
    mode: input.focus === "expand" ? ("expand" as const) : ("discover" as const),
    seeds: input.seeds,
    location: input.location,
    expand: input.expand,
    data,
    score: vis?.score ?? null,
    score_note: vis?.note ?? null,
  };
}

function title(input: Input): string {
  if (input.article) return articleRunTitle(input.article);
  if (input.expand) return `Keyword Lab: expand '${input.expand}'`;
  return `Keyword Lab: ${input.seeds[0] ?? "keywords"}`;
}

// ---------- Agent ----------

export const keywordsAgent: AgentDef<Input> = {
  id: "keywords",
  name: "Keyword Lab",
  blurb: "Finds the searches and AI questions your customers use, and maps each to a page.",
  description:
    "Looks at what ranks today and what people ask Google and AI assistants in your area, then groups keywords by intent, maps each group to a page to fix or create, and writes briefs for the new pages. Connect Search Console, or paste a Search Console or Keyword Planner export, to ground it in your real numbers. Click Expand on any keyword to drill deeper, or Write this article on any brief to get the full page.",

  parseInput(raw, ws) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const article = parseArticleBrief(r.article);
    // Article mode writes one page from a brief; drill-down and search data don't apply.
    const expand = article ? "" : cleanKeyword(String(r.expand ?? "")).slice(0, 80);
    let seeds = splitSeeds(r.seeds);
    if (!seeds.length && article) seeds = [article.target_keyword];
    if (!seeds.length) seeds = splitSeeds(ws.offers);
    if (!seeds.length && ws.industry) seeds = [ws.industry.trim()];
    if (!seeds.length && expand) seeds = [expand];
    if (!seeds.length) throw new Error("Add at least one service or topic to research.");
    const focus = article ? "article" : expand ? "expand" : "discover";
    const m = marketFor(ws.country);
    const location = String(r.location ?? "").trim().slice(0, 120) || ws.location?.trim() || (m.code === "INTL" ? "your area" : m.name);
    if (article) return { seeds, location, focus, expand, data: "", gsc: false, article };
    let data = typeof r.data === "string" ? r.data : "";
    if (data.length > MAX_DATA_CHARS) data = data.slice(0, MAX_DATA_CHARS);
    // On by default whenever a Search Console property is selected; the form can switch it off.
    const gsc = r.gsc !== false && connectedSources(ws).searchConsole !== null;
    return { seeds, location, focus, expand, data, gsc };
  },

  runTitle: (input) => title(input),

  async run(input, ctx) {
    if (input.article) return writeArticle(input, ctx);
    const loaded = await loadData(input, ctx);
    const data = loaded.data;
    if (data) ctx.progress(`Read ${data.total_rows} rows from your ${loaded.from ? "Search Console" : "pasted"} data`);
    const computedWins = dataQuickWins(data, 10);
    const expanding = Boolean(input.expand);
    const focusLine = expanding
      ? `DRILL-DOWN: go deep on the single keyword "${input.expand}". Other services for context: ${input.seeds.join(", ")}.`
      : `SEED TOPICS: ${input.seeds.join(", ")}`;

    ctx.progress(expanding ? `Researching searches around "${input.expand}"` : "Looking at what ranks and what people ask in your market");
    let notes = "";
    let sources: { title: string; url: string }[] = [];
    try {
      const r = await research({
        system:
          "You are a search researcher for a local small business. Search the web and report what you find. Be factual; list names and URLs you actually saw. Do not estimate search volumes.",
        prompt: `BUSINESS PROFILE
${businessContext(ctx.ws)}

TARGET LOCATION: ${input.location}
${focusLine}

Research ${expanding ? "this keyword" : "these topics"} as searched in ${input.location}:
1. Search the main ${expanding ? "keyword and its common variations (price, near me, best, reviews, vs)" : "seed topics with the location"}. Who ranks on page one? Note local competitors, directories, review sites, marketplaces and media. What type of page ranks (service page, price page, listicle, directory, forum)?
2. List "People also ask" style questions and related searches you see, word for word where possible.
3. Note what people ask on forums and community sites (${["SG", "MY"].includes(marketFor(ctx.ws.country).code) ? "Reddit, HardwareZone, Facebook groups, Xiaohongshu" : "Reddit, Facebook groups and popular local forums"}) about ${expanding ? "it" : "these topics"}.
4. Note any AI-style answers or featured snippets and which sites they cite.
5. Note modifiers people attach: price, cost, near me, best, reviews, vs, for <type of person>, neighbourhood names.
Finish with a plain list of every keyword phrase and question you saw.`,
        maxSearches: expanding ? 5 : 6,
        country: searchCountryFor(ctx.ws.country, input.location),
      });
      notes = r.text;
      sources = r.sources.slice(0, 20);
    } catch (e) {
      notes = `Web research was not available for this run (${(e as Error).message}). Work from the business profile and pasted data only, and say so in the summary.`;
    }

    ctx.progress("Grouping keywords and writing page briefs");
    const ai = await structured({
      system: `You are Keyword Lab, an SEO and answer-engine (AEO/GEO) keyword strategist for small businesses. You turn search research into a keyword map the owner can act on: clusters grouped by search intent, one target page per cluster, the conversational questions people ask AI assistants, and briefs for new pages.
Principles:
- One primary keyword per page; never map two clusters to the same page (avoid cannibalisation).
- Local businesses win "service + area" and "near me" searches with a dedicated service page plus Google Business Profile.
- AI assistants quote short self-contained answers (40-60 words), comparison tables, step lists and FAQ blocks with FAQPage schema, plus pages with clear prices, authors and last-updated dates.
- Directories and listicles often own "best X" searches; when they do, say the realistic play is getting listed there and showing reviews.
- Demand and difficulty are relative estimates. NEVER output a search volume, CPC or traffic number unless it is in the pasted data.
- In regulated categories, never suggest claiming to be "the best", guarantees, or before/after photos; flag pages that need a professional review.`,
      prompt: `BUSINESS PROFILE
${businessContext(ctx.ws)}

TARGET LOCATION: ${input.location}
${focusLine}
MODE: ${
        expanding
          ? `Expand. Every cluster must be a modifier group of "${input.expand}" (for example: price and cost, near me and neighbourhoods, best and reviews, vs and alternatives, for <type of person>, questions). Go deep on long-tail variants. AEO questions must all be about "${input.expand}" and its variants.`
          : "Discover. Cover buy, local, compare and learn intent across the seed topics. Include long-tail phrases a small business can actually win."
      }

${loaded.from ? `SEARCH CONSOLE DATA FROM THE OWNER'S CONNECTED ACCOUNT (${loaded.from})` : "PASTED DATA FROM THE OWNER"} (the ONLY real numbers available; use it to set priority and demand)
${dataForPrompt(data)}

${computedWins.length ? `QUICK WIN CANDIDATES FROM THE DATA (queries at positions 5-15, or top-3 with weak click rate)\n${computedWins.map((w) => `- ${w}`).join("\n")}\n` : ""}
WEB RESEARCH NOTES
${notes || "None."}

Write the keyword strategy. Quick wins: ${computedWins.length ? "turn the candidates above into specific page actions" : "on-page fixes to pages the business likely already has (homepage, service pages, Google Business Profile)"}. Prescriptions: the 4-8 most valuable SEO and AI-visibility actions from this research, with steps the owner can do themselves.`,
      schema: KeywordsAI,
      effort: "medium",
      maxTokens: 20000,
    });

    const clusters = ai.clusters
      .map(normCluster)
      .filter((c): c is KeywordCluster => c !== null)
      .sort((a, b) => RANK[a.priority] - RANK[b.priority])
      .slice(0, 10);

    const aeo_questions: AeoQuestion[] = ai.aeo_questions
      .filter((q) => q.question.trim())
      .slice(0, 12)
      .map((q) => ({ question: q.question.trim(), answer_angle: q.answer_angle.trim(), where_to_answer: q.where_to_answer.trim(), format: q.format.trim() || "FAQ block" }));

    const content_briefs: ContentBrief[] = ai.content_briefs.slice(0, 3).map((b) => ({
      title: b.title.trim(),
      slug: normalizeSlug(b.slug || b.title),
      h1: b.h1.trim(),
      outline: b.outline.map((s) => s.trim()).filter(Boolean),
      must_include: b.must_include.map((s) => s.trim()).filter(Boolean),
      internal_links: b.internal_links.map((s) => s.trim()).filter(Boolean),
    }));

    const result: KeywordsResult = {
      title: title(input),
      summary: loaded.note ? `${ai.summary} ${loaded.note}` : ai.summary,
      ...baseResult(input, loaded),
      clusters,
      aeo_questions,
      content_briefs,
      quick_wins: ai.quick_wins.map((s) => s.trim()).filter(Boolean).slice(0, 8),
      sources,
      prescriptions: ai.prescriptions.map(normalizePrescription).slice(0, 8),
    };
    return result;
  },

  async demo(input, ctx) {
    if (input.article) {
      ctx.progress("Laying out a sample article from the brief");
      return demoArticle(input, ctx.ws);
    }
    ctx.progress("Building sample keyword map");
    const loaded = await loadData(input, ctx);
    const data = loaded.data;
    const base = baseResult(input, loaded);
    const what = input.expand ? `"${input.expand}"` : input.seeds.slice(0, 3).join(", ");
    const dataLine = loaded.from && data
      ? ` ${data.total_rows} queries from your connected Search Console (last 90 days) were read for real${base.score != null ? `, and the visibility score comes from them` : ""}.`
      : data
      ? ` Your pasted ${data.source === "search_console" ? "Search Console" : data.source === "keyword_planner" ? "Keyword Planner" : "keyword"} data (${data.total_rows} rows) was read for real${
          base.score != null ? `, and the visibility score comes from it` : ""
        }.`
      : " Paste a Search Console or Keyword Planner export, or connect Search Console, to ground it in real numbers.";
    const result: KeywordsResult = {
      title: title(input),
      summary: `Sample output: this keyword map for ${what} in ${input.location} was built from your business profile without live search research, so treat the clusters as a starting point.${dataLine} Demand and difficulty labels are estimates, not search volumes.${loaded.note ? ` ${loaded.note}` : ""}`,
      ...base,
      clusters: sampleClusters(input, ctx.ws),
      aeo_questions: sampleQuestions(input, ctx.ws),
      content_briefs: sampleBriefs(input, ctx.ws),
      quick_wins: sampleQuickWins(input, data),
      sources: [],
      prescriptions: samplePrescriptions(input, ctx.ws, data),
      demo: true,
    };
    return result;
  },
};
