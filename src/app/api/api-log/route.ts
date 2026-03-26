import { NextRequest, NextResponse } from 'next/server';
import { getApiCallLog, getApiCallSummary } from '@/lib/db/bom-store';
import { initSchema } from '@/lib/db/schema';

/**
 * GET /api/api-log
 *
 * Returns API call audit log — every external vendor API call bom-watch has made.
 * Use ?summary=true for an aggregated overview (totals, daily breakdown, per-vendor counts).
 * Use ?limit=N to control how many log entries to return (default 100).
 */
export async function GET(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: 'Database not configured — no API logs available' },
      { status: 503 }
    );
  }

  try {
    await initSchema();

    const { searchParams } = new URL(req.url);
    const wantSummary = searchParams.get('summary') === 'true';

    if (wantSummary) {
      const summary = await getApiCallSummary();
      return NextResponse.json(summary);
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '100') || 100, 500);
    const log = await getApiCallLog(limit);
    return NextResponse.json({ entries: log, count: log.length });
  } catch (error) {
    console.error('[API Log] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve API log' },
      { status: 500 }
    );
  }
}
