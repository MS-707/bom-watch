import { NextRequest, NextResponse } from 'next/server';
import { priceParts } from '@/lib/vendors';
import type { PricingRequest } from '@/lib/vendors';

// Allow up to 60 seconds for vendor API + Claude AI web search queries
export const maxDuration = 60;

/**
 * POST /api/pricing
 * 
 * Accepts a list of part numbers and returns vendor price comparisons.
 * Queries DigiKey, Mouser, Grainger APIs in parallel.
 * Falls back to intelligent simulation when APIs aren't configured.
 * 
 * Request body:
 * {
 *   "items": [
 *     { "partNumber": "MCM-91251A123", "description": "Socket Head Cap Screw", "qty": 24 },
 *     { "partNumber": "1N4148W-FDICT", "qty": 50 }
 *   ]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body: PricingRequest = await req.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Request must include a non-empty items array' },
        { status: 400 }
      );
    }

    // Cap at 50 items per request
    if (body.items.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 items per request' },
        { status: 400 }
      );
    }

    // Validate items
    const validItems = body.items.map(item => ({
      partNumber: String(item.partNumber || '').trim(),
      description: String(item.description || '').trim(),
      qty: Math.max(1, parseInt(String(item.qty)) || 1),
    })).filter(item => item.partNumber.length > 0);

    if (validItems.length === 0) {
      return NextResponse.json(
        { error: 'No valid part numbers provided' },
        { status: 400 }
      );
    }

    const result = await priceParts({ items: validItems });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Pricing API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
