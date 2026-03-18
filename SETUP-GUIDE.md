# BOM Watch — IT Setup Guide

> What the TAs / IT team need to do to make BOM Watch fully functional with live Arena PLM data.

## Quick Summary

BOM Watch is a Next.js app deployed on Vercel. It needs **3 connections** to go from demo → live:

1. **Arena PLM Webhook** — pushes new BOMs to BOM Watch automatically
2. **Vendor API Keys** (optional phase 2) — live pricing from McMaster, Grainger, etc.
3. **Slack Webhook** (optional) — send savings alerts to a Slack channel

The app works fully in demo mode with realistic sample data for presentation purposes.

---

## 1. Arena PLM Webhook Setup

**What it does:** When a BOM is approved or an ECO is released in Arena, it fires a webhook to BOM Watch, which then analyzes the BOM for cost savings.

### Steps:

1. **In Arena:** Go to Settings → Integrations → Webhooks
2. **Create a new webhook** with:
   - **URL:** `https://bom-watch.vercel.app/api/webhook`
   - **Events:** `item.bom.approved`, `change.released`
   - **Method:** POST
   - **Content-Type:** application/json
3. **Test it:** Arena should have a "Send test event" button — click it and check that BOM Watch receives it (check Vercel Function Logs)

### Verify it's working:

```bash
# Quick health check — should return {"service":"BOM Watch","status":"active"}
curl https://bom-watch.vercel.app/api/webhook
```

### Arena webhook payload we expect:

```json
{
  "event": "item.bom.approved",
  "timestamp": "2026-03-18T12:00:00Z",
  "data": {
    "guid": "...",
    "number": "500-00123",
    "name": "Gripper Assembly v3.2",
    "category": "Assembly",
    "owner": {
      "fullName": "Sarah Chen",
      "email": "sarah.chen@mytra.com"
    },
    "bom": {
      "lineItems": [
        {
          "lineNumber": 1,
          "item": {
            "guid": "...",
            "number": "MCM-91251A123",
            "name": "Socket Head Cap Screw",
            "description": "18-8 SS, M5 x 0.8mm, 20mm",
            "category": "Fastener",
            "uom": "EA"
          },
          "quantity": 24
        }
      ]
    }
  }
}
```

### What I need from Arena admin:
- [ ] Webhook URL registered and active
- [ ] Test event sent successfully
- [ ] (Optional) Webhook secret for signature verification — set as `ARENA_WEBHOOK_SECRET` env var in Vercel

---

## 2. Environment Variables (Vercel)

Set these in Vercel → Project → Settings → Environment Variables:

| Variable | Required | Description |
|---|---|---|
| `ARENA_API_KEY` | For live mode | Arena API key — when set, dashboard shows "ARENA CONNECTED" instead of "DEMO MODE" |
| `ARENA_WEBHOOK_SECRET` | Optional | Webhook signature verification secret |
| `ANTHROPIC_API_KEY` | Phase 2 | Claude API key for AI-powered part classification and analysis |
| `SLACK_WEBHOOK_URL` | Optional | Slack incoming webhook URL for savings notifications |

### How to set env vars in Vercel:
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard) → select `bom-watch` project
2. Settings → Environment Variables
3. Add each variable for Production + Preview environments
4. Redeploy after adding variables (Settings → Deployments → Redeploy)

---

## 3. Slack Integration (Optional)

**What it does:** Sends a Slack message when a new BOM is detected with estimated savings.

### Steps:
1. Go to [api.slack.com/apps](https://api.slack.com/apps) → Create New App
2. Add Incoming Webhooks feature
3. Create webhook for the desired channel (e.g. #procurement or #engineering)
4. Copy the webhook URL → set as `SLACK_WEBHOOK_URL` in Vercel

### Example Slack message:
> 🔍 **New BOM Detected** — Gripper Assembly v3.2 (500-00123)
> 5 line items · Engineer: Sarah Chen
> View analysis: https://bom-watch.vercel.app

---

## 4. Vendor APIs (Phase 2 — Not Required for Hackathon)

For live pricing comparison, these APIs would need to be connected:

| Vendor | API | Notes |
|---|---|---|
| McMaster-Carr | No public API | Scraping or manual price entry |
| Grainger | [Grainger API](https://developer.grainger.com/) | Requires business account |
| DigiKey | [DigiKey API](https://developer.digikey.com/) | Free tier available |
| Mouser | [Mouser API](https://www.mouser.com/api-hub/) | Free tier available |

**For the hackathon:** Demo pricing data is realistic and sufficient. Live vendor APIs are a natural Phase 2 enhancement.

---

## Architecture Overview

```
Arena PLM (webhook) → Vercel API Route → Claude AI Analysis → Dashboard
                                                           → Slack Alert
                                                           
Manual Entry (UI) → Vercel API Route → Claude AI Analysis → Dashboard
```

**Stack:**
- **Frontend:** Next.js 16 + React 19 + Tailwind CSS + Recharts
- **Hosting:** Vercel (serverless)
- **AI:** Claude API (Anthropic) for BOM classification and analysis
- **Data:** Currently in-memory; production would use Vercel Postgres or KV

---

## FAQ for TAs

**Q: Does it work without Arena connected?**
A: Yes — the dashboard runs fully with demo data and manual BOM entry. Arena connection makes it automated.

**Q: What permissions does the Arena webhook need?**
A: Read access to BOM data. The webhook only receives data; BOM Watch never writes back to Arena.

**Q: Can we test without modifying production Arena?**
A: Yes — use the manual BOM entry feature, or `curl` the webhook endpoint with a test payload:

```bash
curl -X POST https://bom-watch.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "item.bom.approved",
    "timestamp": "2026-03-18T12:00:00Z",
    "data": {
      "guid": "test-001",
      "number": "TEST-BOM-001",
      "name": "Test Assembly",
      "category": "Assembly",
      "owner": { "fullName": "Test User", "email": "test@mytra.com" },
      "bom": {
        "lineItems": [
          { "lineNumber": 1, "item": { "guid": "p1", "number": "MCM-91251A123", "name": "Cap Screw", "description": "M5 Socket Head", "category": "Fastener", "uom": "EA" }, "quantity": 24 }
        ]
      }
    }
  }'
```

**Q: Is any data stored?**
A: Currently no persistent storage — data lives in memory per session. Production version would use Vercel Postgres.

**Q: What's the cost?**
A: Vercel free tier covers the hosting. Claude API usage would be ~$0.01-0.05 per BOM analysis.

---

## Contact

Built by Mark Starr — EHS @ Mytra
Hackathon 2026
