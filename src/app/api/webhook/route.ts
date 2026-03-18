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
    const payload: ArenaWebhookPayload = await req.json();

    // TODO: Verify webhook signature when Arena provides one
    // const signature = req.headers.get('x-arena-signature');
    // if (!verifySignature(payload, signature, ARENA_WEBHOOK_SECRET)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

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
    // TODO: Fire Slack webhook with savings summary
    // await notifySlack({ bom: payload.data, savings: pricing.totalSavings });

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
