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
