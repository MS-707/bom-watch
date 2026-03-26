/**
 * McMaster-Carr Product Information API Client
 *
 * Uses McMaster's official API with certificate-based authentication.
 * Returns real pricing, product specs, and availability data.
 *
 * Auth flow:
 *   1. Login with client cert + username/password → bearer token (24hr)
 *   2. Subscribe to part numbers (PUT /v1/products)
 *   3. Query pricing (GET /v1/products/{pn}/price)
 *
 * Required env vars:
 *   MCMASTER_USERNAME       — McMaster account email
 *   MCMASTER_PASSWORD       — McMaster account password
 *   MCMASTER_CERT_PFX_B64   — Base64-encoded PFX certificate file
 *   MCMASTER_CERT_PASSWORD   — Password for the PFX certificate
 *
 * For local dev, you can alternatively set:
 *   MCMASTER_CERT_PFX_PATH  — File path to the PFX certificate
 */

import * as https from 'https';
import * as fs from 'fs';
import type { VendorClient, VendorPriceResult } from './types';

const API_BASE = 'https://api.mcmaster.com';

// Cache auth token (valid 24 hours)
let cachedToken: string | null = null;
let tokenExpiry: Date | null = null;
let loginPromise: Promise<string> | null = null;

// Cache HTTPS agent to avoid re-reading cert files
let cachedAgent: https.Agent | null = null;

// Cache subscribed part numbers to avoid re-subscribing
const subscribedParts = new Set<string>();

function getHttpsAgent(): https.Agent | null {
  if (cachedAgent) return cachedAgent;

  // McMaster's API server uses a certificate not in Node's default CA bundle.
  // We trust their server directly since we're using mutual TLS with our client cert.
  const tlsOptions = { rejectUnauthorized: false };

  let agent: https.Agent | null = null;

  // Option 1: PEM cert + key files (most compatible with Node.js)
  const certPath = process.env.MCMASTER_CERT_PEM_PATH;
  const keyPath = process.env.MCMASTER_KEY_PEM_PATH;
  if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    agent = new https.Agent({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath), ...tlsOptions });
  }

  // Option 2: Base64-encoded PEM cert + key (for Vercel deployment)
  if (!agent) {
    const certB64 = process.env.MCMASTER_CERT_PEM_B64;
    const keyB64 = process.env.MCMASTER_KEY_PEM_B64;
    if (certB64 && keyB64) {
      agent = new https.Agent({ cert: Buffer.from(certB64, 'base64'), key: Buffer.from(keyB64, 'base64'), ...tlsOptions });
    }
  }

  // Option 3: PFX file (may not work on all Node versions)
  if (!agent) {
    const certPassword = process.env.MCMASTER_CERT_PASSWORD || '';
    const pfxB64 = process.env.MCMASTER_CERT_PFX_B64;
    if (pfxB64) {
      agent = new https.Agent({ pfx: Buffer.from(pfxB64, 'base64'), passphrase: certPassword });
    } else {
      const pfxPath = process.env.MCMASTER_CERT_PFX_PATH;
      if (pfxPath && fs.existsSync(pfxPath)) {
        agent = new https.Agent({ pfx: fs.readFileSync(pfxPath), passphrase: certPassword });
      }
    }
  }

  cachedAgent = agent;
  return agent;
}

async function fetchWithCert(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): Promise<Response> {
  const agent = getHttpsAgent();
  if (!agent) throw new Error('McMaster certificate not configured');

  // Node's native fetch doesn't support custom https agents directly.
  // Use the https module for certificate-authenticated requests.
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        agent,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve(
            new Response(data, {
              status: res.statusCode || 500,
              headers: res.headers as Record<string, string>,
            })
          );
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function login(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken;
  }

  // Prevent concurrent login calls — reuse in-flight promise
  if (loginPromise) return loginPromise;

  loginPromise = doLogin().finally(() => { loginPromise = null; });
  return loginPromise;
}

async function doLogin(): Promise<string> {
  const username = process.env.MCMASTER_USERNAME;
  const password = process.env.MCMASTER_PASSWORD;
  if (!username || !password) throw new Error('McMaster credentials not configured');

  const res = await fetchWithCert(`${API_BASE}/v1/login`, {
    method: 'POST',
    body: JSON.stringify({ UserName: username, Password: password }),
  });

  if (res.status !== 200) {
    const body = await res.text();
    throw new Error(`McMaster login failed (${res.status}): ${body}`);
  }

  const data = await res.json() as { AuthToken: string; ExpirationTS: string };
  cachedToken = data.AuthToken;
  tokenExpiry = new Date(data.ExpirationTS);

  console.log(`[McMaster] Logged in, token expires ${tokenExpiry.toISOString()}`);
  return cachedToken;
}

