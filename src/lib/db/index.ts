/**
 * Database client for Neon Postgres (via Vercel Marketplace)
 *
 * Uses @neondatabase/serverless for connection pooling on Vercel.
 * DATABASE_URL is auto-injected by the Neon integration.
 */

import { neon } from '@neondatabase/serverless';

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not configured — install Neon from Vercel Marketplace');
  return neon(url);
}

export { getDb };
