# MarketingRx

A do-it-yourself AI marketing suite by PULSE Digital. Business owners get a checkup from six AI specialists, receive a prescription of fixes with step-by-step instructions, and implement the changes themselves. Domain: **marketingrx.ai**.

## What's inside

| Area | What it does |
| --- | --- |
| Chart (dashboard) | Pulse Score (website, AI visibility, ads health, fixes done), score trend, next prescriptions, specialists |
| Site Doctor | Crawls the homepage + up to 6 inner pages. 25 checks across technical, on-page, conversion, tracking and AI search. Platform-aware fix steps (WordPress, Shopify, Wix, Squarespace, Webflow). Rewrites title/meta/H1 and drafts FAQs |
| Keyword Lab | SEO keyword clusters, AEO questions, content briefs, quick wins from the connected Search Console (last 90 days) or pasted exports. Every keyword can be expanded into a deeper drill-down |
| AI Visibility | Asks AI-assistant-style questions with live web search, checks whether the business is named or cited, share of voice vs competitors, which sources AI pulls from |
| Social Media Content | Trend research with the real posts it found (play in place; view counts and dates only when the source showed them), content pillars, ready-to-post ideas (hook, script, caption, hashtags), 2-week calendar, "more like this" |
| Pro: several businesses | Up to 5 businesses or locations on one login (`users.current_workspace_id`, switcher in the sidebar). The first business holds the plan and billing; the others inherit it and share the monthly reports |
| Pro: autopilot | `src/lib/autopilot.ts`, started from `src/instrumentation.ts`: hourly check that starts a Site Doctor re-check every 7 days and an AI Visibility re-check every 30 days (from the owner's last questions). Uses the plan's reports; switch off per business in Settings, or for the whole server with `AUTOPILOT=off` |
| Download as PDF | Paid plans: "Download PDF" on every report uses the browser's print to PDF, with print styles in `globals.css` |
| Promo codes | `/admin#promos`: create codes that put an account on a plan for free for a set number of days (or until ended), with a use limit, a last day to redeem and a private note. Share `/signup?code=CODE`, or people type the code at signup or in Settings. See who used each code and end anyone's access. No billing involved: the higher of the paid plan and the promo plan applies (`src/lib/promos.ts`). For discounts on paid plans use Stripe promotion codes, which checkout already accepts |
| Specialist memory | Approve, comment on or reject any content idea or trend, or leave a note on any report. Each specialist reads its notes before it runs (`src/lib/memory.ts`). Owners see and forget notes in Settings |
| Ads Doctor | Google Ads and Meta Ads from CSV exports or live read-only sync from the owner's connected accounts. Computes CPA/CTR/frequency flags against the account's own averages, wasted search terms, pause/scale lists, RSA headline ideas |
| Compliance Check | Pre-checks ad copy and landing pages against SG healthcare advertising rules, ASAS, Meta and Google ad policies, with compliant rewrites |
| Ask PULSE | Streaming strategist chat that has read the profile, latest reports and open prescriptions |
| Connected accounts | `/app/settings/connections`: owners connect Google (Google Ads + Search Console) and Meta (Facebook and Instagram ads) with one click, pick which accounts we read, disconnect any time |
| Prescriptions board | Every recommendation as a task: open / done / not relevant, filter by specialist, "Rather have PULSE do it?" upsell on every card |
| Help chat | `/app/help` on every plan: owners message the PULSE team, admins reply at `/admin/support`. One thread per business (`src/lib/support.ts`), unread replies badged on Help. Pro gets a WhatsApp button when `SUPPORT_WHATSAPP` is set; optional WhatsApp alert to the team on new messages (`src/lib/whatsapp.ts`, env in `.env.example`) |
| Website changes by PULSE | Add-on for Growth and Pro (S$299 a month in Singapore, `prices.webcare` in `src/lib/markets.ts`). Owners add it on `/app/website-changes` (a Stripe item on the plan subscription, `metadata.kind = "webcare"`, prorated like extra outlets; without Stripe the button says to email us), save their website login once (password encrypted with `ENCRYPTION_KEY`, never sent back to the browser) and send two rounds of changes a month, as many changes as they want in each, typed in or picked from their prescriptions. Rounds are counted across the whole login, Singapore calendar month. Each round emails the team (`TEAM_EMAIL`) with the changes, login page and username, and alerts `SUPPORT_NOTIFY_NUMBERS` on WhatsApp when that's set up. The team works rounds at `/admin/website-changes`, reveals the password there (each reveal is recorded in `admin_audit`) and marks them done with a note the owner sees. Leaving Growth or Pro drops the add-on. Growth and Pro owners without it see one small offer in the Site Doctor report and on the prescriptions page (`src/components/website-care-nudge.tsx`) |
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
- `STRIPE_SECRET_KEY` turns on self-serve payments: every plan card in Settings gets its own button. New customers go straight to Stripe Checkout and the plan is active the moment they're back; subscribers switch plans on the spot (upgrades charge the prorated difference to their card now, downgrades credit the next invoice); choosing the free plan cancels at the end of the paid month. Prices come from `src/lib/markets.ts` in the customer's currency, so nothing needs setting up in Stripe. Add `STRIPE_WEBHOOK_SECRET` with a webhook to `/api/billing/webhook` (events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`) so renewals, failed payments and cancellations reach the app. `STRIPE_PRICE_*` are optional fixed prices that override the price list.
- `RESEND_API_KEY` and `EMAIL_FROM` (an address on a domain verified in [Resend](https://resend.com)) turn on email, sent by `src/lib/email.ts`. `TEAM_EMAIL` is where team notifications go (default info@pulsedigital.sg). Without them nothing is emailed; website changes rounds are still saved and listed at `/admin/website-changes`. The website changes add-on also needs `ENCRYPTION_KEY` (see below) to store website passwords.

Plans and prices live in `src/lib/config.ts`. The brand name, domain and the enquiry email (used by every contact and done-for-you link) are there too.

## Connecting Google, Meta and TikTok

Owners connect their own Google, Meta and TikTok logins in **Settings > Connected accounts** (`/app/settings/connections`, paid plans only). Ads Doctor then reads Google Ads and Meta Ads performance for the last 7, 14, 30 or 90 days (Growth and Pro plans), Keyword Lab reads the last 90 days of Search Console queries, and the video library reads the owner's own Instagram Reels, Facebook Page videos, YouTube uploads and TikTok videos (see "Video library and transcripts" below). Everything is read-only; the owner makes every change themselves. Tokens are stored encrypted (AES-256-GCM with `ENCRYPTION_KEY`) and never reach the browser or the logs.

Until a provider's env vars are set, its card says "This connection isn't switched on yet. Upload your exports instead." and everything else keeps working. **The approvals below take time (days to weeks)**, so start them early. Until they come through:

- Google: while the OAuth consent screen is in Testing, only the test users you list can connect, and Google expires their refresh tokens after 7 days (they click Reconnect). Without an approved Google Ads developer token, only Google Ads *test* accounts can be read; real accounts show "Google hasn't approved live Google Ads access for this app yet" on the report. Leave `GOOGLE_ADS_DEVELOPER_TOKEN` empty and Google connects for Search Console only.
- Meta: until `ads_read` has Advanced Access through App Review, only people with a role on the Meta app (admins, developers, testers) can connect.

### 1. Encryption key and URL

```bash
openssl rand -base64 32   # put the output in ENCRYPTION_KEY
```

Set `APP_URL` to the exact public URL (for example `https://marketingrx.ai`, no trailing slash). The redirect URIs are built from it:

- Google: `https://marketingrx.ai/api/connect/google/callback`
- Meta: `https://marketingrx.ai/api/connect/meta/callback`
- TikTok: `https://marketingrx.ai/api/connect/tiktok/callback`

For local testing also register `http://localhost:3000/api/connect/google/callback` and `http://localhost:3000/api/connect/meta/callback`, with `APP_URL=http://localhost:3000`. Open the app on exactly that host, or the sign-in check (state cookie) fails. Don't change `ENCRYPTION_KEY` once owners have connected: stored tokens become unreadable and everyone has to reconnect.

### 2. Google (Google Ads + Search Console)

1. In [Google Cloud Console](https://console.cloud.google.com/) create a project (for example "MarketingRx").
2. **APIs & Services > Library**: enable **Google Ads API** and **Google Search Console API**.
3. **OAuth consent screen** (Google Auth Platform): user type External; app name MarketingRx; support email; app domain and authorised domain `marketingrx.ai`; privacy policy `https://marketingrx.ai/privacy`; terms `https://marketingrx.ai/terms`.
   - Scopes (Data access): `openid`, `email`, `https://www.googleapis.com/auth/adwords`, `https://www.googleapis.com/auth/webmasters.readonly`, `https://www.googleapis.com/auth/youtube.readonly`. Google Ads has no read-only scope; the app only ever reads. Also enable **YouTube Data API v3** in the Library. YouTube is a sensitive scope: until the app is verified Google shows an "unverified app" screen. Set `GOOGLE_YOUTUBE=0` to leave YouTube out.
   - Audience: while in Testing, add each owner who should be able to connect as a test user (up to 100).
   - To open it to everyone, publish the app and submit it for verification. Google reviews apps that ask for these scopes (privacy policy, a short video of the connect flow, domain ownership in Search Console). Plan for days to weeks.
4. **Credentials > Create credentials > OAuth client ID**, type **Web application**. Add the redirect URIs above under **Authorised redirect URIs**. Copy the client ID and secret into `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`.
5. **Google Ads developer token**: sign in to a Google Ads **manager account** (create one at ads.google.com/home/tools/manager-accounts if PULSE doesn't have one), open **Admin > API Center**, complete the form and accept the terms. The token starts at Test Account Access. Apply for **Basic Access** from the same page (describe MarketingRx as a read-only reporting tool for the business owners who connect their own accounts). Put the token in `GOOGLE_ADS_DEVELOPER_TOKEN` once Basic Access is approved; until then leave it empty (Search Console only) or use it with test accounts.
6. `GOOGLE_ADS_LOGIN_CUSTOMER_ID` is normally left empty: when an owner reaches an ad account through their own manager account, the app records that manager and sends it automatically.
7. `GOOGLE_ADS_API_VERSION` defaults to `v22`. Google retires each version about a year after release; check the [sunset dates](https://developers.google.com/google-ads/api/docs/sunset-dates) and set the newest version here when `v22` nears its date. Queries use plain GAQL over REST (`googleAds:searchStream`), so a version bump rarely needs code changes.

What we read: accessible customers (`customers:listAccessibleCustomers`), each account's name and currency, and campaign, ad group, keyword and search term cost, impressions, clicks, conversions, conversion value and search impression share; from Search Console, the property list and the top 1,000 queries (plus query and page) for the last 90 days.

### 3. Meta (Facebook and Instagram ads)

1. In [Meta for Developers](https://developers.facebook.com/apps) create an app of type **Business** and connect it to PULSE Digital's business portfolio.
2. **App settings > Basic**: app domain `marketingrx.ai`, privacy policy URL, terms URL, data deletion instructions URL, category, icon. Copy the App ID and App secret into `META_APP_ID` and `META_APP_SECRET`.
3. Add **Facebook Login for Business**. Under its **Settings**, add the Meta redirect URI above to **Valid OAuth Redirect URIs** and keep **Use Strict Mode for redirect URIs** on.
   - Recommended: create a **Configuration** (login variation: General; token type: User access token; permissions: `ads_read`, `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_manage_insights`) and put its ID in `META_LOGIN_CONFIG_ID`. Without it the app sends those permissions as `scope`, which classic Facebook Login uses. The last four read the owner's Facebook Page videos and Instagram Reels; set `META_ORGANIC=0` to ask for `ads_read` only.
4. Add the **Marketing API** product. `ads_read` works straight away for people with a role on the app (**App roles > Roles**: add owners you want to test with as Testers).
5. **App Review > Permissions and features**: request **Advanced Access** for `ads_read`, `pages_show_list`, `pages_read_engagement`, `instagram_basic` and `instagram_manage_insights` (screencast of connecting and an Ads Doctor report, plus how the data is used). Meta also asks for **Business Verification** of PULSE Digital. Plan for days to weeks. When approved, switch the app to **Live** mode.
6. Optional: `META_BUSINESS_ACCOUNTS=1` also asks for `business_management` so ad accounts owned by an owner's business portfolio are listed even if they aren't assigned to them personally. That permission needs its own App Review; without it, `ads_read` lists the ad accounts the person has a role on, which covers most small businesses.
7. `META_GRAPH_VERSION` defaults to `v23.0` (Meta supports each version for about two years). Set a newer one when Meta announces the end of v23.0.

Meta user tokens last about 60 days. When one expires, the card says "Reconnect needed" and the owner clicks Reconnect.

What we read: the ad account list (`/me/adaccounts`: name, id, currency, status) and campaign, ad set and ad insights for the chosen period (spend, impressions, reach, frequency, clicks, link clicks, actions, action values). Leads, purchases and messaging conversations count as conversions, the same three result types the CSV path counts. With the organic permissions: the Pages the person manages and the Instagram professional account linked to each (`/me/accounts`), each Reel's caption, link, date, likes, comments and views (`/{ig-user}/media`, `/{media}/insights?metric=views`), and each Page video's title, description and length. Instagram only lists professional (business or creator) accounts linked to a Facebook Page.

### 2b. Google Business Profile (Pro)

Pro outlets connect their Google Business Profile through the same Google login and pick their location; the Google Business Profile specialist then checks the profile and writes fixes, a new description, posts and review replies. Google only gives these APIs to approved projects:

1. In the same Google Cloud project, enable **My Business Account Management API**, **My Business Business Information API**, **Google My Business API** (reviews and posts) and **Business Profile Performance API**.
2. Apply for access with Google's [Business Profile API access form](https://developers.google.com/my-business/content/prereqs#request-access), using the project number. Until it's approved the quota is 0 and every call fails.
3. Add the scope `https://www.googleapis.com/auth/business.manage` to the consent screen's Data access, then set `GOOGLE_BUSINESS_PROFILE=1`. Owners who connected Google before then click Reconnect to grant it.

Each outlet picks its own location on its Connected accounts page. What we read: the locations on the person's accounts, and for the picked one its name, categories, description, phone, website, hours, services, the latest 50 reviews with rating and reply status, recent posts, the photo count and the last 30 days of calls, website clicks and direction requests. Nothing is posted or replied to for the owner.

### 3b. TikTok (the owner's own videos)

1. In [TikTok for Developers](https://developers.tiktok.com/) create an app, add **Login Kit** (Web) and the scopes `user.info.basic` and `video.list` (the Display API).
2. Add the TikTok redirect URI above, and the app's domain. Copy the Client key and Client secret into `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET`.
3. Submit the app for review (TikTok checks the privacy policy, terms and a demo of the connect flow). Until it's approved, only the sandbox's target users can connect.

TikTok access tokens last a day and refresh tokens about a year; the app refreshes them itself. What we read: the display name and each video's title, description, link, date, length, views, likes and comments (`/v2/video/list/`).

### Video library and transcripts

When an owner ticks an Instagram account, Facebook Page, YouTube channel or TikTok account, the app reads their latest 100 videos per account into the library (`social_videos`), again whenever a Social Media Content report starts and the library is more than 12 hours old, and on **Read my posts now**. Social Media Content uses their best and latest posts to pick trends and ideas that fit what already works for them, and Keyword Lab articles link the most relevant ones.

Growth transcribes the latest 20 videos and Pro the latest 100, with ElevenLabs speech to text (`ELEVENLABS_API_KEY`; model `scribe_v2` unless `ELEVENLABS_STT_MODEL` says otherwise). Instagram and Facebook share the video file; YouTube and TikTok don't, so for those the specialists use the title and caption. Videos longer than 30 minutes are skipped. Without the key, nothing is transcribed and the card says so.

### 4. How it fits together

- `src/lib/connectors/oauth.ts` provider settings, PKCE, the sealed state cookie, code exchange, Google and TikTok refresh, revoke. `social.ts` lists and reads the organic accounts; `src/lib/social-sync.ts` fills the video library and runs transcription (`src/lib/transcribe.ts`). `store.ts` encrypted tokens and account choices (every query scoped to the workspace). `google-ads.ts`, `meta.ts`, `search-console.ts` fetch and map to the same `AdRow` / `DataRow` shapes the CSV parsers produce, so the analysis code is shared.
- Routes: `GET /api/connect/[provider]/start`, `GET /api/connect/[provider]/callback`, `POST /api/connect/accounts`, `POST /api/connect/[provider]/disconnect` (also revokes access with the provider, best effort, and removes that provider's videos), `POST /api/social/sync`.
- If one provider or account fails during an Ads Doctor run, the report still uses the others and names the one that failed.
- Workspaces that saved a key for the previous sync supplier keep syncing through it while `WINDSOR_API_KEY` is set and they haven't connected Google or Meta. Customers never see the supplier's name. Remove the variable to switch the fallback off.
- `npm run test:connectors` checks the mapping against recorded API responses in `tests/fixtures/connectors`, plus encryption, OAuth state and PKCE. It can't reach Google or Meta, so connect one real account per provider after setup.

## Deploy (Railway)

1. New project from this repo. Railway picks up `railway.json` and builds the `Dockerfile`.
2. Add a volume mounted at `/data` (the image sets `DATABASE_PATH=/data/marketingrx.db`).
3. Set `ANTHROPIC_API_KEY`, `ADMIN_SETUP_TOKEN`, `APP_URL=https://marketingrx.ai`, Stripe keys if billing is on, and `ENCRYPTION_KEY` plus the Google and Meta variables to switch on connected accounts.
4. Point marketingrx.ai at the service under Settings > Networking > Custom domain.

SQLite on one instance is fine for the first few hundred businesses. Agent runs execute in the web process; if you scale to multiple instances, move the database to Postgres and runs to a queue first.

## Tests

```bash
npm run build
npx playwright test     # signup, onboarding, Site Doctor on a local fixture site, prescriptions, chat, admin claim, auth and cross-site checks
npm run test:live       # every specialist's live AI path against a local mock of the Claude API (tests/mock-anthropic)
npm run test:connectors # Google Ads / Meta / Search Console mapping from recorded API responses, token encryption, OAuth state and PKCE
```

`test:live` checks request shapes, response handling and report rendering. It can't prove answer quality, so run one real checkup per specialist after adding the API key.

## Demo account

```bash
SEED_SITE_URL=https://a-real-site.sg npm run seed   # prints the login for a sample clinic with one report per specialist
```

## DDoS and abuse protection

No website can be made impossible to attack. What we can do is make floods cheap to absorb and fast to shut off. Four layers:

1. **Railway's edge** absorbs network-level floods (layer 4 and below) for every service, with no setup.
2. **Per-address limits in the app** (`src/middleware.ts`): every page and API request counts against the visitor's address, 240 pages and 300 API calls a minute by default (`RATE_LIMIT_PAGES_PER_MIN`, `RATE_LIMIT_API_PER_MIN`). Past that they get a 429 before any work is done. Login, signup, the free checkup, feedback and thumbnails have tighter limits of their own.
3. **Server-wide caps on expensive work** (`src/lib/load-guard.ts`, `src/lib/runs.ts`): at most 6 free checkup crawls at once and 40 a minute across everyone (`CHECKUP_MAX_CONCURRENT`, `CHECKUP_MAX_PER_MINUTE`), at most 24 specialist runs at once (`RUNS_MAX_CONCURRENT`), and at most 120 live AI runs an hour from free accounts (`FREE_RUNS_PER_HOUR`). The last one stops a wave of fake sign-ups from running up the Anthropic bill. Paid plans keep their monthly allowances.
4. **Under Attack Mode** for an active attack: Railway > the service > Settings > Edge > Under Attack Mode > Activate (or `railway waf under-attack enable --service marketingrx --duration 1h`). Every new visitor gets a browser check before reaching the app. While it is on, non-browser traffic is turned away, including Stripe webhooks (Stripe retries them for up to 3 days, so nothing is lost if you switch it off within that time).

**After buying the domain, put Cloudflare in front.** This is the strongest layer, and the free plan is enough:

1. Add the domain to Cloudflare and point it at the Railway service with the orange cloud (proxied) on.
2. Make up a long random secret. In Cloudflare > Rules > Transform Rules > Modify request header, add `x-origin-key` set to that secret on every request.
3. Set the same secret as `CLOUDFLARE_ORIGIN_KEY` on Railway. The app then reads the visitor's real address from `cf-connecting-ip`, and only on requests that carry the secret, so nobody can fake their address.
4. In Railway > Settings > Edge > Edge Rules, block requests whose `x-origin-key` header is not the secret. That closes the side door: attackers can no longer skip Cloudflare by hitting the `*.up.railway.app` address directly.
5. Optional: a Cloudflare rate-limiting rule on `/api/*`, and Bot Fight Mode.

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
