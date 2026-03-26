/**
 * Database schema for BOM Watch
 *
 * Run initSchema() once to create tables. It uses IF NOT EXISTS
 * so it's safe to call on every cold start.
 */

import { getDb } from './index';

let schemaInitialized = false;

export async function initSchema() {
  if (schemaInitialized) return;
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS bom_analyses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      engineer TEXT DEFAULT '',
      approved_at TIMESTAMPTZ DEFAULT NOW(),
      status TEXT DEFAULT 'analyzed',
      source TEXT DEFAULT 'manual',
      total_savings NUMERIC(12,2) DEFAULT 0,
      items JSONB NOT NULL DEFAULT '[]',
      vendors_queried TEXT[] DEFAULT '{}',
      mode TEXT DEFAULT 'simulated',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS price_history (
      id SERIAL PRIMARY KEY,
      part_number TEXT NOT NULL,
      vendor TEXT NOT NULL,
      unit_price NUMERIC(12,4),
      source TEXT,
      checked_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_price_history_part
    ON price_history (part_number, checked_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_bom_analyses_created
    ON bom_analyses (created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS api_call_log (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'manual',
      parts_count INTEGER NOT NULL,
      vendor_calls JSONB NOT NULL DEFAULT '{}',
      total_external_calls INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_api_call_log_created
    ON api_call_log (created_at DESC)
  `;

  schemaInitialized = true;
}
