/**
 * OEM Secrets Price Intelligence
 *
 * Aggregates real-time pricing from 39+ distributors in a single API call.
 * Replaces individual vendor API calls (DigiKey, Mouser) and web search
 * approaches with authoritative distributor pricing.
 *
 * API: GET https://oemsecretsapi.com/partsearch
 * Docs: https://oemsecretsapi.com/documentation/
 *
 * Required env vars:
 *   OEMSECRETS_API_KEY
 */

import type { ClaudeIntel } from './types';

// Map OEM Secrets distributor names → our vendor column keys
const VENDOR_COLUMN_MAP: Record<string, string> = {
  'DigiKey': 'digikey',
  'Digi-Key': 'digikey',
  'Mouser Electronics': 'mouser',
  'Mouser': 'mouser',
  'Grainger': 'grainger',
  'Newark': 'newark',
  'Farnell UK': 'farnell',
  'Arrow Electronics': 'arrow',
  'Avnet America': 'avnet',
  'Avnet Silica': 'avnet',
};

// Distributors to show in the main 4-column vendor grid
const MAIN_VENDORS = new Set(['digikey', 'mouser', 'grainger']);

export interface OemSecretsStockEntry {
  part_number: string;
  source_part_number: string;
  description: string;
  manufacturer: string;
  quantity_in_stock: number;
  moq: number;
  buy_now_url: string;
  life_cycle: string;
  lead_time: string;
  lead_time_format: string;
  datasheet_url: string;
  image_url: string;
  category: string;
  packaging: string;
  prices: {
    USD?: Array<{ unit_break: number; unit_price: string }>;
  };
  distributor: {
    distributor_name: string;
    distributor_common_name: string;
    distributor_region: string;
    distributor_country: string;
    distributor_logo: string;
  };
}

export interface OemSecretsResult {
  partNumber: string;
  // Mapped prices for main vendor columns
  digikey: number | null;
  mouser: number | null;
  grainger: number | null;
  // Details per vendor (stock, URL, lead time)
  details: Record<string, {
    inStock: boolean;
    stockQty: number | null;
    url: string;
    leadTimeDays: number | null;
  }>;
  // Best overall price across ALL distributors → maps to claudeIntel
  claudeIntel: ClaudeIntel;
  // Raw description from first result
  description: string;
  // Whether we got real data
  found: boolean;
}

function parseLeadTimeDays(leadTime: string, format: string): number | null {
  if (!leadTime) return null;
  const num = parseInt(leadTime);
  if (isNaN(num)) return null;
  if (format === 'Weeks' || format === 'weeks') return num * 7;
  return num; // Days
}

function getUnitPrice(prices: OemSecretsStockEntry['prices'], qty: number): number | null {
  const usd = prices?.USD;
  if (!usd || usd.length === 0) return null;

  // Find the best price break for the requested quantity
  let bestBreak = usd[0];
  for (const pb of usd) {
    if (pb.unit_break <= qty) {
      bestBreak = pb;
    }
  }
  const price = parseFloat(bestBreak.unit_price);
  return isNaN(price) ? null : price;
}

export function isOemSecretsConfigured(): boolean {
  return !!process.env.OEMSECRETS_API_KEY;
}

/**
 * Search OEM Secrets for a single part number.
 * Returns pricing from all distributors, mapped to our data model.
 */
