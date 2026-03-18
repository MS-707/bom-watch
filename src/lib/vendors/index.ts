/**
 * Vendor Pricing Engine
 *
 * Coordinates queries across all configured vendor APIs.
 *
 * Architecture:
 *   1. OEM Secrets is the PRIMARY source — one API call returns real-time
 *      pricing from 39+ distributors (DigiKey, Mouser, Arrow, Newark, etc.)
 *   2. Falls back to individual vendor clients when OEM Secrets isn't configured
 *   3. McMaster-Carr has no API — pricing is always simulated
 *   4. Market intel (Brave) and Claude AI run in parallel as supplementary sources
 */

import { DigiKeyClient } from './digikey';
import { MouserClient } from './mouser';
import { GraingerClient } from './grainger';
import { searchMarketPrices } from './market-intel';
import { claudeAnalyzeParts } from './claude-intel';
import { isOemSecretsConfigured, searchOemSecretsBatch } from './oemsecrets';
import type { VendorClient, PricingRequest, PricingResponse, PricedItem } from './types';

// Singleton clients (fallback when OEM Secrets isn't configured)
const clients: VendorClient[] = [
  new DigiKeyClient(),
  new MouserClient(),
  new GraingerClient(),
];

// Part number prefix heuristics
function detectVendorType(partNumber: string): 'mechanical' | 'electronic' | 'unknown' {
  const pn = partNumber.toUpperCase();
  // Explicit McMaster-Carr prefix
  if (/^MCM-/.test(pn)) return 'mechanical';
  // Explicit Grainger prefix
  if (/^GRN-/.test(pn)) return 'mechanical';
  // Pure numeric McMaster style (91251A544, 5234K57)
  if (/^\d{4,}[A-Z]\d+$/.test(pn)) return 'mechanical';

  // Common electronic part patterns
  if (/^(1N|BAT|BAS|BZX|IN)\d/i.test(pn)) return 'electronic';
  if (/^[A-Z]{2,}\d/i.test(pn)) return 'electronic';
  if (/^(RC|CRCW|GRM|CC|CL)\d/i.test(pn)) return 'electronic';
  if (/^[A-Z]\d[A-Z]-/i.test(pn)) return 'electronic';
  if (/-ND$/.test(pn)) return 'electronic';
  if (/^(DK-|MOU-)/.test(pn)) return 'electronic';

  return 'unknown';
}

// Simulated McMaster pricing (no API exists)
function simulateMcMasterPrice(partNumber: string): number | null {
  const type = detectVendorType(partNumber);
  if (type === 'electronic') return null;

  let hash = 0;
  for (let i = 0; i < partNumber.length; i++) {
    hash = ((hash << 5) - hash) + partNumber.charCodeAt(i);
    hash = hash & hash;
  }
  const basePrice = 5 + Math.abs(Math.sin(hash * 0.1)) * 35;
  return parseFloat(basePrice.toFixed(2));
}

