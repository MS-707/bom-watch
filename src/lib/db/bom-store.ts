/**
 * BOM persistence — save and retrieve BOM analyses
 */

import { getDb } from './index';

export interface StoredBom {
  id: string;
  name: string;
  engineer: string;
  approvedAt: string;
  status: string;
  source: string;
  totalSavings: number;
  items: unknown[];
  vendorsQueried: string[];
  mode: string;
  createdAt: string;
}

export async function saveBomAnalysis(bom: {
  id: string;
  name: string;
  engineer?: string;
  status?: string;
  source?: string;
  totalSavings: number;
  items: unknown[];
  vendorsQueried?: string[];
  mode?: string;
}): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO bom_analyses (id, name, engineer, status, source, total_savings, items, vendors_queried, mode)
    VALUES (
      ${bom.id},
      ${bom.name},
      ${bom.engineer || ''},
      ${bom.status || 'analyzed'},
      ${bom.source || 'manual'},
      ${bom.totalSavings},
      ${JSON.stringify(bom.items)},
      ${bom.vendorsQueried || []},
      ${bom.mode || 'simulated'}
    )
    ON CONFLICT (id) DO UPDATE SET
      total_savings = EXCLUDED.total_savings,
      items = EXCLUDED.items,
      vendors_queried = EXCLUDED.vendors_queried,
      mode = EXCLUDED.mode,
      status = EXCLUDED.status,
      updated_at = NOW()
  `;
}

export async function listBomAnalyses(limit = 50): Promise<StoredBom[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, name, engineer, approved_at, status, source, total_savings, items, vendors_queried, mode, created_at
    FROM bom_analyses
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    engineer: row.engineer as string,
    approvedAt: (row.approved_at as Date).toISOString(),
    status: row.status as string,
    source: row.source as string,
    totalSavings: Number(row.total_savings),
    items: row.items as unknown[],
    vendorsQueried: row.vendors_queried as string[],
    mode: row.mode as string,
    createdAt: (row.created_at as Date).toISOString(),
  }));
}

export async function getBomAnalysis(id: string): Promise<StoredBom | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, name, engineer, approved_at, status, source, total_savings, items, vendors_queried, mode, created_at
    FROM bom_analyses
    WHERE id = ${id}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id as string,
    name: row.name as string,
    engineer: row.engineer as string,
    approvedAt: (row.approved_at as Date).toISOString(),
    status: row.status as string,
    source: row.source as string,
    totalSavings: Number(row.total_savings),
    items: row.items as unknown[],
    vendorsQueried: row.vendors_queried as string[],
    mode: row.mode as string,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function savePriceCheck(
  partNumber: string,
  vendor: string,
  unitPrice: number | null,
  source: string
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO price_history (part_number, vendor, unit_price, source)
    VALUES (${partNumber}, ${vendor}, ${unitPrice}, ${source})
  `;
}

export interface ApiCallLogEntry {
  id: number;
  source: string;
  partsCount: number;
  vendorCalls: Record<string, number>;
  totalExternalCalls: number;
  createdAt: string;
}

export async function saveApiCallLog(
  source: string,
  partsCount: number,
  vendorCalls: Record<string, number>,
  totalExternalCalls: number,
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO api_call_log (source, parts_count, vendor_calls, total_external_calls)
    VALUES (${source}, ${partsCount}, ${JSON.stringify(vendorCalls)}, ${totalExternalCalls})
  `;
}

export async function getApiCallLog(limit = 100): Promise<ApiCallLogEntry[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT id, source, parts_count, vendor_calls, total_external_calls, created_at
    FROM api_call_log
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(row => ({
    id: row.id as number,
    source: row.source as string,
    partsCount: row.parts_count as number,
    vendorCalls: row.vendor_calls as Record<string, number>,
    totalExternalCalls: row.total_external_calls as number,
    createdAt: (row.created_at as Date).toISOString(),
  }));
}

export async function getApiCallSummary(): Promise<{
  totalRequests: number;
  totalApiCalls: number;
  totalPartsAnalyzed: number;
  callsByVendor: Record<string, number>;
  last30Days: { date: string; calls: number }[];
}> {
  const sql = getDb();

  const totals = await sql`
    SELECT
      COUNT(*)::int AS total_requests,
      COALESCE(SUM(total_external_calls), 0)::int AS total_api_calls,
      COALESCE(SUM(parts_count), 0)::int AS total_parts
    FROM api_call_log
  `;

  const daily = await sql`
    SELECT
      DATE(created_at) AS day,
      SUM(total_external_calls)::int AS calls
    FROM api_call_log
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY day DESC
  `;

  const allLogs = await sql`
    SELECT vendor_calls FROM api_call_log
  `;
  const callsByVendor: Record<string, number> = {};
  for (const row of allLogs) {
    const vc = row.vendor_calls as Record<string, number>;
    for (const [vendor, count] of Object.entries(vc)) {
      callsByVendor[vendor] = (callsByVendor[vendor] || 0) + count;
    }
  }

  return {
    totalRequests: totals[0].total_requests as number,
    totalApiCalls: totals[0].total_api_calls as number,
    totalPartsAnalyzed: totals[0].total_parts as number,
    callsByVendor,
    last30Days: daily.map(r => ({ date: (r.day as Date).toISOString().slice(0, 10), calls: r.calls as number })),
  };
}

export async function savePriceCheckBatch(rows: Array<{partNumber: string, vendor: string, unitPrice: number | null, source: string}>) {
  if (rows.length === 0) return;
  const sql = getDb();
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const jsonRows = batch.map(r => ({
      part_number: r.partNumber,
      vendor: r.vendor,
      unit_price: r.unitPrice,
      source: r.source,
    }));
    await sql`
      INSERT INTO price_history (part_number, vendor, unit_price, source)
      SELECT * FROM json_to_recordset(${JSON.stringify(jsonRows)}::json)
      AS t(part_number text, vendor text, unit_price numeric, source text)
    `;
  }
}
