/**
 * Mouser Search API Client
 * 
 * Authentication: API key in query string (no OAuth needed)
 * Base URL: https://api.mouser.com/api/v1
 * 
 * Required env vars:
 *   MOUSER_API_KEY (Search API key — different from Shopping Cart API key)
 * 
 * Free tier: register at https://www.mouser.com/api-hub/
 * Rate limit: reasonable use policy
 */

import type { VendorClient, VendorPriceResult } from './types';

interface MouserPart {
  MouserPartNumber: string;
  ManufacturerPartNumber: string;
  Description: string;
  PriceBreaks: Array<{
    Quantity: number;
    Price: string;  // "$0.11" format
    Currency: string;
  }>;
  Availability: string;  // "1234 In Stock" format
  Min: string;
  LeadTime: string;
  ProductDetailUrl: string;
}

export class MouserClient implements VendorClient {
  name = 'Mouser';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.MOUSER_API_KEY || '';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async searchByPartNumber(partNumber: string, qty = 1): Promise<VendorPriceResult | null> {
    if (!this.isConfigured()) return null;

    try {
      const url = `https://api.mouser.com/api/v1/search/partnumber?apiKey=${this.apiKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          SearchByPartRequest: {
            mouserPartNumber: partNumber,
          },
        }),
      });

      if (!res.ok) {
        console.error(`[Mouser] Search failed (${res.status}): ${await res.text()}`);
        return null;
      }

      const data = await res.json();

      if (data.Errors?.length > 0) {
        console.error('[Mouser] API errors:', data.Errors);
        return null;
      }

      const parts: MouserPart[] = data.SearchResults?.Parts || [];
      if (parts.length === 0) return null;

      // Prefer exact match on ManufacturerPartNumber, then MouserPartNumber, then first result
      const normalizedQuery = partNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const part = parts.find(p => 
        p.ManufacturerPartNumber?.toUpperCase().replace(/[^A-Z0-9]/g, '') === normalizedQuery
      ) || parts.find(p =>
        p.MouserPartNumber?.toUpperCase().replace(/[^A-Z0-9]/g, '') === normalizedQuery
      ) || parts[0];

      // Parse price for requested quantity
      let unitPrice = 0;
      if (part.PriceBreaks?.length > 0) {
        for (const tier of part.PriceBreaks) {
          if (qty >= tier.Quantity) {
            unitPrice = parseFloat(tier.Price.replace(/[^0-9.]/g, ''));
          }
        }
        // If no tier matched, use first tier price
        if (unitPrice === 0) {
          unitPrice = parseFloat(part.PriceBreaks[0].Price.replace(/[^0-9.]/g, ''));
        }
      }

      // Parse stock from "1234 In Stock" format
      const stockMatch = part.Availability?.match(/(\d[\d,]*)/);
      const stockQty = stockMatch ? parseInt(stockMatch[1].replace(/,/g, '')) : null;

      return {
        vendor: 'Mouser',
        partNumber: part.MouserPartNumber,
        queryPartNumber: partNumber,
        description: part.Description || '',
        unitPrice,
        currency: 'USD',
        inStock: (stockQty ?? 0) > 0,
        stockQty,
        minimumOrderQty: parseInt(part.Min) || 1,
        leadTimeDays: part.LeadTime ? parseInt(part.LeadTime) || null : null,
        url: part.ProductDetailUrl || `https://www.mouser.com/Search/Refine?Keyword=${encodeURIComponent(partNumber)}`,
        lastChecked: new Date().toISOString(),
      };
    } catch (err) {
      console.error(`[Mouser] Error searching "${partNumber}":`, err);
      return null;
    }
  }
}
