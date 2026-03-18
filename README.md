# BOM Watch — Procurement Intelligence

AI-powered BOM change detection and vendor price comparison for Arena PLM.

Built for the Mytra Hackathon 2026.

## What It Does

1. **Detects** new BOM approvals via Arena PLM webhook
2. **Analyzes** OTS parts using Claude AI classification
3. **Compares** pricing across McMaster-Carr, Grainger, DigiKey, and Mouser
4. **Saves** money by recommending optimal vendors per part

## Architecture

```
Arena PLM → Webhook → BOM Watch API → Vendor Pricing Engine → Dashboard
                                           ├── DigiKey API v4 (OAuth2)
                                           ├── Mouser Search API (API key)
                                           ├── Grainger (API or simulation)
                                           └── McMaster-Carr (no API — baseline pricing)
```

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Vendor API Configuration

Set these environment variables (in `.env.local` or Vercel dashboard):

### DigiKey (free — electronic components)
```
DIGIKEY_CLIENT_ID=your_client_id
DIGIKEY_CLIENT_SECRET=your_client_secret
DIGIKEY_SANDBOX=true          # Set to false for production
```
Register at https://developer.digikey.com — takes 5 minutes.

### Mouser (free — electronic components)
```
MOUSER_API_KEY=your_search_api_key
```
Register at https://www.mouser.com/api-hub/ — separate key for Search API vs Cart API.

### Grainger (requires business account)
```
GRAINGER_API_KEY=your_api_key
GRAINGER_ACCOUNT_ID=your_account_id
```
Ask your procurement team for API access via https://developer.grainger.com

### McMaster-Carr
No API available. McMaster-Carr does not offer programmatic access.
Pricing is derived from BOM data or intelligent estimation.

### Arena PLM
```
ARENA_API_KEY=your_arena_key
ARENA_WEBHOOK_SECRET=your_webhook_secret
```
Configure webhook in Arena: Settings → Integrations → Webhooks.

### Slack Notifications
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## Demo Mode

Without any API keys configured, the app runs in demo mode with:
- Realistic sample BOMs with actual part numbers
- Simulated vendor pricing with category-aware margins
- Full UI functionality including manual BOM entry

## Manual BOM Entry

Click "+ New BOM" to paste part numbers directly (from Notion, spreadsheets, etc.).
Supports:
- Tab-separated: `MCM-91251A123  Socket Head Cap Screw  24`
- Comma-separated: `MCM-91251A123, Socket Head Cap Screw, 24`
- One part number per line (quantity defaults to 1)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/boms` | GET | List analyzed BOMs with pricing data |
| `/api/pricing` | POST | Price a list of part numbers across all vendors |
| `/api/webhook` | POST | Arena PLM webhook handler |
| `/api/webhook` | GET | Health check for Arena verification |

## Tech Stack

- **Framework**: Next.js 16 + React 19
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts
- **Icons**: Lucide React
- **Deployment**: Vercel
- **AI**: Claude API (for part classification)

## License

Internal project — Mytra Hackathon 2026.
