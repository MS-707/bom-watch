/**
 * Vendor Pricing Engine
 *
 * Coordinates queries across all configured vendor APIs.
 *
 * Architecture:
 *   1. OEM Secrets is the PRIMARY source — one API call returns real-time
 *      pricing from 39+ distributors (DigiKey, Mouser, Arrow, Newark, etc.)
 *   2. McMaster-Carr API provides real pricing for mechanical parts
 *   3. Falls back to individual vendor clients when OEM Secrets isn't configured
 *   4. Market intel (Brave) and Claude AI run in parallel as supplementary sources
 */

import { DigiKeyClient } from './digikey';
import { MouserClient } from './mouser';
import { GraingerClient } from './grainger';
import { McMasterClient, isMcMasterConfigured } from './mcmaster';
import { searchMarketPrices } from './market-intel';
import { claudeAnalyzeParts } from './claude-intel';
import { isOemSecretsConfigured, searchOemSecretsBatch } from './oemsecrets';
import type { VendorClient, VendorPriceResult, PricingRequest, PricingResponse, PricedItem, PriceSource, ApiCallCounts } from './types';

// Singleton clients
const mcmaster = new McMasterClient();
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

// Simulated McMaster pricing (fallback when API not configured)
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
  const useMcMaster = isMcMasterConfigured();
  const configuredVendors = [
    ...(useMcMaster ? ['McMaster-Carr API'] : []),
    ...(useOemSecrets ? ['OEM Secrets (39+ distributors)'] : clients.filter(c => c.isConfigured()).map(c => c.name)),
  ];
  const hasLiveVendors = useMcMaster || useOemSecrets || clients.some(c => c.name !== 'Grainger' && c.isConfigured());

  // Track external API calls for audit logging
  const callCounts: ApiCallCounts = {
    mcmaster: 0, oemSecrets: 0, digikey: 0, mouser: 0,
    grainger: 0, claudeAi: 0, braveSearch: 0, total: 0,
  };

  const partNumbers = request.items.map(i => i.partNumber);

  // Step 1: Fetch McMaster product data first (gives us descriptions for Claude)
  const mcmasterDescriptions = new Map<string, string>();
  const mcmasterCache = new Map<string, VendorPriceResult>();
  if (useMcMaster) {
    await Promise.allSettled(
      request.items.map(async (item) => {
        if (detectVendorType(item.partNumber) !== 'electronic') {
          try {
            callCounts.mcmaster++;
            const result = await mcmaster.searchByPartNumber(item.partNumber, item.qty);
            if (result) {
              mcmasterDescriptions.set(item.partNumber, result.description);
              mcmasterCache.set(item.partNumber, result);
            }
          } catch { /* handled below */ }
        }
      })
    );
  }

  // Step 2: Launch remaining data sources in parallel (with descriptions available for Claude)
  const oemSecretsPromise = useOemSecrets
    ? (callCounts.oemSecrets++, searchOemSecretsBatch(partNumbers, request.items[0]?.qty || 1))
    : Promise.resolve(new Map());

  // Claude AI gets McMaster descriptions for better cross-referencing
  callCounts.claudeAi++;
  const claudeIntelPromise: Promise<Map<string, unknown>> = claudeAnalyzeParts(
    partNumbers,
    mcmasterDescriptions.size > 0 ? mcmasterDescriptions : undefined
  ) as Promise<Map<string, unknown>>;

  // Market intel via Brave search (skip when OEM Secrets is configured)
  if (!useOemSecrets) callCounts.braveSearch += partNumbers.length;
  const marketIntelPromise: Promise<Map<string, unknown>> = useOemSecrets
    ? Promise.resolve(new Map())
    : searchMarketPrices(partNumbers) as Promise<Map<string, unknown>>;

  // Wait for OEM Secrets first (it's our primary source)
  const oemResults = await oemSecretsPromise;

  const pricedItems: PricedItem[] = await Promise.all(
    request.items.map(async (item) => {
      const partType = detectVendorType(item.partNumber);
      const oem = oemResults.get(item.partNumber);

      let mcmasterPrice: number | null = null;
      let graingerPrice: number | null = null;
      let digikeyPrice: number | null = null;
      let mouserPrice: number | null = null;
      let mcmasterSource: PriceSource = null;
      let graingerSource: PriceSource = null;
      let digikeySource: PriceSource = null;
      let mouserSource: PriceSource = null;
      const details: PricedItem['details'] = {};
      const itemDesc = item.description || '';

      // McMaster-Carr: use cached result from Step 1, or fetch if not cached
      if (useMcMaster && partType !== 'electronic') {
        try {
          const cached = mcmasterCache.get(item.partNumber);
          if (!cached) callCounts.mcmaster++;
          const mcResult = cached
            || await mcmaster.searchByPartNumber(item.partNumber, item.qty);
          if (mcResult) {
            mcmasterPrice = mcResult.unitPrice;
            mcmasterSource = 'api';
            details.mcmaster = {
              inStock: mcResult.inStock,
              stockQty: mcResult.stockQty,
              url: mcResult.url,
              leadTimeDays: mcResult.leadTimeDays,
            };
            if (!item.description && mcResult.description) {
              item.description = mcResult.description;
            }
          }
        } catch (err) {
          console.error(`[McMaster] Price lookup failed for ${item.partNumber}:`, err);
        }
      }

      // Fallback to simulated McMaster price if API didn't return data
      if (mcmasterPrice === null) {
        mcmasterPrice = simulateMcMasterPrice(item.partNumber);
        if (mcmasterPrice !== null) mcmasterSource = 'estimated';
      }

      if (oem && oem.found) {
        // --- OEM Secrets provided real data ---
        digikeyPrice = oem.digikey;
        if (digikeyPrice !== null) digikeySource = 'api';
        mouserPrice = oem.mouser;
        if (mouserPrice !== null) mouserSource = 'api';
        if (oem.grainger !== null) {
          graingerPrice = oem.grainger;
          graingerSource = 'api';
        }

        // Merge OEM Secrets details
        for (const [key, detail] of Object.entries(oem.details)) {
          details[key] = detail as PricedItem['details'][string];
        }

        // Use OEM description if we don't have one
        if (!item.description && oem.description) {
          item.description = oem.description;
        }
      } else {
        // --- Fallback: individual vendor API queries ---
        const vendorResults = await Promise.allSettled(
          clients.map(async (client) => {
            if (partType === 'mechanical' && (client.name === 'DigiKey' || client.name === 'Mouser')) return null;
            if (partType === 'electronic' && client.name === 'Grainger') return null;
            // Track individual vendor API calls
            if (client.name === 'DigiKey') callCounts.digikey++;
            else if (client.name === 'Mouser') callCounts.mouser++;
            else if (client.name === 'Grainger') callCounts.grainger++;
            return client.searchByPartNumber(item.partNumber, item.qty);
          })
        );

        for (const result of vendorResults) {
          if (result.status !== 'fulfilled' || !result.value) continue;
          const r = result.value;

          if (r.vendor === 'DigiKey') {
            digikeyPrice = r.unitPrice;
            digikeySource = 'api';
            details.digikey = { inStock: r.inStock, stockQty: r.stockQty, url: r.url, leadTimeDays: r.leadTimeDays };
          } else if (r.vendor === 'Mouser') {
            mouserPrice = r.unitPrice;
            mouserSource = 'api';
            details.mouser = { inStock: r.inStock, stockQty: r.stockQty, url: r.url, leadTimeDays: r.leadTimeDays };
          } else if (r.vendor === 'Grainger') {
            if (r.unitPrice === 0 && mcmasterPrice !== null) {
              graingerPrice = GraingerClient.computeSimulatedPrice(
                mcmasterPrice, itemDesc, item.partNumber
              );
              graingerSource = 'estimated';
            } else {
              graingerPrice = r.unitPrice || null;
              if (graingerPrice !== null) graingerSource = 'api';
            }
            details.grainger = { inStock: r.inStock, stockQty: r.stockQty, url: r.url, leadTimeDays: r.leadTimeDays };
          }
        }
      }

      // For mechanical parts without OEM Secrets Grainger data, simulate
      if (graingerPrice === null && partType === 'mechanical' && mcmasterPrice !== null) {
        graingerPrice = GraingerClient.computeSimulatedPrice(
          mcmasterPrice, itemDesc, item.partNumber
        );
        graingerSource = 'estimated';
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
        vendorSources: { mcmaster: mcmasterSource, grainger: graingerSource, digikey: digikeySource, mouser: mouserSource },
        bestVendor,
        bestPrice,
        savings,
        details,
      };

      // Populate risk flags
      const riskFlags: PricedItem['riskFlags'] = [];

      // single_source: only 1 vendor has a non-null price
      const vendorsWithPrice = [mcmasterPrice, graingerPrice, digikeyPrice, mouserPrice].filter(p => p !== null).length;
      if (vendorsWithPrice === 1) {
        riskFlags.push({ type: 'single_source', message: 'Only one vendor has pricing for this part' });
      }

      // out_of_stock: no vendor in details has inStock: true
      const detailEntries = Object.values(details);
      if (detailEntries.length > 0 && !detailEntries.some(d => d.inStock)) {
        riskFlags.push({ type: 'out_of_stock', message: 'No vendors report this part as in stock' });
      }

      // long_lead_time: best vendor's lead time > 14 days
      const bestVendorKey = bestVendor.toLowerCase().replace('-', '').replace(' ', '');
      const bestDetail = Object.entries(details).find(([key]) => key.toLowerCase().replace('-', '').replace(' ', '') === bestVendorKey);
      if (bestDetail && bestDetail[1].leadTimeDays !== null && bestDetail[1].leadTimeDays > 14) {
        riskFlags.push({ type: 'long_lead_time', message: `Best vendor lead time is ${bestDetail[1].leadTimeDays} days` });
      }

      // price_unverified: vendorSources for the best vendor is 'estimated' or 'ai'
      const vendorSourceMap: Record<string, PriceSource> = {
        'mcmaster-carr': mcmasterSource,
        'mcmaster': mcmasterSource,
        'grainger': graingerSource,
        'digikey': digikeySource,
        'mouser': mouserSource,
      };
      const bestVendorSource = vendorSourceMap[bestVendor.toLowerCase()] ?? vendorSourceMap[bestVendor.toLowerCase().replace('-carr', '')] ?? null;
      if (bestVendorSource === 'estimated' || bestVendorSource === 'ai') {
        riskFlags.push({ type: 'price_unverified', message: `Best vendor price is ${bestVendorSource}, not from a live API` });
      }

      if (riskFlags.length > 0) {
        pricedItem.riskFlags = riskFlags;
      }

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
  }

  // Always merge Claude AI analysis — it's the fallback when OEM Secrets
  // doesn't provide data. Only attach if item doesn't already have claudeIntel
  // (OEM Secrets populates it when it works).
  try {
    const claudeResults = await claudeIntelPromise;
    for (const item of pricedItems) {
      if (item.claudeIntel) continue; // OEM Secrets already provided AI data
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

        // Update savings if Claude found a cheaper price than main vendors
        if (claudeData.bestPrice !== null && (item.bestPrice === null || claudeData.bestPrice < item.bestPrice)) {
          const highestPrice = Math.max(
            item.vendors.mcmaster || 0, item.vendors.grainger || 0,
            item.vendors.digikey || 0, item.vendors.mouser || 0,
            item.bestPrice || 0
          );
          if (highestPrice > 0) {
            item.savings = parseFloat(((highestPrice - claudeData.bestPrice) * item.qty).toFixed(2));
          }
        }
      }
    }
  } catch (err) {
    console.error('[Pricing] Claude intel merge failed (non-fatal):', err);
  }

  const totalSavings = parseFloat(
    pricedItems.reduce((sum, item) => sum + item.savings, 0).toFixed(2)
  );

  // Finalize call counts
  callCounts.total = callCounts.mcmaster + callCounts.oemSecrets + callCounts.digikey
    + callCounts.mouser + callCounts.grainger + callCounts.claudeAi + callCounts.braveSearch;

  return {
    items: pricedItems,
    totalSavings,
    vendorsQueried: configuredVendors,
    timestamp: new Date().toISOString(),
    mode: hasLiveVendors ? 'live' : 'simulated',
    apiCallCounts: callCounts,
  };
}

export { DigiKeyClient, MouserClient, GraingerClient, McMasterClient };
export { searchMarketPrices } from './market-intel';
export type { VendorClient, PricingRequest, PricingResponse, PricedItem };
