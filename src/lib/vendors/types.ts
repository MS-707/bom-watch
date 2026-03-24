/**
 * Vendor API abstraction layer — shared types
 * 
 * Each vendor implements the VendorClient interface.
 * The pricing engine queries all available vendors in parallel
 * and returns a unified price comparison.
 */

export interface VendorPriceResult {
  vendor: string;
  partNumber: string;       // vendor-specific part number
  queryPartNumber: string;  // what was searched
  description: string;
  unitPrice: number;
  currency: string;
  inStock: boolean;
  stockQty: number | null;
  minimumOrderQty: number;
  leadTimeDays: number | null;
  url: string;              // direct link to product page
  lastChecked: string;      // ISO timestamp
}

export interface VendorSearchResult {
  vendor: string;
  results: VendorPriceResult[];
  error?: string;
  cached: boolean;
  responseTimeMs: number;
}

export interface PricingRequest {
  items: {
    partNumber: string;
    description?: string;
    qty: number;
  }[];
}

export interface MarketIntel {
  bestPrice: number | null;
  bestSource: string | null;
  sourceUrl: string | null;
  allFindings: Array<{
    distributor: string;
    price: number;
    url: string;
  }>;
}

export interface ClaudeIntel {
  bestPrice: number | null;
  bestSource: string | null;
  sourceUrl: string | null;
  insight: string;
  alternatives: Array<{
    distributor: string;
    price: number;
    url: string;
    note?: string;
  }>;
}

export type PriceSource = 'api' | 'estimated' | 'ai' | null;

export interface PricedItem {
  partNumber: string;
  description: string;
  qty: number;
  vendors: {
    mcmaster: number | null;
    grainger: number | null;
    digikey: number | null;
    mouser: number | null;
  };
  /** Tracks where each vendor price came from — 'api' (live), 'estimated' (simulated), 'ai', or null (no data) */
  vendorSources: {
    mcmaster: PriceSource;
    grainger: PriceSource;
    digikey: PriceSource;
    mouser: PriceSource;
  };
  bestVendor: string;
  bestPrice: number | null;
  savings: number;
  details: {
    [vendor: string]: {
      inStock: boolean;
      stockQty: number | null;
      url: string;
      leadTimeDays: number | null;
    };
  };
  marketIntel?: MarketIntel;
  claudeIntel?: ClaudeIntel;
  riskFlags?: Array<{
    type: 'single_source' | 'out_of_stock' | 'long_lead_time' | 'price_unverified';
    message: string;
  }>;
}

export interface PricingResponse {
  items: PricedItem[];
  totalSavings: number;
  vendorsQueried: string[];
  timestamp: string;
  mode: 'live' | 'simulated';
}

export interface VendorClient {
  name: string;
  isConfigured(): boolean;
  searchByPartNumber(partNumber: string, qty?: number): Promise<VendorPriceResult | null>;
}
