# MarketingRx

A do-it-yourself AI marketing suite by PULSE Digital. Business owners get a checkup from six AI specialists, receive a prescription of fixes with step-by-step instructions, and implement the changes themselves. Domain: **marketingrx.ai**.

## What's inside

| Area | What it does |
| --- | --- |
| Chart (dashboard) | Pulse Score (website, AI visibility, ads health, fixes done), score trend, next prescriptions, specialists |
| Site Doctor | Crawls the homepage + up to 6 inner pages. 25 checks across technical, on-page, conversion, tracking and AI search. Platform-aware fix steps (WordPress, Shopify, Wix, Squarespace, Webflow). Rewrites title/meta/H1 and drafts FAQs |
| Keyword Lab | SEO keyword clusters, AEO questions, content briefs, quick wins from pasted Search Console data. Every keyword can be expanded into a deeper drill-down |
| AI Visibility | Asks AI-assistant-style questions with live web search, checks whether the business is named or cited, share of voice vs competitors, which sources AI pulls from |
| Content Studio | Trend research, content pillars, ready-to-post ideas (hook, script, caption, hashtags), 2-week calendar, "more like this" |
| Ads Doctor | Google Ads and Meta Ads from CSV exports or Windsor.ai sync. Computes CPA/CTR/frequency flags against the account's own averages, wasted search terms, pause/scale lists, RSA headline ideas |
| Compliance Check | Pre-checks ad copy and landing pages against SG healthcare advertising rules, ASAS, Meta and Google ad policies, with compliant rewrites |
| Ask PULSE | Streaming strategist chat that has read the profile, latest reports and open prescriptions |
| Prescriptions board | Every recommendation as a task: open / done / not relevant, filter by specialist, "Rather have PULSE do it?" upsell on every card |
| Admin (`/admin`) | All businesses, plans, usage, list-price MRR, manual plan override for comped clients |
| Billing | Stripe Checkout + customer portal + webhook (optional; without Stripe the plan page shows a contact email) |
| Public free checkup | Landing page hero runs a real website checkup without signing up |

## Run it locally

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY for live AI
npm run dev                  # http://localhost:3000
```

Without `ANTHROPIC_API_KEY` the platform runs in **demo mode**: deterministic parts (website crawl, CSV ads analysis, compliance phrase scan) are real, and AI-written parts are sample output labelled as such. Demo runs don't count toward plan limits.

## Environment

See `.env.example`. The important ones:

- `ANTHROPIC_API_KEY` turns on live agents. `PULSERX_MODEL` overrides the model (default `claude-opus-5-5`).
- `DATABASE_PATH` is the SQLite file. In production, put it on a persistent volume.
- `ADMIN_SETUP_TOKEN` (16+ characters) lets you make your own account an admin: sign up, open `/admin/claim`, enter the token, then remove the variable.
- `GOOGLE_PSI_KEY` (optional) adds Google PageSpeed mobile scores to Site Doctor.
- `STRIPE_*` (optional) turns on self-serve upgrades. Create one recurring price per paid plan and point the webhook at `/api/billing/webhook` with events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

Plans and prices live in `src/lib/config.ts`. The brand name, domain and the done-for-you WhatsApp link are there too.

## Deploy (Railway)

1. New project from this repo. Railway picks up `railway.json` and builds the `Dockerfile`.
2. Add a volume mounted at `/data` (the image sets `DATABASE_PATH=/data/marketingrx.db`).
3. Set `ANTHROPIC_API_KEY`, `ADMIN_SETUP_TOKEN`, `APP_URL=https://marketingrx.ai`, and Stripe keys if billing is on.
4. Point marketingrx.ai at the service under Settings > Networking > Custom domain.

SQLite on one instance is fine for the first few hundred businesses. Agent runs execute in the web process; if you scale to multiple instances, move the database to Postgres and runs to a queue first.

## Tests

```bash
npm run build
npx playwright test     # signup, onboarding, Site Doctor on a local fixture site, prescriptions, chat, admin claim, auth and cross-site checks
npm run test:live       # every specialist's live AI path against a local mock of the Claude API (tests/mock-anthropic)
```

`test:live` checks request shapes, response handling and report rendering. It can't prove answer quality, so run one real checkup per specialist after adding the API key.

## Demo account

```bash
SEED_SITE_URL=https://a-real-site.sg npm run seed   # prints the login for a sample clinic with one report per specialist
```

## Limits and safety

- Plans set monthly agent runs and Ask PULSE messages (`src/lib/config.ts`). Failed runs don't count; deleting a report doesn't give the run back.
- Two checkups can run at once per business, each with a 15-minute deadline.
- Website fetching pins DNS and refuses private, loopback, link-local and cloud metadata addresses.
- Login and signup are rate limited per IP and per email; cross-site writes are rejected.
- Not built yet: email verification and password reset. Add both before opening signups widely.

## Code map

- `src/lib/agents/*` one file per specialist (`AgentDef`: parseInput, run with Claude, demo without). `site-audit.ts` is the crawler.
- `src/lib/ai.ts` Claude calls: `structured()` (schema-validated output), `research()` (web search), `chatStream()`. House rules shared by every agent live here.
- `src/lib/runs.ts` run execution, plan limits, prescriptions to tasks, Pulse Score.
- `src/components/forms/*` and `src/components/reports/*` one form and one report per specialist.
- `src/lib/safe-fetch.ts` fetches customer websites without letting anyone reach internal network addresses.