export async function priceParts(request: PricingRequest): Promise<PricingResponse> {
  const useOemSecrets = isOemSecretsConfigured();
  const configuredVendors = useOemSecrets
    ? ['OEM Secrets (39+ distributors)']
    : clients.filter(c => c.isConfigured()).map(c => c.name);
  const hasLiveVendors = useOemSecrets || clients.some(c => c.name !== 'Grainger' && c.isConfigured());

  const partNumbers = request.items.map(i => i.partNumber);

  // Launch all data sources in parallel
  const oemSecretsPromise = useOemSecrets
    ? searchOemSecretsBatch(partNumbers, request.items[0]?.qty || 1)
    : Promise.resolve(new Map());

  // Only run market intel and Claude if OEM Secrets is NOT configured
  const marketIntelPromise: Promise<Map<string, unknown>> = useOemSecrets
    ? Promise.resolve(new Map())
    : searchMarketPrices(partNumbers) as Promise<Map<string, unknown>>;
  const claudeIntelPromise: Promise<Map<string, unknown>> = useOemSecrets
    ? Promise.resolve(new Map())
    : claudeAnalyzeParts(partNumbers) as Promise<Map<string, unknown>>;

  // Wait for OEM Secrets first (it's our primary source)
  const oemResults = await oemSecretsPromise;

  const pricedItems: PricedItem[] = await Promise.all(
    request.items.map(async (item) => {
      const partType = detectVendorType(item.partNumber);
      const oem = oemResults.get(item.partNumber);

      let mcmasterPrice: number | null = simulateMcMasterPrice(item.partNumber);
      let graingerPrice: number | null = null;
      let digikeyPrice: number | null = null;
      let mouserPrice: number | null = null;
      const details: PricedItem['details'] = {};

      if (oem && oem.found) {
        // --- OEM Secrets provided real data ---
        digikeyPrice = oem.digikey;
        mouserPrice = oem.mouser;
        if (oem.grainger !== null) graingerPrice = oem.grainger;

        // Merge OEM Secrets details
        for (const [key, detail] of Object.entries(oem.details)) {
          details[key] = detail as PricedItem['details'][string];
        }

        // Use OEM description if we don't have one
        if (!item.description && oem.description) {
          item.description = oem.description;
        }
      } else if (!useOemSecrets) {
        // --- Fallback: individual vendor API queries ---
        const vendorResults = await Promise.allSettled(
          clients.map(async (client) => {
            if (partType === 'mechanical' && (client.name === 'DigiKey' || client.name === 'Mouser')) return null;
            if (partType === 'electronic' && client.name === 'Grainger') return null;
            return client.searchByPartNumber(item.partNumber, item.qty);
          })
        );

        for (const result of vendorResults) {
          if (result.status !== 'fulfilled' || !result.value) continue;
          const r = result.value;

          if (r.vendor === 'DigiKey') {
            digikeyPrice = r.unitPrice;
            details.digikey = { inStock: r.inStock, stockQty: r.stockQty, url: r.url, leadTimeDays: r.leadTimeDays };
          } else if (r.vendor === 'Mouser') {
            mouserPrice = r.unitPrice;
            details.mouser = { inStock: r.inStock, stockQty: r.stockQty, url: r.url, leadTimeDays: r.leadTimeDays };
          } else if (r.vendor === 'Grainger') {
            if (r.unitPrice === 0 && mcmasterPrice !== null) {
              graingerPrice = GraingerClient.computeSimulatedPrice(
                mcmasterPrice, item.description || '', item.partNumber
              );
            } else {
              graingerPrice = r.unitPrice || null;
            }
            details.grainger = { inStock: r.inStock, stockQty: r.stockQty, url: r.url, leadTimeDays: r.leadTimeDays };
          }
        }
      }

      // For mechanical parts without OEM Secrets Grainger data, simulate
      if (graingerPrice === null && partType === 'mechanical' && mcmasterPrice !== null) {
        graingerPrice = GraingerClient.computeSimulatedPrice(
          mcmasterPrice, item.description || '', item.partNumber
        );
      }

      // Determine best vendor from main columns
      const prices: { vendor: string; price: number }[] = [];
      if (mcmasterPrice !== null) prices.push({ vendor: 'McMaster-Carr', price: mcmasterPrice });
      if (graingerPrice !== null) prices.push({ vendor: 'Grainger', price: graingerPrice });
      if (digikeyPrice !== null) prices.push({ vendor: 'DigiKey', price: digikeyPrice });
      if (mouserPrice !== null) prices.push({ vendor: 'Mouser', price: mouserPrice });

      prices.sort((a, b) => a.price - b.price);
      const bestVendor = prices.length > 0 ? prices[0].vendor : 'Unknown';
      const bestPrice = prices.length > 0 ? prices[0].price : null;
      const highestPrice = prices.length > 1 ? prices[prices.length - 1].price : (bestPrice || 0);
      const savings = prices.length > 1 ? parseFloat(((highestPrice - (bestPrice || 0)) * item.qty).toFixed(2)) : 0;

      const pricedItem: PricedItem = {
        partNumber: item.partNumber,
        description: item.description || '',
        qty: item.qty,
        vendors: { mcmaster: mcmasterPrice, grainger: graingerPrice, digikey: digikeyPrice, mouser: mouserPrice },
        bestVendor,
        bestPrice,
        savings,
        details,
      };

      // If OEM Secrets found data, attach it as claudeIntel (powers the AI column)
      if (oem && oem.found && oem.claudeIntel.bestPrice !== null) {
        pricedItem.claudeIntel = oem.claudeIntel;

        // Update savings if OEM Secrets found a cheaper price than main vendors
        if (oem.claudeIntel.bestPrice < (bestPrice || Infinity) && highestPrice > 0) {
          pricedItem.savings = parseFloat(((highestPrice - oem.claudeIntel.bestPrice) * item.qty).toFixed(2));
        }
      }

      return pricedItem;
    })
  );

  // Merge market intel (only when OEM Secrets is not configured)
  if (!useOemSecrets) {
    try {
      const marketIntelResults = await marketIntelPromise;
      for (const item of pricedItems) {
        const intel = marketIntelResults.get(item.partNumber);
        if (intel && (intel as { searchPerformed?: boolean }).searchPerformed) {
          const intelData = intel as { bestPrice: number | null; bestSource: string | null; sourceUrl: string | null; allFindings: Array<{ distributor: string; price: number; url: string }> };
          item.marketIntel = {
            bestPrice: intelData.bestPrice,
            bestSource: intelData.bestSource,
            sourceUrl: intelData.sourceUrl,
            allFindings: intelData.allFindings,
          };
        }
      }
    } catch (err) {
      console.error('[Pricing] Market intel merge failed (non-fatal):', err);
    }

    // Merge Claude AI analysis
    try {
      const claudeResults = await claudeIntelPromise;
      for (const item of pricedItems) {
        const claude = claudeResults.get(item.partNumber);
        if (claude && (claude as { searched?: boolean }).searched) {
          const claudeData = claude as { bestPrice: number | null; bestSource: string | null; sourceUrl: string | null; insight: string; alternatives: Array<{ distributor: string; price: number; url: string; note?: string }> };
          item.claudeIntel = {
            bestPrice: claudeData.bestPrice,
            bestSource: claudeData.bestSource,
            sourceUrl: claudeData.sourceUrl,
            insight: claudeData.insight,
            alternatives: claudeData.alternatives,
          };
        }
      }
    } catch (err) {
      console.error('[Pricing] Claude intel merge failed (non-fatal):', err);
    }
  }

  const totalSavings = parseFloat(
    pricedItems.reduce((sum, item) => sum + item.savings, 0).toFixed(2)
  );

  return {
    items: pricedItems,
    totalSavings,
    vendorsQueried: configuredVendors,
    timestamp: new Date().toISOString(),
    mode: hasLiveVendors ? 'live' : 'simulated',
  };
}

export { DigiKeyClient, MouserClient, GraingerClient };
export { searchMarketPrices } from './market-intel';
export type { VendorClient, PricingRequest, PricingResponse, PricedItem };
