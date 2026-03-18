# BOM Watch — Live Integration Handoff

## What's Ready

The dashboard is functional with demo data and ready to pipe in live feeds.
All UI elements (buttons, filters, search, charts, export) are working.

**Dashboard URL:** https://bom-watch.vercel.app

---

## Integration Points (4 connections needed)

### 1. Arena PLM Webhook

**Endpoint:** `POST https://bom-watch.vercel.app/api/webhook`

**Setup in Arena:**
1. Settings → Integrations → Webhooks
2. URL: `https://bom-watch.vercel.app/api/webhook`
3. Events: `item.bom.approved`, `change.released`
4. Copy the webhook secret

**Environment variable:**
```
ARENA_WEBHOOK_SECRET=<your-secret>
```

**What it does:** When a BOM is approved or ECO released, Arena fires the webhook. The handler receives the payload with line items and queues them for analysis.

**TODO in code:** Signature verification (line ~30 in `webhook/route.ts`), uncomment when Arena provides signing key format.

---

### 2. Claude AI Analysis

**Purpose:** Classify OTS vs custom parts, generate savings recommendations.

**Environment variable:**
```
ANTHROPIC_API_KEY=<your-key>
```

**Integration point:** `webhook/route.ts` Step 2 — after extracting line items, call Claude to:
- Classify parts as OTS (off-the-shelf) vs custom/machined
- Map OTS parts to vendor catalog numbers
- Generate the natural-language analysis shown in the dashboard

**Model recommendation:** Claude 3.5 Sonnet for speed + cost efficiency on classification tasks.

---

### 3. Vendor Pricing APIs

**Purpose:** Fetch live prices from McMaster, Grainger, DigiKey, Mouser.

**Environment variables:**
```
DIGIKEY_CLIENT_ID=<id>
DIGIKEY_CLIENT_SECRET=<secret>
MOUSER_API_KEY=<key>
GRAINGER_API_KEY=<key>
```

**Notes:**
- **DigiKey:** REST API, OAuth2, well-documented. Free tier covers hackathon volume.
- **Mouser:** REST API, API key auth. Search by part number.
- **Grainger:** May need sales rep to enable API access. Fallback: scrape pricing page.
- **McMaster-Carr:** No public API. Options: (a) scrape with authenticated session, (b) use cached pricing from last PO, (c) manual baseline entry.

**Integration point:** `webhook/route.ts` Step 3.

---

### 4. Slack Notifications

**Purpose:** Alert procurement/engineering when savings are found.

**Environment variable:**
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
```

**Setup:** Create incoming webhook in Slack workspace → pick a channel (#procurement or #engineering).

**Already wired:** The webhook handler sends a formatted Slack message when `SLACK_WEBHOOK_URL` is set.

---

## Setting Environment Variables on Vercel

```bash
cd builds/bom-watch
vercel env add ARENA_WEBHOOK_SECRET
vercel env add ANTHROPIC_API_KEY
vercel env add SLACK_WEBHOOK_URL
vercel env add DIGIKEY_CLIENT_ID
vercel env add DIGIKEY_CLIENT_SECRET
vercel env add MOUSER_API_KEY
```

Or via Vercel Dashboard → Project Settings → Environment Variables.

---

## Dashboard Features (all functional)

| Feature | Status | Notes |
|---------|--------|-------|
| KPI cards (savings, BOMs, avg, speed) | ✅ Working | Updates from API |
| Savings trend chart | ✅ Working | Animated area chart |
| Vendor distribution pie | ✅ Working | With consolidation alert |
| BOM alert banner | ✅ Working | Dismissible, links to analysis |
| Search & filter | ✅ Working | By name, ID, engineer, status |
| Price comparison table | ✅ Working | Green=cheapest, red=most expensive |
| Copy to clipboard | ✅ Working | Tab-delimited for spreadsheet paste |
| Export CSV | ✅ Working | Downloads per-BOM CSV file |
| Refresh button | ✅ Working | Manual + auto-refresh every 60s |
| Connection status | ✅ Working | Shows DEMO MODE vs ARENA CONNECTED |
| Mobile responsive | ✅ Working | Tested on iPhone viewport |
| How It Works section | ✅ Working | 4-step visual explainer |
| Claude AI analysis | ✅ Working | Inline recommendations per BOM |

## Data Flow (when live)

```
Arena PLM → Webhook → Claude AI → Vendor APIs → Dashboard + Slack
                                                    ↑
                                          Auto-refresh 60s
```

## Demo Mode

When `ARENA_API_KEY` is not set, the dashboard shows "DEMO MODE" badge and serves mock data.
This is the current state — all UI is functional with realistic sample data.
Judges can interact with everything; live data connection is the handoff to engineering.

---

## Architecture

- **Framework:** Next.js 15 + React 19
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts
- **Hosting:** Vercel (serverless)
- **AI:** Claude API (classification + analysis)
- **Data:** API routes (mock now, Vercel Postgres for production)

## Version

v0.4.0 — Hackathon build, March 2026
