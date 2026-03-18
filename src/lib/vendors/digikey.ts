/**
 * DigiKey API v4 Client
 * 
 * Authentication: OAuth2 2-legged (client_credentials)
 * Base URL: https://api.digikey.com (production) / https://sandbox-api.digikey.com (sandbox)
 * 
 * Required env vars:
 *   DIGIKEY_CLIENT_ID
 *   DIGIKEY_CLIENT_SECRET
 *   DIGIKEY_SANDBOX=true (optional, defaults to production)
 * 
 * Free tier: register at https://developer.digikey.com
 * Rate limit: 1000 requests/day on sandbox
 */

import type { VendorClient, VendorPriceResult } from './types';

interface DigiKeyToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface DigiKeyProduct {
  DigiKeyPartNumber: string;
  ManufacturerPartNumber: string;
  ProductDescription: string;
  UnitPrice: number;
  QuantityAvailable: number;
  MinimumOrderQuantity: number;
  ManufacturerLeadWeeks: string;
  ProductUrl: string;
  StandardPricing?: Array<{
    BreakQuantity: number;
    UnitPrice: number;
    TotalPrice: number;
  }>;
}

// In-memory token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(clientId: string, clientSecret: string, sandbox: boolean): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const baseUrl = sandbox ? 'https://sandbox-api.digikey.com' : 'https://api.digikey.com';

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DigiKey auth failed (${res.status}): ${text}`);
  }

  const data: DigiKeyToken = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

export class DigiKeyClient implements VendorClient {
  name = 'DigiKey';
  private clientId: string;
  private clientSecret: string;
  private sandbox: boolean;

  constructor() {
    this.clientId = process.env.DIGIKEY_CLIENT_ID || '';
    this.clientSecret = process.env.DIGIKEY_CLIENT_SECRET || '';
    this.sandbox = process.env.DIGIKEY_SANDBOX === 'true';
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  async searchByPartNumber(partNumber: string, qty = 1): Promise<VendorPriceResult | null> {
    if (!this.isConfigured()) return null;

    try {
      const token = await getAccessToken(this.clientId, this.clientSecret, this.sandbox);
      const baseUrl = this.sandbox ? 'https://sandbox-api.digikey.com' : 'https://api.digikey.com';

      // Try keyword search (more flexible than exact part lookup)
      const res = await fetch(`${baseUrl}/products/v4/search/keyword`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-DIGIKEY-Client-Id': this.clientId,
          'X-DIGIKEY-Locale-Site': 'US',
          'X-DIGIKEY-Locale-Language': 'en',
          'X-DIGIKEY-Locale-Currency': 'USD',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          Keywords: partNumber,
          Limit: 1,
          Offset: 0,
        }),
      });

      if (!res.ok) {
        console.error(`[DigiKey] Search failed (${res.status}): ${await res.text()}`);
        return null;
      }

      const data = await res.json();
      const product: DigiKeyProduct | undefined = data.Products?.[0] || data.ExactManufacturerProducts?.[0];

      if (!product) return null;

      // Find best price for requested quantity
      let unitPrice = product.UnitPrice;
      if (product.StandardPricing) {
        for (const tier of product.StandardPricing) {
          if (qty >= tier.BreakQuantity) {
            unitPrice = tier.UnitPrice;
          }
        }
      }

      return {
        vendor: 'DigiKey',
        partNumber: product.DigiKeyPartNumber,
        queryPartNumber: partNumber,
        description: product.ProductDescription,
        unitPrice,
        currency: 'USD',
        inStock: product.QuantityAvailable > 0,
        stockQty: product.QuantityAvailable,
        minimumOrderQty: product.MinimumOrderQuantity || 1,
        leadTimeDays: product.ManufacturerLeadWeeks ? parseInt(product.ManufacturerLeadWeeks) * 7 : null,
        url: product.ProductUrl || `https://www.digikey.com/en/products/result?keywords=${encodeURIComponent(partNumber)}`,
        lastChecked: new Date().toISOString(),
      };
    } catch (err) {
      console.error(`[DigiKey] Error searching "${partNumber}":`, err);
      return null;
    }
  }
}
