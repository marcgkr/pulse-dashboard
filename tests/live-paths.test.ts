/**
 * Runs every agent's LIVE path (agent.run) against a local mock of the Anthropic Messages API,
 * then renders each report component with the live-shaped result.
 *
 *   npm run test:live
 *
 * which is:
 *   ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4600 PULSERX_ALLOW_PRIVATE=1 NO_PROXY='*' \
 *     DATABASE_PATH=data/live-test.db npx tsx tests/live-paths.test.ts
 *
 * It starts the mock API (tests/mock-anthropic/server.ts, port 4600) and the fixture site
 * (python3 -m http.server 4555 --directory tests/fixtures/site) as child processes unless they are
 * already running, and stops the ones it started when it finishes.
 *
 * Options: MOCK_VERBOSE=1 prints the mock's request log; MOCK_ARRAY_ITEMS=0 (or 1) makes every generated
 * array empty (or single) to shake out crashes on sparse answers; LIVE_DUMP_DIR=dir writes each result as JSON.
 */
import { saveFeedback } from "../src/lib/memory";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToString } from "react-dom/server";

const ROOT = process.cwd();
// MOCK_ARRAY_ITEMS=0 makes the mock return empty arrays everywhere: only crashes count then, not content checks.
const EMPTY_MODE = process.env.MOCK_ARRAY_ITEMS === "0";
const MOCK_URL = "http://127.0.0.1:4600";
const SITE_URL = "http://127.0.0.1:4555/";

for (const [k, want] of [
  ["ANTHROPIC_API_KEY", null],
  ["ANTHROPIC_BASE_URL", MOCK_URL],
  ["PULSERX_ALLOW_PRIVATE", "1"],
  ["DATABASE_PATH", null],
] as const) {
  const v = process.env[k];
  if (!v || (want && v.replace(/\/$/, "") !== want)) {
    console.error(`Set ${k}${want ? `=${want}` : ""}. Run this with: npm run test:live`);
    process.exit(2);
  }
}

// ---------- Child processes ----------

const children: ChildProcess[] = [];
let stopping = false;

async function up(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return r.status < 500;
  } catch {
    return false;
  }
}

async function ensure(name: string, url: string, cmd: string, args: string[]) {
  if (await up(url)) {
    console.log(`(${name} already running at ${url})`);
    return;
  }
  const child = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: process.env });
  child.stdout?.on("data", (d) => process.env.MOCK_VERBOSE && process.stdout.write(`  ${d}`));
  child.stderr?.on("data", (d) => process.env.MOCK_VERBOSE && process.stderr.write(`  ${d}`));
  children.push(child);
  child.on("exit", (code, signal) => {
    if (!stopping) console.log(`(${name} exited early: code ${code}, signal ${signal})`);
  });
  for (let i = 0; i < 100; i++) {
    if (await up(url)) return;
    if (child.exitCode != null) throw new Error(`${name} exited with code ${child.exitCode}`);
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`${name} did not start at ${url}`);
}

function stopChildren() {
  stopping = true;
  for (const c of children) if (c.exitCode == null) c.kill();
}
process.on("exit", stopChildren);

// ---------- Checks ----------

const PRIORITIES = ["urgent", "high", "medium", "low"];
const IMPACTS = ["high", "medium", "low"];
const EFFORTS = ["quick", "half-day", "project"];

function checkPrescription(p: Record<string, unknown>, where: string) {
  assert.equal(typeof p.title, "string", `${where}.title`);
  assert.ok((p.title as string).length > 0, `${where}.title is empty`);
  assert.equal(typeof p.diagnosis, "string", `${where}.diagnosis`);
  assert.ok(Array.isArray(p.steps) && (p.steps as unknown[]).every((s) => typeof s === "string" && s.length > 0), `${where}.steps`);
  assert.ok((p.steps as string[]).every((s) => !/^\s*(step\s*)?\d+[.):-]/i.test(s)), `${where}.steps keep a numbering prefix`);
  assert.equal(typeof p.where, "string", `${where}.where`);
  assert.ok(PRIORITIES.includes(p.priority as string), `${where}.priority=${p.priority}`);
  assert.ok(IMPACTS.includes(p.impact as string), `${where}.impact=${p.impact}`);
  assert.ok(EFFORTS.includes(p.effort as string), `${where}.effort=${p.effort}`);
  assert.equal(typeof p.category, "string", `${where}.category`);
  assert.ok(Number.isInteger(p.recheck_days) && (p.recheck_days as number) >= 1 && (p.recheck_days as number) <= 90, `${where}.recheck_days=${p.recheck_days}`);
}

