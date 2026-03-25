import { NextRequest, NextResponse } from 'next/server';
import { listBomAnalyses } from '@/lib/db/bom-store';
import { initSchema } from '@/lib/db/schema';

/**
 * BOM Analysis API
 *
 * GET /api/boms — List analyzed BOMs with pricing data
 * Query params: ?status=analyzed|ordered&limit=20&offset=0
 *
 * Reads from Neon Postgres when DATABASE_URL is configured.
 * Falls back to mock data when database is not available.
 */

// Demo BOMs — verified part numbers showcasing all API integrations
// BOM 1: Mechanical (McMaster API live prices + Grainger alternatives)
// BOM 2: Electronic (OEMSecrets 39+ distributors + DigiKey/Mouser live pricing)
const mockBoms = [
  {
    id: 'BOM-3001',
    name: 'Z-Drive Fastener Kit — ECO-00005',
    engineer: 'Rebecca',
    approvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'analyzed',
    newParts: 6,
    totalSavings: 1088.34,
    items: [
      { partNumber: '91263A828', description: 'Zinc-Plated Alloy Steel Hex Drive Flat Head Screw — M4 x 0.7mm, 10mm Long', qty: 110, mcmaster: 8.31, grainger: 6.83, digikey: null, mouser: null, vendorSources: { mcmaster: 'api', grainger: 'estimated', digikey: null, mouser: null }, bestVendor: 'Grainger', savings: 162.80, details: { mcmaster: { inStock: true, stockQty: null, url: 'https://www.mcmaster.com/91263A828', leadTimeDays: 1 }, grainger: { inStock: true, stockQty: 441, url: 'https://www.grainger.com/search?searchQuery=91263A828', leadTimeDays: 3 } } },
      { partNumber: '90128A264', description: 'Zinc-Plated Alloy Steel Socket Head Screw — M6 x 1mm, 20mm Long', qty: 220, mcmaster: 15.27, grainger: 12.41, digikey: null, mouser: null, vendorSources: { mcmaster: 'api', grainger: 'estimated', digikey: null, mouser: null }, bestVendor: 'Grainger', savings: 629.20, details: { mcmaster: { inStock: true, stockQty: null, url: 'https://www.mcmaster.com/90128A264', leadTimeDays: 1 }, grainger: { inStock: true, stockQty: 318, url: 'https://www.grainger.com/search?searchQuery=90128A264', leadTimeDays: 3 } } },
      { partNumber: '94361A527', description: 'Short-Thread Alloy Steel Shoulder Screw — 6mm Dia, 30mm Shoulder, M5 Thread', qty: 22, mcmaster: 7.40, grainger: 6.21, digikey: null, mouser: null, vendorSources: { mcmaster: 'api', grainger: 'estimated', digikey: null, mouser: null }, bestVendor: 'Grainger', savings: 26.18, details: { mcmaster: { inStock: true, stockQty: null, url: 'https://www.mcmaster.com/94361A527', leadTimeDays: 1 } } },
      { partNumber: '90576A817', description: 'Medium-Strength Steel Nylon-Insert Locknut — Zinc-Plated, M12 x 1.75mm', qty: 22, mcmaster: 11.23, grainger: 9.52, digikey: null, mouser: null, vendorSources: { mcmaster: 'api', grainger: 'estimated', digikey: null, mouser: null }, bestVendor: 'Grainger', savings: 37.62, details: { mcmaster: { inStock: true, stockQty: null, url: 'https://www.mcmaster.com/90576A817', leadTimeDays: 1 } } },
      { partNumber: '90154A478', description: 'External Retaining Ring — 20mm Shaft, Zinc-Chromate-Plated Spring Steel', qty: 66, mcmaster: 14.77, grainger: 12.42, digikey: null, mouser: null, vendorSources: { mcmaster: 'api', grainger: 'estimated', digikey: null, mouser: null }, bestVendor: 'Grainger', savings: 155.10, details: { mcmaster: { inStock: true, stockQty: null, url: 'https://www.mcmaster.com/90154A478', leadTimeDays: 1 } } },
      { partNumber: '1804N174', description: 'Blue Die Spring — 25mm Hole Diameter, 25mm Long, Medium Duty', qty: 44, mcmaster: 8.56, grainger: 7.06, digikey: null, mouser: null, vendorSources: { mcmaster: 'api', grainger: 'estimated', digikey: null, mouser: null }, bestVendor: 'Grainger', savings: 66.00, details: { mcmaster: { inStock: true, stockQty: null, url: 'https://www.mcmaster.com/1804N174', leadTimeDays: 1 } } },
    ]
  },
  {
    id: 'BOM-3002',
    name: 'Motor Controller Board v2 — ECO-00012',
    engineer: 'James Park',
    approvedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    status: 'analyzed',
    newParts: 5,
    totalSavings: 48.50,
    items: [
      { partNumber: 'STM32F407VGT6', description: 'MCU 32-Bit ARM Cortex-M4F 168MHz 1MB Flash LQFP-100', qty: 10, mcmaster: null, grainger: null, digikey: 12.50, mouser: 11.80, vendorSources: { mcmaster: null, grainger: null, digikey: 'api', mouser: 'api' }, bestVendor: 'Mouser', savings: 7.00, details: { digikey: { inStock: true, stockQty: 2428, url: 'https://www.digikey.com/en/products/detail/stmicroelectronics/STM32F407VGT6/2747885', leadTimeDays: 2 }, mouser: { inStock: true, stockQty: 19, url: 'https://www.mouser.com/ProductDetail/STMicroelectronics/STM32F407VGT6', leadTimeDays: 2 } }, claudeIntel: { bestPrice: 1.25, bestSource: 'Verified Electronics', sourceUrl: null, insight: 'AI web search: Found at 27 distributors, 63 with stock. Best: $1.25 at Verified Electronics.', alternatives: [{ distributor: 'Weyland Electronics', price: 1.42, url: '', note: '8,968 in stock' }, { distributor: 'Origin Data Global', price: 1.55, url: '', note: '53,760 in stock' }] } },
      { partNumber: 'LM2596S-ADJ', description: 'Buck Converter IC, Adjustable 1.2-37V 3A TO-263-5', qty: 20, mcmaster: null, grainger: null, digikey: 3.25, mouser: 2.98, vendorSources: { mcmaster: null, grainger: null, digikey: 'api', mouser: 'api' }, bestVendor: 'Mouser', savings: 5.40, details: { digikey: { inStock: true, stockQty: 5200, url: 'https://www.digikey.com/en/products/detail/texas-instruments/LM2596S-ADJ-NOPB/363711', leadTimeDays: 2 }, mouser: { inStock: true, stockQty: 3100, url: 'https://www.mouser.com/ProductDetail/Texas-Instruments/LM2596S-ADJ-NOPB', leadTimeDays: 2 } } },
      { partNumber: 'TLP281-4', description: 'Optocoupler Phototransistor Output 4-Channel 16-DIP', qty: 30, mcmaster: null, grainger: null, digikey: 2.45, mouser: 2.30, vendorSources: { mcmaster: null, grainger: null, digikey: 'api', mouser: 'api' }, bestVendor: 'Mouser', savings: 4.50, details: { digikey: { inStock: true, stockQty: 8900, url: 'https://www.digikey.com/en/products/detail/toshiba-semiconductor/TLP281-4/4308186', leadTimeDays: 2 }, mouser: { inStock: true, stockQty: 6200, url: 'https://www.mouser.com/ProductDetail/Toshiba/TLP281-4', leadTimeDays: 2 } } },
      { partNumber: 'IRLZ44NPBF', description: 'N-Channel MOSFET 55V 47A TO-220AB', qty: 40, mcmaster: null, grainger: null, digikey: 1.85, mouser: 1.72, vendorSources: { mcmaster: null, grainger: null, digikey: 'api', mouser: 'api' }, bestVendor: 'Mouser', savings: 5.20, details: { digikey: { inStock: true, stockQty: 12000, url: 'https://www.digikey.com/en/products/detail/infineon-technologies/IRLZ44NPBF/811795', leadTimeDays: 2 }, mouser: { inStock: true, stockQty: 8500, url: 'https://www.mouser.com/ProductDetail/Infineon-Technologies/IRLZ44NPBF', leadTimeDays: 2 } } },
      { partNumber: 'MCP2551-I/SN', description: 'CAN Bus Transceiver 1Mbps 8-SOIC', qty: 15, mcmaster: null, grainger: null, digikey: 1.95, mouser: 1.78, vendorSources: { mcmaster: null, grainger: null, digikey: 'api', mouser: 'api' }, bestVendor: 'Mouser', savings: 2.55, details: { digikey: { inStock: true, stockQty: 15000, url: 'https://www.digikey.com/en/products/detail/microchip-technology/MCP2551-I-SN/680765', leadTimeDays: 2 }, mouser: { inStock: true, stockQty: 9800, url: 'https://www.mouser.com/ProductDetail/Microchip-Technology/MCP2551-I-SN', leadTimeDays: 2 } } },
    ]
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  const hasDb = !!process.env.DATABASE_URL;
  let results: Array<{
    id: string;
    name: string;
    engineer: string;
    approvedAt: string;
    status: string;
    newParts: number;
    totalSavings: number;
    items: unknown[];
  }>;

  if (hasDb) {
    try {
      await initSchema();
      const stored = await listBomAnalyses(limit + offset);
      results = stored.map(b => ({
        id: b.id,
        name: b.name,
        engineer: b.engineer,
        approvedAt: b.approvedAt,
        status: b.status,
        newParts: Array.isArray(b.items) ? b.items.length : 0,
        totalSavings: b.totalSavings,
        // Flatten vendors object if present (pricing API stores nested, page expects flat)
        items: Array.isArray(b.items) ? (b.items as Record<string, unknown>[]).map((item) => {
          if (item.vendors && typeof item.vendors === 'object') {
            const v = item.vendors as Record<string, unknown>;
            return { ...item, mcmaster: v.mcmaster ?? null, grainger: v.grainger ?? null, digikey: v.digikey ?? null, mouser: v.mouser ?? null };
          }
          return item;
        }) : b.items,
      }));

      // If database is empty, seed with mock data so the UI isn't blank
      if (results.length === 0) {
        results = mockBoms;
      }
    } catch (err) {
      console.error('[BOMs API] Database error, falling back to mock:', err);
      results = mockBoms;
    }
  } else {
    results = mockBoms;
  }

  if (status && status !== 'all') {
    results = results.filter(b => b.status === status);
  }

  const paginated = results.slice(offset, offset + limit);
  const isLive = !!process.env.ARENA_API_KEY;

  // Count live vendor integrations from env vars
  const liveApis: string[] = [];
  if (process.env.MCMASTER_USERNAME && (process.env.MCMASTER_CERT_PEM_B64 || process.env.MCMASTER_CERT_PEM_PATH)) liveApis.push('McMaster-Carr');
  if (process.env.OEMSECRETS_API_KEY) liveApis.push('OEM Secrets');
  if (process.env.MOUSER_API_KEY) liveApis.push('Mouser');
  if (process.env.DIGIKEY_CLIENT_ID && process.env.DIGIKEY_CLIENT_SECRET) liveApis.push('DigiKey');
  if (process.env.GRAINGER_API_KEY) liveApis.push('Grainger');
  if (process.env.ANTHROPIC_API_KEY) liveApis.push('Claude AI');

  return NextResponse.json({
    boms: paginated,
    total: results.length,
    limit,
    offset,
    live: isLive,
    liveApis: liveApis.length,
    liveApiNames: liveApis,
    stats: {
      totalSavingsMonth: parseFloat(results.reduce((sum, b) => sum + b.totalSavings, 0).toFixed(2)),
      bomsAnalyzed: results.length,
      avgSavingsPerBom: results.length > 0
        ? parseFloat((results.reduce((sum, b) => sum + b.totalSavings, 0) / results.length).toFixed(2))
        : 0,
    }
  });
}
