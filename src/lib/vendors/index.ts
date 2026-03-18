/**
 * Vendor Pricing Engine
 * 
 * Coordinates queries across all configured vendor APIs.
 * Falls back to intelligent simulation when APIs aren't configured.
 * 
 * Architecture:
 *   1. Each vendor has its own client (DigiKey, Mouser, Grainger, McMaster)
 *   2. This engine queries them in parallel
 *   3. Results are normalized into a unified price comparison
 *   4. McMaster-Carr has no API — pricing comes from BOM data or simulation
 */

import { DigiKeyClient } from './digikey';
import { MouserClient } from './mouser';
import { GraingerClient } from './grainger';
import { searchMarketPrices } from './market-intel';
import type { VendorClient, PricingRequest, PricingResponse, PricedItem } from './types';

// Singleton clients
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
  // Diode patterns: 1N, BAT, BAS, BZX
  if (/^(1N|BAT|BAS|BZX|IN)\d/i.test(pn)) return 'electronic';
  // IC/semiconductor: starts with letters + numbers (STM32, LM2596, SN74, OPA, AMS, IRF, ATM)
  if (/^[A-Z]{2,}\d/i.test(pn)) return 'electronic';
  // Resistor/capacitor patterns: RC0805, CRCW, GRM
  if (/^(RC|CRCW|GRM|CC|CL)\d/i.test(pn)) return 'electronic';
  // Switch/connector with letter-number-letter pattern: B3F-1000
  if (/^[A-Z]\d[A-Z]-/i.test(pn)) return 'electronic';
  // DigiKey style: -ND suffix
  if (/-ND$/.test(pn)) return 'electronic';
  // Explicit prefixes
  if (/^(DK-|MOU-)/.test(pn)) return 'electronic';
  
  return 'unknown';
}

// Simulated McMaster pricing (no API exists)
function simulateMcMasterPrice(partNumber: string): number | null {
  // Only for mechanical parts
  const type = detectVendorType(partNumber);
  if (type === 'electronic') return null;

  // Deterministic pricing based on part number
  let hash = 0;
  for (let i = 0; i < partNumber.length; i++) {
    hash = ((hash << 5) - hash) + partNumber.charCodeAt(i);
    hash = hash & hash;
  }
  // McMaster prices typically range $2-$50 per unit for common parts
  const basePrice = 5 + Math.abs(Math.sin(hash * 0.1)) * 35;
  return parseFloat(basePrice.toFixed(2));
}

export async function priceParts(request: PricingRequest): Promise<PricingResponse> {
  const configuredVendors = clients.filter(c => c.isConfigured()).map(c => c.name);
  const hasLiveVendors = clients.some(c => c.name !== 'Grainger' && c.isConfigured());

  // Run market intelligence search in parallel with vendor queries (non-blocking, 8s timeout)
  const marketIntelPromise: Promise<Map<string, unknown>> = Promise.race([
    searchMarketPrices(request.items.map(i => i.partNumber)) as Promise<Map<string, unknown>>,
    new Promise<Map<string, unknown>>((resolve) => setTimeout(() => resolve(new Map()), 8000)),
  ]);

  const pricedItems: PricedItem[] = await Promise.all(
    request.items.map(async (item) => {
      const partType = detectVendorType(item.partNumber);

      // Query all relevant vendors in parallel
      const vendorResults = await Promise.allSettled(
        clients.map(async (client) => {
          // Skip electronic vendors for mechanical parts and vice versa
          if (partType === 'mechanical' && (client.name === 'DigiKey' || client.name === 'Mouser')) return null;
          if (partType === 'electronic' && client.name === 'Grainger') return null;
          return client.searchByPartNumber(item.partNumber, item.qty);
        })
      );

      // Collect prices
      let mcmasterPrice: number | null = simulateMcMasterPrice(item.partNumber);
      let graingerPrice: number | null = null;
      let digikeyPrice: number | null = null;
      let mouserPrice: number | null = null;

      const details: PricedItem['details'] = {};

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
          // If Grainger returned simulated data (unitPrice=0), compute from McMaster price
          if (r.unitPrice === 0 && mcmasterPrice !== null) {
            graingerPrice = GraingerClient.computeSimulatedPrice(
              mcmasterPrice,
              item.description || '',
              item.partNumber
            );
          } else {
            graingerPrice = r.unitPrice || null;
          }
          details.grainger = { inStock: r.inStock, stockQty: r.stockQty, url: r.url, leadTimeDays: r.leadTimeDays };
        }
      }

      // Determine best vendor
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

      return {
        partNumber: item.partNumber,
        description: item.description || '',
        qty: item.qty,
        vendors: {
          mcmaster: mcmasterPrice,
          grainger: graingerPrice,
          digikey: digikeyPrice,
          mouser: mouserPrice,
        },
        bestVendor,
        bestPrice,
        savings,
        details,
      };
    })
  );

  // Merge market intelligence results (non-blocking — if it times out, we still return vendor data)
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

        // If market intel found a better price than our direct APIs, update savings
        if (intelData.bestPrice !== null && item.bestPrice !== null && intelData.bestPrice < item.bestPrice) {
          const highestPrice = Math.max(
            item.vendors.mcmaster || 0, item.vendors.grainger || 0,
            item.vendors.digikey || 0, item.vendors.mouser || 0,
            item.bestPrice
          );
          item.savings = parseFloat(((highestPrice - intelData.bestPrice) * item.qty).toFixed(2));
          item.bestVendor = intelData.bestSource || item.bestVendor;
          item.bestPrice = intelData.bestPrice;
        }
      }
    }
  } catch (err) {
    console.error('[Pricing] Market intel merge failed (non-fatal):', err);
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