function checkResult(r: Record<string, unknown>, label: string) {
  assert.ok(r && typeof r === "object", `${label}: no result`);
  assert.equal(typeof r.title, "string", `${label}.title`);
  assert.ok((r.title as string).length > 0, `${label}.title is empty`);
  assert.equal(typeof r.summary, "string", `${label}.summary`);
  assert.ok((r.summary as string).length > 0, `${label}.summary is empty`);
  assert.ok(r.score === null || (typeof r.score === "number" && r.score >= 0 && r.score <= 100), `${label}.score=${r.score}`);
  assert.ok(!r.demo, `${label} came back as demo output`);
  assert.ok(Array.isArray(r.prescriptions), `${label}.prescriptions is not an array`);
  if (!EMPTY_MODE) assert.ok((r.prescriptions as unknown[]).length > 0, `${label}.prescriptions is empty`);
  (r.prescriptions as Record<string, unknown>[]).forEach((p, i) => checkPrescription(p, `${label}.prescriptions[${i}]`));
  const json = JSON.stringify(r);
  assert.deepEqual(Object.keys(JSON.parse(json)).sort(), Object.keys(r).filter((k) => r[k] !== undefined).sort(), `${label}: JSON round trip lost keys`);
}

// ---------- Main ----------

type Case = { label: string; agent: string; raw: unknown; extra?: (r: Record<string, unknown>) => void };

