/**
 * Market Intelligence — Brave Search powered price discovery
 * 
 * Searches the web for each part number and extracts pricing
 * from distributors we don't have direct API access to.
 * Catches: Arrow, Avnet, Newark, RS, Future, LCSC, and others.
 * 
 * Required env vars:
 *   BRAVE_API_KEY
 */

import type { VendorClient, VendorPriceResult } from './types';

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  extra_snippets?: string[];
}

interface BraveWebResponse {
  web?: {
    results?: BraveSearchResult[];
  };
}

// Known distributor domains → display names
const DISTRIBUTOR_MAP: Record<string, string> = {
  'arrow.com': 'Arrow',
  'newark.com': 'Newark',
  'element14.com': 'Newark/element14',
  'avnet.com': 'Avnet',
  'rs-online.com': 'RS Components',
  'futureelectronics.com': 'Future',
  'lcsc.com': 'LCSC',
  'tme.eu': 'TME',
  'farnell.com': 'Farnell',
  'digipart.com': 'DigiPart',
  'findchips.com': 'FindChips',
  'octopart.com': 'Octopart',
  'oemsecrets.com': 'OEMsecrets',
  'chip1stop.com': 'Chip1Stop',
  'verical.com': 'Verical',
};

// Extract price from text using common patterns ($X.XX, $X.XXXXX)
function extractPrice(text: string): number | null {
  // Match patterns like $0.52, $1.64, $12.34, USD 0.52
  const patterns = [
    /\$(\d+\.?\d{0,5})/,
    /USD\s*(\d+\.?\d{0,5})/i,
    /price[:\s]*\$?(\d+\.?\d{0,5})/i,
    /(\d+\.?\d{2,5})\s*(?:USD|per unit)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const price = parseFloat(match[1]);
      // Sanity check — electronic components rarely cost more than $500/unit
      if (price > 0 && price < 500) {
        return price;
      }
    }
  }
  return null;
}

// Identify distributor from URL
function identifyDistributor(url: string): string | null {
  const hostname = new URL(url).hostname.replace('www.', '').replace('my.', '');
  for (const [domain, name] of Object.entries(DISTRIBUTOR_MAP)) {
    if (hostname.includes(domain)) return name;
  }
  return null;
}

export interface MarketIntelResult {
  partNumber: string;
  bestPrice: number | null;
  bestSource: string | null;
  sourceUrl: string | null;
  allFindings: Array<{
    distributor: string;
    price: number;
    url: string;
  }>;
  searchPerformed: boolean;
}

export async function searchMarketPrice(partNumber: string): Promise<MarketIntelResult> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    return { partNumber, bestPrice: null, bestSource: null, sourceUrl: null, allFindings: [], searchPerformed: false };
  }

  try {
    const query = encodeURIComponent(`${partNumber} electronic component price stock buy`);
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${query}&count=10&country=US`,
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
      }
    );

    if (!res.ok) {
      console.error(`[MarketIntel] Brave search failed (${res.status})`);
      return { partNumber, bestPrice: null, bestSource: null, sourceUrl: null, allFindings: [], searchPerformed: true };
    }

    const data: BraveWebResponse = await res.json();
    const results = data.web?.results || [];
    const findings: Array<{ distributor: string; price: number; url: string }> = [];

    for (const result of results) {
      const distributor = identifyDistributor(result.url);
      if (!distributor) continue;

      // Search title, description, and extra snippets for prices
      const textToSearch = [result.title, result.description, ...(result.extra_snippets || [])].join(' ');
      const price = extractPrice(textToSearch);

      if (price !== null) {
        // Avoid duplicates from same distributor
        if (!findings.some(f => f.distributor === distributor)) {
          findings.push({ distributor, price, url: result.url });
        }
      }
    }

    // Sort by price ascending
    findings.sort((a, b) => a.price - b.price);

    return {
      partNumber,
      bestPrice: findings.length > 0 ? findings[0].price : null,
      bestSource: findings.length > 0 ? findings[0].distributor : null,
      sourceUrl: findings.length > 0 ? findings[0].url : null,
      allFindings: findings,
      searchPerformed: true,
    };
  } catch (err) {
    console.error(`[MarketIntel] Error searching "${partNumber}":`, err);
    return { partNumber, bestPrice: null, bestSource: null, sourceUrl: null, allFindings: [], searchPerformed: true };
  }
}

/**
 * Batch search multiple parts in parallel (Brave allows up to 50 req/sec).
 */
export async function searchMarketPrices(partNumbers: string[]): Promise<Map<string, MarketIntelResult>> {
  const results = new Map<string, MarketIntelResult>();

  // Run all searches in parallel — Brave supports high throughput
  const searches = await Promise.allSettled(
    partNumbers.map(async (pn) => {
      const result = await searchMarketPrice(pn);
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