export async function searchOemSecrets(partNumber: string, qty: number = 1): Promise<OemSecretsResult> {
  const apiKey = process.env.OEMSECRETS_API_KEY;
  const empty: OemSecretsResult = {
    partNumber,
    digikey: null,
    mouser: null,
    grainger: null,
    details: {},
    claudeIntel: { bestPrice: null, bestSource: null, sourceUrl: null, insight: '', alternatives: [] },
    description: '',
    found: false,
  };

  if (!apiKey) return empty;

  try {
    const url = `https://oemsecretsapi.com/partsearch?searchTerm=${encodeURIComponent(partNumber)}&apiKey=${apiKey}&countryCode=US&currency=USD`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`[OEMSecrets] API error (${res.status}) for "${partNumber}"`);
      return empty;
    }

    const data = await res.json();
    const stocks: OemSecretsStockEntry[] = data?.stock || [];

    if (stocks.length === 0) return empty;

    // Process all stock entries
    const inStockEntries: Array<{
      price: number;
      distributor: string;
      vendorKey: string | null;
      stockQty: number;
      url: string;
      leadTimeDays: number | null;
      description: string;
    }> = [];

    for (const entry of stocks) {
      const price = getUnitPrice(entry.prices, qty);
      if (price === null || price <= 0) continue;

      const stockQty = typeof entry.quantity_in_stock === 'number' ? entry.quantity_in_stock : parseInt(String(entry.quantity_in_stock)) || 0;
      const distName = entry.distributor?.distributor_name || entry.distributor?.distributor_common_name || 'Unknown';
      const vendorKey = VENDOR_COLUMN_MAP[distName] || null;

      inStockEntries.push({
        price,
        distributor: distName,
        vendorKey,
        stockQty,
        url: entry.buy_now_url || '',
        leadTimeDays: parseLeadTimeDays(entry.lead_time, entry.lead_time_format),
        description: entry.description || '',
      });
    }

    // Sort by price
    inStockEntries.sort((a, b) => a.price - b.price);

    if (inStockEntries.length === 0) return empty;

    // Map to main vendor columns — take cheapest in-stock entry per vendor
    let digikeyPrice: number | null = null;
    let mouserPrice: number | null = null;
    let graingerPrice: number | null = null;
    const details: OemSecretsResult['details'] = {};

    // Track which distributors we've already recorded (take cheapest per distributor)
    const seenDistributors = new Set<string>();

    for (const entry of inStockEntries) {
      const distKey = entry.vendorKey || entry.distributor.toLowerCase().replace(/\s+/g, '-');

      // Record detail for this distributor (first = cheapest since sorted)
      if (!seenDistributors.has(distKey)) {
        seenDistributors.add(distKey);
        details[distKey] = {
          inStock: entry.stockQty > 0,
          stockQty: entry.stockQty > 0 ? entry.stockQty : null,
          url: entry.url,
          leadTimeDays: entry.leadTimeDays,
        };
      }

      // Map to main vendor columns (take cheapest in-stock for each)
      if (entry.vendorKey === 'digikey' && digikeyPrice === null && entry.stockQty > 0) {
        digikeyPrice = entry.price;
      }
      if (entry.vendorKey === 'mouser' && mouserPrice === null && entry.stockQty > 0) {
        mouserPrice = entry.price;
      }
      if (entry.vendorKey === 'grainger' && graingerPrice === null && entry.stockQty > 0) {
        graingerPrice = entry.price;
      }
    }

    // Find best overall price (in-stock only) for AI column
    const inStock = inStockEntries.filter(e => e.stockQty > 0);
    const best = inStock[0] || inStockEntries[0]; // fallback to cheapest even if out of stock

    // Build alternatives (next 2 cheapest from different distributors)
    const alternatives: ClaudeIntel['alternatives'] = [];
    const seenForAlts = new Set<string>([best.distributor]);
    for (const entry of inStock) {
      if (seenForAlts.has(entry.distributor)) continue;
      seenForAlts.add(entry.distributor);
      alternatives.push({
        distributor: entry.distributor,
        price: entry.price,
        url: entry.url,
        note: entry.stockQty > 0 ? `${entry.stockQty.toLocaleString()} in stock` : 'Check availability',
      });
      if (alternatives.length >= 3) break;
    }

    // Build insight from data
    const totalDistributors = seenDistributors.size;
    const totalInStock = inStock.length;
    const insight = `Found at ${totalDistributors} distributors, ${totalInStock} with stock. Best: $${best.price.toFixed(2)} at ${best.distributor}.`;

    return {
      partNumber,
      digikey: digikeyPrice,
      mouser: mouserPrice,
      grainger: graingerPrice,
      details,
      claudeIntel: {
        bestPrice: best.price,
        bestSource: best.distributor,
        sourceUrl: best.url,
        insight,
        alternatives,
      },
      description: best.description || stocks[0]?.description || '',
      found: true,
    };
  } catch (err) {
    console.error(`[OEMSecrets] Error searching "${partNumber}":`, err);
    return empty;
  }
}

/**
 * Search multiple parts in parallel.
 */
export async function searchOemSecretsBatch(
  partNumbers: string[],
  qty: number = 1
): Promise<Map<string, OemSecretsResult>> {
  const results = new Map<string, OemSecretsResult>();

  const searches = await Promise.allSettled(
    partNumbers.map(async (pn) => {
      const result = await searchOemSecrets(pn, qty);
      return { pn, result };
    })
  );

  for (const search of searches) {
    if (search.status === 'fulfilled') {
      results.set(search.value.pn, search.value.result);
    }
  }

  return results;
}