async function main() {
  const dbPath = path.resolve(process.env.DATABASE_PATH!);
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) fs.rmSync(f, { force: true });

  // node --import tsx (not npx tsx) so the server is our direct child and dies when we kill it.
  await ensure("mock Anthropic API", `${MOCK_URL}/health`, process.execPath, ["--import", "tsx", "tests/mock-anthropic/server.ts"]);
  await ensure("fixture site", SITE_URL, "python3", ["-m", "http.server", "4555", "--bind", "127.0.0.1", "--directory", "tests/fixtures/site"]);

  // tsx compiles the app's JSX with the classic runtime (tsconfig has "jsx": "preserve" for Next).
  (globalThis as { React?: typeof React }).React = React;
  // Import after the env is set so the DB path and AI client pick it up.
  const { db, id, now } = await import("@/lib/db");
  const { aiEnabled, structured, chatStream } = await import("@/lib/ai");
  const { getAgent } = await import("@/lib/agents");
  const { execute } = await import("@/lib/runs");
  const { AGENT_REPORTS } = await import("@/components/reports");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { z } = await import("zod");
  type WorkspaceRow = import("@/lib/db").WorkspaceRow;

  assert.ok(aiEnabled(), "aiEnabled() should be true with ANTHROPIC_API_KEY set");

  const userId = id("u_");
  db().prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(userId, `live-${userId}@example.com`, "Live Test", "x", now());
  const ws: WorkspaceRow = {
    id: id("w_"),
    owner_id: userId,
    name: "Lumen Skin Clinic",
    website: SITE_URL,
    industry: "Aesthetic clinic",
    location: "Singapore (Tampines and Orchard)",
    country: "SG",
    audience: "Working women 28-45, first-timers worried about downtime and pain",
    offers: "Pico laser for pigmentation, Hydrafacial, skin boosters, acne scar treatment",
    competitors: "Glow Aesthetics, The Skin Lab SG",
    goals: "25 more first-time consultations a month without raising ad spend",
    monthly_budget: "S$4,000 Google + Meta",
    tone: "Warm, reassuring, no hard sell",
    regulated: 1,
    plan: "growth",
    stripe_customer_id: null,
    windsor_api_key: null,
    created_at: now(),
  };
  db()
    .prepare(
      `INSERT INTO workspaces (id, owner_id, name, website, industry, location, audience, offers, competitors, goals, monthly_budget, tone, regulated, plan, created_at)
       VALUES (@id, @owner_id, @name, @website, @industry, @location, @audience, @offers, @competitors, @goals, @monthly_budget, @tone, @regulated, @plan, @created_at)`,
    )
    .run(ws);

  const csv = (f: string) => fs.readFileSync(path.join(ROOT, "tests/fixtures/ads", f), "utf8");
  const gsc = [
    "Top queries\tClicks\tImpressions\tCTR\tPosition",
    "pico laser singapore\t12\t1900\t0.63%\t8.4",
    "pico laser tampines\t30\t410\t7.3%\t3.1",
    "hydrafacial singapore price\t4\t2200\t0.18%\t11.2",
    "acne scar treatment singapore\t9\t980\t0.92%\t6.7",
    "lumen skin clinic\t85\t140\t60.7%\t1.0",
  ].join("\n");

  const cases: Case[] = [
    { label: "site", agent: "site", raw: { url: SITE_URL }, extra: (r) => assert.ok(r.audit && r.rewrite && Array.isArray(r.faq)) },
    {
      label: "keywords (discover + pasted GSC data)",
      agent: "keywords",
      raw: { seeds: "pico laser, hydrafacial", location: "Tampines, Singapore", data: gsc },
      extra: (r) => {
        assert.ok((r.clusters as unknown[]).length > 0, "no clusters");
        assert.ok(r.data, "pasted data not parsed");
        assert.ok((r.sources as unknown[]).length > 0, "no research sources");
      },
    },
    { label: "keywords (expand)", agent: "keywords", raw: { seeds: "pico laser", expand: "pico laser tampines" }, extra: (r) => assert.equal(r.mode, "expand") },
    {
      label: "visibility",
      agent: "visibility",
      raw: {
        prompts: "best clinic for pico laser in Tampines\nIs Lumen Skin Clinic good for hydrafacial?",
        domain: "lumenskinclinic.sg",
      },
      extra: (r) => {
        const prompts = r.prompts as { mentioned: boolean; cited: boolean; error?: string; answer: string }[];
        assert.equal(prompts.length, 2);
        assert.ok(prompts.every((p) => !p.error && p.answer.length > 0), "a prompt errored or has no answer");
        assert.ok(prompts.some((p) => p.mentioned && p.cited), "brand never mentioned+cited");
        assert.ok(prompts.some((p) => !p.mentioned), "brand mentioned everywhere");
      },
    },
    {
      label: "content",
      agent: "content",
      raw: { platforms: ["Instagram", "TikTok"], goal: "enquiries", count: 6, per_week: 3 },
      extra: (r) => assert.ok((r.ideas as unknown[]).length > 0 && (r.pillars as { percent: number }[]).reduce((a, p) => a + p.percent, 0) === 100),
    },
    { label: "content (more like)", agent: "content", raw: { platforms: "Instagram", more_like: "Pico laser myths in 15 seconds", trends: false } },
    {
      label: "ads",
      agent: "ads",
      raw: {
        source: "upload",
        reports: [
          { filename: "google-campaigns.csv", csv: csv("google-campaigns.csv") },
          { filename: "google-search-terms.csv", csv: csv("google-search-terms.csv") },
          { filename: "meta-adsets.csv", csv: csv("meta-adsets.csv") },
        ],
      },
      extra: (r) => assert.ok(r.ai && r.creative),
    },
    {
      label: "compliance",
      agent: "compliance",
      raw: {
        channel: "Meta ad",
        category: "Aesthetic clinic",
        text: "Singapore's best pico laser! Guaranteed clear skin in 1 session, painless with no downtime. Our patients say it changed their lives. Book this week only and get 50% off!",
      },
      extra: (r) => assert.ok((r.issues as unknown[]).length > 0 && typeof r.rewritten_copy === "string"),
    },
  ];

  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
  let failures = 0;
  const pass = (msg: string) => console.log(`  ok   ${msg}`);
  const fail = (msg: string, e: unknown) => {
    failures++;
    console.log(`  FAIL ${msg}\n       ${(e as Error)?.stack?.split("\n").slice(0, 4).join("\n       ") ?? e}`);
  };

  for (const c of cases) {
    console.log(`\n${c.label}`);
    const agent = getAgent(c.agent)!;
    let result: Record<string, unknown> | null = null;
    let input: unknown;
    try {
      input = agent.parseInput(c.raw, ws);
      const steps: string[] = [];
      result = (await agent.run(input, { ws, runId: "live-test", progress: (m) => steps.push(m) })) as Record<string, unknown>;
      if (process.env.LIVE_DUMP_DIR) fs.writeFileSync(path.join(process.env.LIVE_DUMP_DIR, `${c.label.replace(/\W+/g, "-")}.json`), JSON.stringify(result, null, 2));
      checkResult(result, c.label);
      if (!EMPTY_MODE) c.extra?.(result);
      pass(`run: "${result.title}" (${(result.prescriptions as unknown[]).length} prescriptions, ${steps.length} progress updates)`);
    } catch (e) {
      fail(`run`, e);
    }
    if (!result) continue;
    try {
      const Report = AGENT_REPORTS[c.agent as keyof typeof AGENT_REPORTS];
      const run = { id: "r_live", agent: c.agent, title: agent.runTitle(input, ws), created_at: now(), input: c.raw as Record<string, unknown> };
      const html = renderToString(createElement(AppRouterContext.Provider, { value: router as never }, createElement(Report, { result: JSON.parse(JSON.stringify(result)), run })));
      if (!EMPTY_MODE) assert.ok(html.length > 500, "report rendered almost nothing");
      pass(`report renders (${html.length} chars of HTML)`);
    } catch (e) {
      fail(`report render`, e);
    }
  }

  // Keyword Lab article mode: "Write this article" on a brief, with the owner's own videos.
  console.log("\nkeywords (article mode, with the owner's videos)");
  {
    const { relevantVideos } = await import("@/lib/videos");
    const { articleHtml, articleMarkdown } = await import("@/lib/agents/article-format");
    const RELATED = "https://www.youtube.com/watch?v=PicoLaser01";
    const UNRELATED = "https://www.tiktok.com/@lumenskin/video/7300000000000000001";
    const addVideo = (platform: string, ext: string, url: string, title: string, caption: string, transcript: string | null) =>
      db()
        .prepare(
          "INSERT INTO social_videos (workspace_id, platform, external_id, url, title, caption, published_at, transcript, transcript_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(ws.id, platform, ext, url, title, caption, now(), transcript, transcript ? "done" : "none", now());
    addVideo("youtube", "PicoLaser01", RELATED, "What a pico laser session for pigmentation looks like", "Pico laser at our Tampines clinic", "Today we walk you through a pico laser session for pigmentation.");
    addVideo("tiktok", "7300000000000000001", UNRELATED, "Meet Biscuit, our office dog", "Say hi at reception", null);
    const brief = {
      title: "Pico Laser in Tampines | Lumen Skin Clinic",
      slug: "/pico-laser-tampines",
      h1: "Pico laser in Tampines",
      outline: ["Opening answer (40 to 60 words): what pico laser does for pigmentation", "Price and what is included", "How a session works, step by step", "Who it suits and who it does not"],
      must_include: ["A visible 'Last updated' date", "Real prices from your price list"],
      internal_links: ["Homepage", "Contact or booking page"],
    };
    const agent = getAgent("keywords")!;
    const inserted = new Set([RELATED, UNRELATED]);
    try {
      const topic = [brief.title, "pico laser in tampines", ...brief.outline].join(" ");
      const cands = relevantVideos(ws.id, topic, 8).map((v) => v.url);
      assert.ok(cands.includes(RELATED), "related video is not a candidate");
      assert.ok(!cands.includes(UNRELATED), "unrelated video was offered as a candidate");
      pass("relevantVideos offers the related video and leaves out the unrelated one");
    } catch (e) {
      fail("relevantVideos", e);
    }
    let input: import("@/lib/agents/keywords-demo").KeywordsInput | null = null;
    try {
      // Sent from an expand report: article mode wins and the drill-down is dropped.
      input = agent.parseInput({ seeds: "pico laser", location: "Tampines, Singapore", focus: "expand", expand: "pico laser tampines", data: gsc, article: brief }, ws) as import("@/lib/agents/keywords-demo").KeywordsInput;
      assert.equal(input.focus, "article");
      assert.equal(input.expand, "");
      assert.equal(input.data, "");
      assert.equal(input.article?.target_keyword, "pico laser in tampines");
      assert.equal(agent.runTitle(input, ws), `Article: ${brief.title}`);
      const big = agent.parseInput(
        { seeds: "x", article: { ...brief, title: "T".repeat(500), outline: Array.from({ length: 50 }, (_, i) => `Section ${i} ${"y".repeat(400)}`), must_include: "a\nb", internal_links: 7 } },
        ws,
      ) as import("@/lib/agents/keywords-demo").KeywordsInput;
      assert.ok(big.article!.title.length <= 120 && big.article!.outline.length === 12 && big.article!.outline.every((o) => o.length <= 300), "article brief not bounded");
      assert.deepEqual(big.article!.must_include, ["a", "b"]);
      assert.deepEqual(big.article!.internal_links, []);
      assert.throws(() => agent.parseInput({ seeds: "x", article: "write me something" }, ws), /article brief/);
      assert.throws(() => agent.parseInput({ seeds: "x", article: { outline: ["a"] } }, ws), /needs a title/);
      pass("parseInput: article mode, bounds and bad briefs");
    } catch (e) {
      fail("article parseInput", e);
    }
    if (input) {
      try {
        const r = (await agent.run(input, { ws, runId: "live-test", progress: () => {} })) as Record<string, unknown>;
        checkResult(r, "keywords (article)");
        const a = r.article as import("@/lib/agents/article-format").Article;
        assert.equal(r.mode, "article");
        assert.ok(a && Array.isArray(a.sections), "no article sections");
        if (!EMPTY_MODE) assert.ok(a.sections.length > 0, "article has no sections");
        assert.ok(a.meta_description.length <= 155, `meta description is ${a.meta_description.length} chars`);
        assert.ok(a.videos.every((v) => inserted.has(v.url)), `embedded a video that is not the owner's: ${a.videos.map((v) => v.url).join(", ")}`);
        assert.ok(!a.videos.some((v) => v.url === UNRELATED), "embedded the unrelated video");
        if (!EMPTY_MODE) assert.deepEqual(a.videos.map((v) => v.url), [RELATED], "expected the offered video only (the made-up one must be dropped)");
        const reqs = (await (await fetch(`${MOCK_URL}/__requests`)).json()) as { system?: { text: string }[]; messages?: { content: unknown }[] }[];
        const req = reqs.filter((x) => x.system?.some((b) => b.text.includes("Keyword Lab's article writer"))).at(-1);
        const sent = JSON.stringify(req?.messages ?? []);
        assert.ok(sent.includes(RELATED), "related video not offered to the model");
        assert.ok(!sent.includes(UNRELATED), "unrelated video offered to the model");
        const html = articleHtml(a);
        if (!EMPTY_MODE) assert.ok(html.includes("youtube-nocookie.com/embed/PicoLaser01") && articleMarkdown(a).includes("## "), "HTML or Markdown copy is missing parts");
        const Report = AGENT_REPORTS.keywords;
        const page = renderToString(
          createElement(AppRouterContext.Provider, { value: router as never }, createElement(Report, { result: JSON.parse(JSON.stringify(r)), run: { id: "r_live", agent: "keywords", title: String(r.title), created_at: now(), input: input as unknown as Record<string, unknown> } })),
        );
        assert.ok(page.includes("Copy as HTML") && page.includes("Copy as Markdown"), "article report has no copy buttons");
        assert.ok(!page.includes("Keyword clusters"), "article rendered as a keyword map");
        pass(`run: "${r.title}" (${a.sections.length} sections, ${a.faq.length} FAQ, ${a.videos.length} video), report renders`);
      } catch (e) {
        // An answer with no sections is refused with a readable error rather than saved as an empty article.
        if (EMPTY_MODE && /without any sections/.test((e as Error).message)) pass(`empty answer -> "${(e as Error).message}"`);
        else fail("article run", e);
      }
      try {
        const r = (await agent.demo(input, { ws, runId: "live-test", progress: () => {} })) as Record<string, unknown>;
        const a = r.article as import("@/lib/agents/article-format").Article;
        assert.equal(r.demo, true);
        assert.equal(r.mode, "article");
        assert.ok(a.sections.length > 0 && a.faq.length > 0 && a.cta.button, "demo article is missing parts");
        assert.ok(a.sections.some((s) => s.heading === "Price and what is included"), "demo sections don't follow the outline");
        assert.ok(a.intro[0].includes("[Sample text]"), "demo text is not marked as sample");
        assert.ok(a.videos.length <= 2 && a.videos.every((v) => inserted.has(v.url)) && a.videos.some((v) => v.url === RELATED), "demo videos");
        assert.ok((r.prescriptions as unknown[]).length > 0, "demo has no prescriptions");
        const wsNoVideos = { ...ws, id: id("w_") };
        const none = (await agent.demo(input, { ws: wsNoVideos, runId: "live-test", progress: () => {} })) as Record<string, unknown>;
        assert.ok(/Connected accounts/.test(String(none.video_note)), `no-video note: ${none.video_note}`);
        pass("demo: sections from the outline, sample text marked, owner's videos only, connect note without videos");
      } catch (e) {
        fail("article demo", e);
      }
    }
  }

  // The workspace's country (not the location text) sets where web searches run from.
  type MockRequest = { system?: { type: string; text: string }[]; tools?: { type: string; user_location?: { country?: string } }[]; messages?: unknown[] };
  const lastSearchCountry = async () => {
    const reqs = (await (await fetch(`${MOCK_URL}/__requests`)).json()) as MockRequest[];
    const search = reqs.filter((r) => r.tools?.some((t) => t.type.startsWith("web_search"))).at(-1)!;
    return search.tools!.find((t) => t.type.startsWith("web_search"))!.user_location?.country;
  };
  for (const [label, country, location] of [
    ["Malaysia", "MY", "Kuala Lumpur, Malaysia"],
    ["Australia", "AU", "Surry Hills"],
  ] as const) {
    console.log(`\ncontent research location (${label} business)`);
    try {
      const agent = getAgent("content")!;
      const wsX = { ...ws, country, location };
      await agent.run(agent.parseInput({ platforms: ["Instagram"], count: 6 }, wsX), { ws: wsX, runId: "live-test", progress: () => {} });
      const got = await lastSearchCountry();
      assert.equal(got, country, `web search was located in ${got}`);
      pass(`web search located in ${country}`);
    } catch (e) {
      fail(`content research location (${label})`, e);
    }
  }

  // Compliance Check for a UK business reviews against UK rules, not Singapore's.
  console.log("\ncompliance rules (UK business)");
  try {
    const agent = getAgent("compliance")!;
    const wsGB = { ...ws, country: "GB", location: "Shoreditch, London" };
    const raw = cases.find((c) => c.agent === "compliance")!.raw;
    const r = (await agent.run(agent.parseInput(raw, wsGB), { ws: wsGB, runId: "live-test", progress: () => {} })) as Record<string, unknown>;
    const reqs = (await (await fetch(`${MOCK_URL}/__requests`)).json()) as MockRequest[];
    const req = reqs.filter((x) => x.system?.some((b) => b.text.includes("You are Compliance Check"))).at(-1);
    assert.ok(req, "no compliance request recorded");
    // The agent's own block (the house rules block before it mentions Singapore as PULSE Digital's home).
    const system = req!.system!.find((b) => b.text.includes("You are Compliance Check"))!.text;
    assert.ok(system.includes("CAP Code") && system.includes("MHRA"), "compliance prompt does not mention the UK rules");
    assert.ok(!/HCSA|ASAS|Singapore/.test(system), "compliance prompt still mentions Singapore rules");
    assert.ok(/the UK/.test(r.disclaimer as string), `disclaimer: ${r.disclaimer}`);
    pass("prompt uses UK rules (MHRA, CAP Code) and the disclaimer names the UK");
  } catch (e) {
    fail("compliance rules (UK business)", e);
  }

  // The real pipeline: run row -> execute -> result_json + tasks.
  console.log("\nruns.execute (compliance)");
  try {
    const agent = getAgent("compliance")!;
    const input = agent.parseInput(cases.find((c) => c.agent === "compliance")!.raw, ws);
    const runId = id("r_");
    db()
      .prepare("INSERT INTO runs (id, workspace_id, agent, title, input_json, status, progress, demo, created_at) VALUES (?, ?, 'compliance', ?, ?, 'queued', '', 0, ?)")
      .run(runId, ws.id, agent.runTitle(input, ws), JSON.stringify(input), now());
    await execute(runId, ws, input, true);
    const row = db().prepare("SELECT status, error, demo FROM runs WHERE id = ?").get(runId) as { status: string; error: string | null; demo: number };
    assert.equal(row.status, "done", `run status ${row.status}: ${row.error}`);
    assert.equal(row.demo, 0);
    const tasks = db().prepare("SELECT COUNT(*) AS n FROM tasks WHERE run_id = ?").get(runId) as { n: number };
    if (!EMPTY_MODE) assert.ok(tasks.n > 0, "no tasks created");
    pass(`run saved, ${tasks.n} tasks created`);
  } catch (e) {
    fail("execute", e);
  }

  // Owner feedback on one report reaches the same specialist's next run, and only that specialist's.
  console.log("\nmemory (owner feedback reaches the next run)");
  try {
    const agent = getAgent("compliance")!;
    const input = agent.parseInput(cases.find((c) => c.agent === "compliance")!.raw, ws);
    const prevRun = db().prepare("SELECT id FROM runs WHERE workspace_id = ? AND agent = 'compliance' ORDER BY created_at DESC LIMIT 1").get(ws.id) as { id: string };
    saveFeedback({ workspaceId: ws.id, agent: "compliance", runId: prevRun.id, item: "", verdict: "comment", comment: "We are a dental clinic, not an aesthetics clinic." });
    saveFeedback({ workspaceId: ws.id, agent: "content", runId: prevRun.id, item: "Some idea", verdict: "reject", comment: "CONTENT-ONLY NOTE" });
    const runId = id("r_");
    db()
      .prepare("INSERT INTO runs (id, workspace_id, agent, title, input_json, status, progress, demo, created_at) VALUES (?, ?, 'compliance', ?, ?, 'queued', '', 0, ?)")
      .run(runId, ws.id, agent.runTitle(input, ws), JSON.stringify(input), now());
    await execute(runId, ws, input, true);
    const reqs = (await (await fetch(`${MOCK_URL}/__requests`)).json()) as MockRequest[];
    const req = reqs.filter((x) => x.system?.some((b) => b.text.includes("You are Compliance Check"))).at(-1);
    const text = JSON.stringify(req?.messages ?? []);
    assert.ok(text.includes("WHAT THE OWNER HAS TOLD YOU"), "owner notes block missing from the prompt");
    assert.ok(text.includes("We are a dental clinic, not an aesthetics clinic."), "the owner's comment is missing from the prompt");
    assert.ok(!text.includes("CONTENT-ONLY NOTE"), "another specialist's note leaked into this prompt");
    pass("comment saved on a report is in the next compliance prompt; content notes stay with Content Studio");
  } catch (e) {
    fail("memory", e);
  }

  // Pro autopilot: weekly Site Doctor, monthly AI Visibility from the owner's last questions,
  // only for businesses the plan covers, and nothing twice.
  console.log("\nautopilot (Pro re-checks)");
  try {
    const { runAutopilot } = await import("../src/lib/autopilot");
    const owner = id("u_");
    db().prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, 'Auto', 'x', ?)").run(owner, `${owner}@example.com`, now());
    const mk = (name: string, plan: string, created: string, extra = "") => {
      const wid = id("w_");
      db()
        .prepare("INSERT INTO workspaces (id, owner_id, name, website, plan, country, created_at, autopilot) VALUES (?, ?, ?, ?, ?, 'SG', ?, ?)")
        .run(wid, owner, name, SITE_URL, plan, created, extra === "off" ? 0 : 1);
      return wid;
    };
    const a = mk("Auto One", "pro", "2026-01-01T00:00:00.000Z");
    // Pro includes one outlet; the second business is covered by one paid extra outlet.
    db().prepare("UPDATE workspaces SET extra_outlets = 1 WHERE id = ?").run(a);
    const b = mk("Auto Two", "free", "2026-01-02T00:00:00.000Z"); // plan comes from the first business
    const off = mk("Auto Off", "free", "2026-01-03T00:00:00.000Z", "off");
    const beyond = mk("Auto Beyond", "free", "2026-01-04T00:00:00.000Z"); // past the outlets paid for
    const visInput = getAgent("visibility")!.parseInput(cases.find((c) => c.agent === "visibility")!.raw, ws);
    db()
      .prepare("INSERT INTO runs (id, workspace_id, agent, title, input_json, status, progress, demo, created_at) VALUES (?, ?, 'visibility', 'old', ?, 'done', '', 0, ?)")
      .run(id("r_"), a, JSON.stringify(visInput), new Date(Date.now() - 40 * 86400000).toISOString());
    const started = runAutopilot();
    const rows = db().prepare(`SELECT workspace_id, agent, title FROM runs WHERE id IN (${started.map(() => "?").join(",")})`).all(...started) as { workspace_id: string; agent: string; title: string }[];
    const got = rows.map((r) => `${r.workspace_id === a ? "one" : r.workspace_id === b ? "two" : r.workspace_id === beyond ? "beyond" : "off"}:${r.agent}`).sort();
    assert.deepEqual(got, ["one:site", "one:visibility", "two:site"], `started ${got.join(", ")}`);
    assert.ok(rows.every((r) => r.title.startsWith("Autopilot: ")), "autopilot titles");
    assert.ok(!rows.some((r) => r.workspace_id === off), "switched-off business was re-checked");
    assert.equal(runAutopilot().length, 0, "started the same re-checks twice");
    // Let the started runs finish before the next checks use the mock.
    for (let i = 0; i < 120; i++) {
      const left = (db().prepare(`SELECT COUNT(*) AS n FROM runs WHERE id IN (${started.map(() => "?").join(",")}) AND status IN ('queued','running')`).get(...started) as { n: number }).n;
      if (!left) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    pass("Pro business and its extra business re-checked, switched-off business skipped, no repeats");
  } catch (e) {
    fail("autopilot", e);
  }

  // Promo codes: limits, one use per account, expiry, and the plan they lift.
  console.log("\npromo codes");
  try {
    const { redeemPromo, effectivePlan, checkPromo } = await import("../src/lib/promos");
    const mkWs = () => {
      const uid = id("u_");
      db().prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, 'P', 'x', ?)").run(uid, `${uid}@example.com`, now());
      const wid = id("w_");
      db().prepare("INSERT INTO workspaces (id, owner_id, name, plan, created_at) VALUES (?, ?, 'Promo test', 'free', ?)").run(wid, uid, now());
      return db().prepare("SELECT * FROM workspaces WHERE id = ?").get(wid) as import("../src/lib/db").WorkspaceRow;
    };
    db().prepare("INSERT INTO promo_codes (code, plan, days, max_uses, uses, redeem_by, note, active, created_at) VALUES ('TEST-TWO', 'pro', 30, 2, 0, NULL, '', 1, ?)").run(now());
    db().prepare("INSERT INTO promo_codes (code, plan, days, max_uses, uses, redeem_by, note, active, created_at) VALUES ('TEST-OLD', 'pro', 30, NULL, 0, '2020-01-01T00:00:00.000Z', '', 1, ?)").run(now());
    const [w1, w2, w3] = [mkWs(), mkWs(), mkWs()];
    const r1 = redeemPromo(w1, " test-two ", "a@example.com");
    assert.equal(r1.plan, "pro");
    assert.ok(r1.until && Math.abs(Date.parse(r1.until) - Date.now() - 30 * 86400000) < 60000, "30 days");
    assert.throws(() => redeemPromo(w1, "TEST-TWO", "a@example.com"), /already used/);
    redeemPromo(w2, "TEST-TWO", "b@example.com");
    assert.throws(() => redeemPromo(w3, "TEST-TWO", "c@example.com"), /used up/);
    assert.throws(() => checkPromo("TEST-OLD"), /expired/);
    assert.throws(() => checkPromo("NOPE-NOPE"), /isn't valid/);
    const after = db().prepare("SELECT * FROM workspaces WHERE id = ?").get(w1.id) as import("../src/lib/db").WorkspaceRow;
    assert.equal(effectivePlan(after), "pro");
    assert.equal(effectivePlan({ ...after, promo_until: "2020-01-01T00:00:00.000Z" }), "free", "expired promo still applies");
    assert.equal(effectivePlan({ ...after, plan: "pro", promo_plan: "starter" }), "pro", "promo lowered a paid plan");
    assert.equal((db().prepare("SELECT uses FROM promo_codes WHERE code = 'TEST-TWO'").get() as { uses: number }).uses, 2);
    pass("limits, one use per account, expiry, and the higher plan wins");
  } catch (e) {
    fail("promo codes", e);
  }

  console.log("\nstructured() edge cases");
  const Tiny = z.object({ answer: z.string(), items: z.array(z.string()) });
  try {
    const out = await structured({ system: "Test.", prompt: "Say hi.", schema: Tiny, effort: "low" });
    assert.ok(typeof out.answer === "string" && Array.isArray(out.items));
    pass("plain structured call parses");
  } catch (e) {
    fail("plain structured call", e);
  }
  try {
    await structured({ system: "Test.", prompt: "Long one [[mock:max_tokens]]", schema: Tiny });
    fail("max_tokens", new Error("did not throw"));
  } catch (e) {
    if (/too long to finish/.test((e as Error).message)) pass(`max_tokens -> "${(e as Error).message}"`);
    else fail(`max_tokens gives the friendly error`, e);
  }
  try {
    await structured({ system: "Test.", prompt: "Refuse this [[mock:refusal]]", schema: Tiny });
    fail("refusal", new Error("did not throw"));
  } catch (e) {
    if (/declined/.test((e as Error).message)) pass(`refusal -> "${(e as Error).message}"`);
    else fail(`refusal gives the friendly error`, e);
  }

  console.log("\nchatStream (Ask PULSE)");
  try {
    let text = "";
    let deltas = 0;
    for await (const d of chatStream({
      system: "You are Ask PULSE.\n\nBUSINESS PROFILE\nBusiness name: Lumen Skin Clinic",
      messages: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello! What would you like to work on?" },
        { role: "user", content: "What should I fix first?" },
      ],
    })) {
      text += d;
      deltas++;
    }
    assert.ok(deltas > 1, "expected several deltas");
    assert.ok(text.includes("What should I fix first?"), "streamed text incomplete");
    pass(`streamed ${text.length} chars in ${deltas} deltas`);
  } catch (e) {
    fail("chatStream", e);
  }

  // POST /api/chat itself, with the auth module stubbed to return our workspace. The stored history is
  // 20 messages that start on an assistant reply (what a turn that saved no answer leaves behind).
  console.log("\nPOST /api/chat");
  try {
    const authPath = require.resolve("@/lib/auth");
    require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { apiWorkspace: async () => ({ ws }) } } as NodeJS.Module;
    const { POST } = await import("@/app/api/chat/route");
    const insert = db().prepare("INSERT INTO chat_messages (id, workspace_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)");
    const t0 = Date.now() - 60_000;
    for (let i = 0; i < 20; i++) insert.run(id("m_"), ws.id, i % 2 ? "user" : "assistant", `Earlier message ${i}`, new Date(t0 + i * 1000).toISOString());
    const res = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ message: "What should I fix first?" }) }));
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(!/Something went wrong/.test(text), `chat answered with an error: ${text}`);
    assert.ok(text.includes("What should I fix first?"), `unexpected answer: ${text}`);
    const saved = db().prepare("SELECT content FROM chat_messages WHERE workspace_id = ? AND role = 'assistant' ORDER BY created_at DESC LIMIT 1").get(ws.id) as { content: string };
    assert.equal(saved.content, text, "saved answer differs from streamed answer");
    pass(`streamed and saved a ${text.length}-char answer`);
  } catch (e) {
    fail("POST /api/chat", e);
  }

  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll live-path checks passed.");
  stopChildren();
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  stopChildren();
  process.exit(1);
});