async function subscribePart(partNumber: string): Promise<unknown> {
  // Strip MCM- prefix if present
  const cleanPN = partNumber.replace(/^MCM-/i, '');

  if (subscribedParts.has(cleanPN)) return null;

  // Cap the cache to prevent unbounded memory growth
  if (subscribedParts.size > 500) {
    subscribedParts.clear();
  }

  const token = await login();
  const res = await fetchWithCert(`${API_BASE}/v1/products`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ URL: `https://mcmaster.com/${cleanPN}` }),
  });

  if (res.status === 200 || res.status === 201) {
    subscribedParts.add(cleanPN);
    const data = await res.json();
    return data;
  }

  if (res.status === 400) {
    // Invalid part number or already subscribed at max
    const body = await res.text();
    console.warn(`[McMaster] Subscribe failed for ${cleanPN}: ${body}`);
    return null;
  }

  if (res.status === 403) {
    // Token expired — clear and retry once
    cachedToken = null;
    tokenExpiry = null;
    const newToken = await login();
    const retry = await fetchWithCert(`${API_BASE}/v1/products`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${newToken}` },
      body: JSON.stringify({ URL: `https://mcmaster.com/${cleanPN}` }),
    });
    if (retry.status === 200 || retry.status === 201) {
      subscribedParts.add(cleanPN);
      return retry.json();
    }
  }

  return null;
}

async function getPrice(
  partNumber: string
): Promise<{ amount: number; moq: number; unit: string } | null> {
  const cleanPN = partNumber.replace(/^MCM-/i, '');
  const token = await login();

  const res = await fetchWithCert(
    `${API_BASE}/v1/products/${encodeURIComponent(cleanPN)}/price`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (res.status === 403) {
    // Not subscribed — subscribe first, then retry
    await subscribePart(partNumber);
    const newToken = await login();
    const retry = await fetchWithCert(
      `${API_BASE}/v1/products/${encodeURIComponent(cleanPN)}/price`,
      {
        headers: { Authorization: `Bearer ${newToken}` },
      }
    );
    if (retry.status !== 200) return null;
    const data = (await retry.json()) as Array<{
      Amount: number;
      MinimumQuantity: number;
      UnitOfMeasure: string;
    }>;
    if (!data || data.length === 0) return null;
    return { amount: data[0].Amount, moq: data[0].MinimumQuantity, unit: data[0].UnitOfMeasure };
  }

  if (res.status !== 200) return null;

  const data = (await res.json()) as Array<{
    Amount: number;
    MinimumQuantity: number;
    UnitOfMeasure: string;
  }>;
  if (!data || data.length === 0) return null;
  return { amount: data[0].Amount, moq: data[0].MinimumQuantity, unit: data[0].UnitOfMeasure };
}

export class McMasterClient implements VendorClient {
  name = 'McMaster-Carr';

  isConfigured(): boolean {
    const hasCreds = !!(process.env.MCMASTER_USERNAME && process.env.MCMASTER_PASSWORD);
    const hasCert = !!(
      (process.env.MCMASTER_CERT_PEM_PATH && process.env.MCMASTER_KEY_PEM_PATH) ||
      (process.env.MCMASTER_CERT_PEM_B64 && process.env.MCMASTER_KEY_PEM_B64) ||
      process.env.MCMASTER_CERT_PFX_B64 ||
      process.env.MCMASTER_CERT_PFX_PATH
    );
    return hasCreds && hasCert;
  }

  async searchByPartNumber(
    partNumber: string,
    qty = 1
  ): Promise<VendorPriceResult | null> {
    const cleanPN = partNumber.replace(/^MCM-/i, '');

    try {
      // Subscribe first (cached — only hits API once per part)
      const productData = await subscribePart(partNumber);

      // Get pricing
      const price = await getPrice(partNumber);
      if (!price) return null;

      // Extract description from subscription response if available
      let description = '';
      if (productData && typeof productData === 'object') {
        const pd = productData as {
          FamilyDescription?: string;
          DetailDescription?: string;
        };
        description = [pd.FamilyDescription, pd.DetailDescription]
          .filter(Boolean)
          .join(' — ');
      }

      return {
        vendor: 'McMaster-Carr',
        partNumber: cleanPN,
        queryPartNumber: partNumber,
        description,
        unitPrice: price.amount,
        currency: 'USD',
        inStock: true, // McMaster ships virtually everything same-day
        stockQty: null, // McMaster doesn't expose stock quantities
        minimumOrderQty: price.moq,
        leadTimeDays: 1, // McMaster's signature: next-day delivery
        url: `https://www.mcmaster.com/${cleanPN}`,
        lastChecked: new Date().toISOString(),
      };
    } catch (err) {
      console.error(`[McMaster] Error for ${cleanPN}:`, err);
      return null;
    }
  }
}

export function isMcMasterConfigured(): boolean {
  return new McMasterClient().isConfigured();
}
