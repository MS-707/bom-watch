# BOM Watch — Live Data Architecture

## How It Works (Production)

```
Arena PLM ──webhook──▶ /api/webhook ──▶ Claude AI (classify) ──▶ Vendor APIs (price) ──▶ Vercel Postgres
                                                                                              │
Dashboard ◀──reads──────────────────────────────────────────────────────────────────────────────┘
                                                                                              │
Slack ◀──webhook───────────────────────────────────────────────────────────────────────────────┘
```

## Step-by-Step: Making It Live

### 1. Arena PLM Webhook (30 min)
- Arena Settings → Integrations → Webhooks
- URL: `https://bom-watch.vercel.app/api/webhook`
- Events: `item.bom.approved`, `change.released`
- Arena sends JSON with item number, BOM line items, owner info
- **Docs:** https://www.arenasolutions.com/platform/api/
- **Auth:** Arena uses API keys (not OAuth). Generate in Arena Admin.

### 2. Vercel Postgres (15 min)
- `vercel storage create postgres bom-watch-db`
- Auto-creates `POSTGRES_URL` env var
- Schema: `boms` table + `bom_items` table + `vendor_prices` table
- Could also use Vercel KV (Redis) for simpler key-value if you want fast iteration

### 3. Claude AI Classification (30 min)
- When webhook fires, send BOM line items to Claude
- Prompt: "Classify these BOM items as OTS (off-the-shelf) or custom. For OTS items, identify the vendor category (fastener, electronic, raw material, bearing, etc.)"
- Claude returns structured JSON
- Use `@anthropic-ai/sdk` — already have a Claude subscription

### 4. Vendor Pricing APIs (1-2 hours)
| Vendor | API | Auth | Notes |
|--------|-----|------|-------|
| **DigiKey** | REST API v4 | OAuth2 + API Key | Free tier: 1000 req/day. Excellent part search. |
| **Mouser** | Search API v2 | API Key | Free. Good for electronics. |
| **Grainger** | Product API | API Key (apply) | Need to request access. Good for MRO/industrial. |
| **McMaster-Carr** | ❌ No public API | N/A | Scrape, use saved pricing, or manual entry. McMaster actively blocks automation. |

**Realistic approach for hackathon:**
- DigiKey + Mouser are quick wins (free API keys, good docs)
- Grainger requires application but is worth it for MRO savings
- McMaster: hardcode current pricing or use a price sheet export

### 5. Slack Integration (15 min)
- Create Slack app → Incoming Webhooks
- Fire webhook from `/api/webhook` after analysis completes
- Message format: BOM name, engineer, # new parts, total savings, link to dashboard

### 6. Dashboard → Live Data (30 min)
- Replace mock data imports with `fetch('/api/boms')`
- Add SWR or React Query for auto-refresh
- The API route (`/api/boms`) already returns the same shape the dashboard expects

## Environment Variables Needed

```env
# Arena PLM
ARENA_API_KEY=          # From Arena Admin → API Keys
ARENA_WORKSPACE_ID=     # Your Arena workspace ID
ARENA_WEBHOOK_SECRET=   # For webhook signature verification

# Vendor APIs
DIGIKEY_CLIENT_ID=      # DigiKey Developer Portal
DIGIKEY_CLIENT_SECRET=
MOUSER_API_KEY=         # Mouser API Portal
GRAINGER_API_KEY=       # Grainger Developer Portal (if approved)

# Claude AI
ANTHROPIC_API_KEY=      # For part classification

# Slack
SLACK_WEBHOOK_URL=      # Slack app incoming webhook

# Database
POSTGRES_URL=           # Auto-set by Vercel Storage
```

## Estimated Time to Live Data

| Task | Time | Priority |
|------|------|----------|
| Arena webhook + route handler | 30 min | P0 |
| Vercel Postgres setup + schema | 15 min | P0 |
| Claude AI classification | 30 min | P0 |
| DigiKey API integration | 45 min | P1 |
| Mouser API integration | 30 min | P1 |
| Dashboard → API fetch | 30 min | P0 |
| Slack notifications | 15 min | P2 |
| Grainger API (if approved) | 45 min | P2 |
| **Total MVP (P0 only)** | **~2 hours** | |
| **Full pipeline** | **~4 hours** | |

## What's Already Built

✅ Dashboard with all UI components
✅ API route stubs (`/api/webhook`, `/api/boms`)
✅ Data shape matches between API and frontend
✅ Search, filter, expand, dismiss all working
✅ Charts (savings trend, vendor distribution)
✅ Mobile responsive
✅ Deployed on Vercel

## What Needs Wiring

- [ ] Arena webhook → actual parsing (route exists, just needs real payload handling)
- [ ] Claude API call in webhook handler
- [ ] DigiKey/Mouser API clients
- [ ] Database (Vercel Postgres or KV)
- [ ] Dashboard `fetch()` calls instead of imported mock data
- [ ] Slack webhook notification
