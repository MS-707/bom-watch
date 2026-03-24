import { NextRequest, NextResponse } from 'next/server';

/**
 * Arena PLM Webhook Handler
 * 
 * Arena fires this when a BOM is approved or an ECO is released.
 * Configure in Arena: Settings → Integrations → Webhooks
 * URL: https://bom-watch.vercel.app/api/webhook
 * Events: item.bom.approved, change.released
 * 
 * Payload includes: item number, BOM line items, approval info
 */

// TODO: Replace with actual Arena webhook secret
const ARENA_WEBHOOK_SECRET = process.env.ARENA_WEBHOOK_SECRET || '';

interface ArenaWebhookPayload {
  event: string;
  timestamp: string;
  data: {
    guid: string;
    number: string;
    name: string;
    category: string;
    owner: {
      fullName: string;
      email: string;
    };
    bom?: {
      lineItems: Array<{
        lineNumber: number;
        item: {
          guid: string;
          number: string;
          name: string;
          description: string;
          category: string;
          uom: string;
        };
        quantity: number;
        refDesignators?: string;
        notes?: string;
      }>;
    };
  };
}

export async function POST(req: NextRequest) {
  try {
    // Verify webhook authentication
    if (!ARENA_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 503 }
      );
    }

    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${ARENA_WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload: ArenaWebhookPayload = await req.json();

    console.log(`[BOM Watch] Webhook received: ${payload.event} for ${payload.data.number}`);

    // Step 1: Extract new OTS parts from BOM
    const lineItems = payload.data.bom?.lineItems || [];
    
    // Step 2: Classify parts with Claude AI
    // TODO: Call Claude API to classify OTS vs custom parts
    // const classification = await classifyParts(lineItems);

    // Step 3: Fetch vendor pricing for OTS parts
    // TODO: Query DigiKey, Mouser, Grainger APIs
    // const pricing = await fetchVendorPricing(classification.otsParts);

    // Step 4: Store results
    // TODO: Write to Vercel Postgres / KV
    // await storeBomAnalysis({ bom: payload.data, classification, pricing });

    // Step 5: Send Slack notification
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🔍 *New BOM Detected* — ${payload.data.name.replace(/[*_~\`<>]/g, '')} (${payload.data.number.replace(/[*_~\`<>]/g, '')})\n${lineItems.length} line items · Engineer: ${(payload.data.owner.fullName || '').replace(/[*_~\`<>]/g, '')}\nView analysis: https://bom-watch.vercel.app`,
          }),
        });
      } catch (slackErr) {
        console.error('[BOM Watch] Slack notification failed:', slackErr);
      }
    }

    return NextResponse.json({ 
      status: 'received',
      bomNumber: payload.data.number,
      lineItems: lineItems.length,
      message: 'BOM queued for analysis'
    });

  } catch (error) {
    console.error('[BOM Watch] Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Health check for Arena webhook verification
export async function GET() {
  return NextResponse.json({ 
    service: 'BOM Watch',
    status: 'active',
    version: '0.2.0',
    webhook: 'arena-plm'
  });
}
